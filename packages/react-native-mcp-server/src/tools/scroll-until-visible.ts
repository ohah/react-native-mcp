/**
 * MCP 도구: scroll_until_visible
 * 요소가 보일 때까지 자동 스크롤. querySelector + swipe 반복.
 * FlatList 가상화로 미렌더링된 아이템도 스크롤하면 나타남.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { buildQuerySelectorEvalCode } from './query-selector.js';
import { checkIdbAvailable, resolveUdid, runIdbCommand } from './idb-utils.js';
import { checkAdbAvailable, resolveSerial, runAdbCommand, getAndroidScale } from './adb-utils.js';
import {
  getIOSOrientationInfo,
  transformForIdb,
  type IOSOrientationInfo,
} from './ios-landscape.js';

const schema = z.object({
  selector: z.string().describe('Selector of the element to find.'),
  direction: z
    .enum(['up', 'down', 'left', 'right'])
    .optional()
    .default('down')
    .describe('Scroll direction (default "down"). "down" scrolls content upward to reveal below.'),
  maxScrolls: z
    .number()
    .optional()
    .default(10)
    .describe('Maximum number of scroll attempts (default 10).'),
  scrollableSelector: z
    .string()
    .optional()
    .describe(
      'Optional selector for the scrollable container. If omitted, swipes from screen center.'
    ),
  platform: z.enum(['ios', 'android']).describe('Target platform.'),
  deviceId: z
    .string()
    .optional()
    .describe(
      'Device identifier. iOS: simulator UDID. Android: device serial. Auto-resolved if only one device is connected.'
    ),
  iosOrientation: z
    .number()
    .optional()
    .describe(
      'iOS GraphicsOrientation override (1-4). 1=Portrait, 2=Portrait180, 3=LandscapeA, 4=LandscapeB. Skips auto-detection when set.'
    ),
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function registerScrollUntilVisible(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'scroll_until_visible',
    {
      description:
        'Scroll until an element matching the selector becomes visible. Combines querySelector check + swipe in a loop. Returns { pass: boolean, scrollCount: number, element?: object }. Useful for finding items in long FlatList/ScrollView.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const {
        selector,
        direction,
        maxScrolls,
        scrollableSelector,
        platform,
        deviceId,
        iosOrientation,
      } = schema.parse(args);

      if (!appSession.isConnected(deviceId, platform)) {
        return {
          content: [{ type: 'text' as const, text: 'No React Native app connected.' }],
        };
      }

      const queryCode = buildQuerySelectorEvalCode(selector);

      /** 요소의 중심이 뷰포트(화면) 안에 있는지. measure가 없으면 true(기존 동작 유지). */
      function isInViewport(
        measure: { pageX: number; pageY: number; width: number; height: number } | undefined,
        screenWidth: number,
        screenHeight: number
      ): boolean {
        if (!measure) return true;
        const { pageX, pageY, width, height } = measure;
        const centerX = pageX + width / 2;
        const centerY = pageY + height / 2;
        return centerX >= 0 && centerX <= screenWidth && centerY >= 0 && centerY <= screenHeight;
      }

      async function getScreenBounds(): Promise<{ width: number; height: number }> {
        const screenCode = `(function(){ var M = typeof __REACT_NATIVE_MCP__ !== 'undefined' ? __REACT_NATIVE_MCP__ : null; return M && M.getScreenInfo ? M.getScreenInfo() : null; })();`;
        const screenRes = await appSession.sendRequest(
          { method: 'eval', params: { code: screenCode } },
          10000,
          deviceId,
          platform
        );
        if (screenRes.result?.window) {
          const w = screenRes.result.window as { width: number; height: number };
          return { width: w.width, height: w.height };
        }
        return { width: 360, height: 800 };
      }

      // 스크롤 영역 좌표 계산 함수
      async function getScrollArea(): Promise<{
        centerX: number;
        centerY: number;
        width: number;
        height: number;
      }> {
        if (scrollableSelector) {
          const scrollCode = buildQuerySelectorEvalCode(scrollableSelector);
          const res = await appSession.sendRequest(
            { method: 'eval', params: { code: scrollCode } },
            10000,
            deviceId,
            platform
          );
          if (res.result?.measure) {
            const m = res.result.measure;
            return {
              centerX: m.pageX + m.width / 2,
              centerY: m.pageY + m.height / 2,
              width: m.width,
              height: m.height,
            };
          }
        }
        // Fallback: 화면 정보에서 중앙 계산
        const screenCode = `(function(){ var M = typeof __REACT_NATIVE_MCP__ !== 'undefined' ? __REACT_NATIVE_MCP__ : null; return M && M.getScreenInfo ? M.getScreenInfo() : null; })();`;
        const screenRes = await appSession.sendRequest(
          { method: 'eval', params: { code: screenCode } },
          10000,
          deviceId,
          platform
        );
        if (screenRes.result?.window) {
          const w = screenRes.result.window;
          return {
            centerX: w.width / 2,
            centerY: w.height / 2,
            width: w.width,
            height: w.height,
          };
        }
        // 최종 fallback: 일반적인 모바일 해상도
        return { centerX: 180, centerY: 400, width: 360, height: 800 };
      }

      // swipe 좌표 계산 (direction에 따라)
      function calcSwipeCoords(
        area: { centerX: number; centerY: number; width: number; height: number },
        dir: string
      ): { x1: number; y1: number; x2: number; y2: number } {
        const swipeDistance =
          dir === 'left' || dir === 'right' ? area.width * 0.6 : area.height * 0.4;
        switch (dir) {
          case 'down':
            return {
              x1: area.centerX,
              y1: area.centerY + swipeDistance / 2,
              x2: area.centerX,
              y2: area.centerY - swipeDistance / 2,
            };
          case 'up':
            return {
              x1: area.centerX,
              y1: area.centerY - swipeDistance / 2,
              x2: area.centerX,
              y2: area.centerY + swipeDistance / 2,
            };
          case 'right':
            return {
              x1: area.centerX + swipeDistance / 2,
              y1: area.centerY,
              x2: area.centerX - swipeDistance / 2,
              y2: area.centerY,
            };
          case 'left':
            return {
              x1: area.centerX - swipeDistance / 2,
              y1: area.centerY,
              x2: area.centerX + swipeDistance / 2,
              y2: area.centerY,
            };
          default:
            return {
              x1: area.centerX,
              y1: area.centerY + swipeDistance / 2,
              x2: area.centerX,
              y2: area.centerY - swipeDistance / 2,
            };
        }
      }

      async function performSwipe(
        coords: { x1: number; y1: number; x2: number; y2: number },
        orientationInfo: IOSOrientationInfo
      ): Promise<void> {
        const duration = 500;
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) throw new Error('idb not available');
          const udid = await resolveUdid(deviceId);
          const s1 = transformForIdb(coords.x1, coords.y1, orientationInfo);
          const s2 = transformForIdb(coords.x2, coords.y2, orientationInfo);
          const cmd = [
            'ui',
            'swipe',
            String(Math.round(s1.x)),
            String(Math.round(s1.y)),
            String(Math.round(s2.x)),
            String(Math.round(s2.y)),
            '--duration',
            String(duration / 1000),
            '--delta',
            '10',
          ];
          await runIdbCommand(cmd, udid);
        } else {
          if (!(await checkAdbAvailable())) throw new Error('adb not available');
          const serial = await resolveSerial(deviceId);
          const scale =
            appSession.getPixelRatio(undefined, 'android') ?? (await getAndroidScale(serial));
          const px1 = Math.round(coords.x1 * scale);
          const py1 = Math.round(coords.y1 * scale);
          const px2 = Math.round(coords.x2 * scale);
          const py2 = Math.round(coords.y2 * scale);
          await runAdbCommand(
            [
              'shell',
              'input',
              'swipe',
              String(px1),
              String(py1),
              String(px2),
              String(py2),
              String(duration),
            ],
            serial
          );
        }
      }

      try {
        const bounds = await getScreenBounds();

        // 첫 번째 체크 (스크롤 없이) — 매칭되더라도 뷰포트 안에 있을 때만 성공
        const initialRes = await appSession.sendRequest(
          { method: 'eval', params: { code: queryCode } },
          10000,
          deviceId,
          platform
        );
        if (initialRes.result != null) {
          const el = initialRes.result as {
            measure?: { pageX: number; pageY: number; width: number; height: number };
          };
          if (isInViewport(el.measure, bounds.width, bounds.height)) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: JSON.stringify({
                    pass: true,
                    scrollCount: 0,
                    element: initialRes.result,
                    message: `Element found without scrolling.`,
                  }),
                },
              ],
            };
          }
        }

        // 스크롤 루프
        const area = await getScrollArea();
        const swipeCoords = calcSwipeCoords(area, direction);
        const iosUdid = platform === 'ios' ? await resolveUdid(deviceId) : '';
        const orientationInfo = await getIOSOrientationInfo(
          appSession,
          deviceId,
          platform,
          iosUdid,
          iosOrientation
        );

        for (let i = 0; i < maxScrolls; i++) {
          await performSwipe(swipeCoords, orientationInfo);
          await sleep(500); // swipe 후 렌더링 대기

          const res = await appSession.sendRequest(
            { method: 'eval', params: { code: queryCode } },
            10000,
            deviceId,
            platform
          );
          if (res.result != null) {
            const el = res.result as {
              measure?: { pageX: number; pageY: number; width: number; height: number };
            };
            if (isInViewport(el.measure, bounds.width, bounds.height)) {
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify({
                      pass: true,
                      scrollCount: i + 1,
                      element: res.result,
                      message: `Element found after ${i + 1} scroll(s).`,
                    }),
                  },
                ],
              };
            }
          }
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                pass: false,
                scrollCount: maxScrolls,
                message: `Element matching "${selector}" not found after ${maxScrolls} scrolls.`,
              }),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `scroll_until_visible failed: ${message}` }],
        };
      }
    }
  );
}
