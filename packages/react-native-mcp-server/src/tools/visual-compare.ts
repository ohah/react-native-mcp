/**
 * MCP 도구: visual_compare
 * 스크린샷을 캡처하여 베이스라인 PNG 파일과 픽셀 단위 비교.
 * selector 지정 시 해당 요소만 크롭하여 비교 (컴포넌트 단위 비주얼 리그레션).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { captureAndroid, captureIos, isValidPng } from './take-screenshot.js';
import { compareImages, cropElement, getScreenScale } from './image-compare.js';
import { buildQuerySelectorEvalCode } from './query-selector.js';
import { getIOSOrientationInfo, transformRectForPortraitScreenshot } from './ios-landscape.js';

const schema = z.object({
  platform: z.enum(['android', 'ios']).describe('Target platform.'),
  baseline: z.string().describe('Absolute path to baseline PNG file.'),
  selector: z
    .string()
    .optional()
    .describe('CSS-like selector to crop a specific element. If omitted, compares full screen.'),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('pixelmatch threshold (0~1). Default 0.1.'),
  updateBaseline: z
    .boolean()
    .optional()
    .describe('If true, save current screenshot as new baseline and skip comparison.'),
  saveDiff: z.string().optional().describe('Path to save diff image PNG.'),
  saveCurrent: z.string().optional().describe('Path to save current screenshot PNG.'),
  deviceId: z.string().optional(),
});

interface MeasureResult {
  pageX: number;
  pageY: number;
  width: number;
  height: number;
}

export function registerVisualCompare(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'visual_compare',
    {
      description:
        'Compare screenshot against baseline PNG. Supports element-level cropping via selector.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const {
        platform,
        baseline,
        selector,
        threshold = 0.1,
        updateBaseline,
        saveDiff,
        saveCurrent,
        deviceId,
      } = schema.parse(args);

      try {
        // 1. 스크린샷 캡처 (raw PNG)
        const rawPng = platform === 'android' ? await captureAndroid() : await captureIos();
        if (!isValidPng(rawPng)) {
          throw new Error('Capture produced invalid PNG.');
        }

        // 2. selector가 있으면 요소 크롭
        let currentPng: Buffer;
        if (selector) {
          const measure = await queryMeasure(appSession, selector, deviceId, platform);
          if (!measure) {
            throw new Error(`Element not found for selector: ${selector}`);
          }
          const runtimeRatio = appSession.getPixelRatio(deviceId, platform);
          const scale = await getScreenScale(rawPng, platform, runtimeRatio);
          const topInsetDp = appSession.getTopInsetDp(deviceId, platform);

          // iOS simctl screenshot은 항상 portrait 방향으로 캡처하므로,
          // landscape일 때 measure 좌표를 portrait 기준으로 변환해야 한다.
          let rect: { left: number; top: number; width: number; height: number };
          if (platform === 'ios') {
            const orientInfo = await getIOSOrientationInfo(appSession, deviceId, 'ios', 'booted');
            const transformed = transformRectForPortraitScreenshot(
              {
                pageX: measure.pageX,
                pageY: measure.pageY + topInsetDp,
                width: measure.width,
                height: measure.height,
              },
              orientInfo
            );
            rect = {
              left: Math.round(transformed.left * scale),
              top: Math.round(transformed.top * scale),
              width: Math.round(transformed.width * scale),
              height: Math.round(transformed.height * scale),
            };
          } else {
            rect = {
              left: Math.round(measure.pageX * scale),
              top: Math.round((measure.pageY + topInsetDp) * scale),
              width: Math.round(measure.width * scale),
              height: Math.round(measure.height * scale),
            };
          }
          currentPng = await cropElement(rawPng, rect);
        } else {
          currentPng = rawPng;
        }

        // 3. saveCurrent 옵션
        if (saveCurrent) {
          await mkdir(dirname(saveCurrent), { recursive: true });
          await writeFile(saveCurrent, currentPng);
        }

        // 4. updateBaseline 모드: 현재를 베이스라인으로 저장
        if (updateBaseline) {
          await mkdir(dirname(baseline), { recursive: true });
          await writeFile(baseline, currentPng);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  updated: true,
                  baseline,
                  message: `Baseline updated: ${baseline}`,
                }),
              },
            ],
          };
        }

        // 5. 베이스라인 로드
        let baselinePng: Buffer;
        try {
          baselinePng = await readFile(baseline);
        } catch {
          throw new Error(
            `Baseline not found: ${baseline}. Run with updateBaseline=true to create it.`
          );
        }

        // 6. 비교
        const result = await compareImages(baselinePng, currentPng, threshold);

        // 7. saveDiff 옵션
        if (saveDiff && result.diffBuffer) {
          await mkdir(dirname(saveDiff), { recursive: true });
          await writeFile(saveDiff, result.diffBuffer);
        }

        // 8. 결과 반환 (텍스트만 — diff 이미지는 saveDiff 파일로만 저장, 토큰 절약)
        const content = [
          {
            type: 'text' as const,
            text: JSON.stringify({
              pass: result.pass,
              diffRatio: result.diffRatio,
              diffPixels: result.diffPixels,
              totalPixels: result.totalPixels,
              dimensions: result.dimensions,
              threshold,
              baseline,
              selector: selector ?? null,
              saveDiff: saveDiff ?? null,
              message: result.message,
            }),
          },
        ];

        return { content, isError: !result.pass ? true : undefined };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `visual_compare failed: ${message}` }],
        };
      }
    }
  );
}

/** querySelector로 요소의 measure 좌표를 가져온다. */
async function queryMeasure(
  appSession: AppSession,
  selector: string,
  deviceId?: string,
  platform?: string
): Promise<MeasureResult | null> {
  const code = buildQuerySelectorEvalCode(selector);
  const res = await appSession.sendRequest(
    { method: 'eval', params: { code } },
    10000,
    deviceId,
    platform
  );
  if (res.error != null || res.result == null) return null;
  const el = res.result as { measure?: MeasureResult };
  return el.measure ?? null;
}
