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
import { captureAndroid, captureIos, isValidPng, rotateToUpright } from './take-screenshot.js';
import { compareImages, cropElement, getScreenScale } from './image-compare.js';
import { buildQuerySelectorEvalCode } from './query-selector.js';

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
        // 1. selector가 있으면 스크롤 관성이 멈출 때까지 대기
        let stableMeasure: MeasureResult | null = null;
        if (selector) {
          stableMeasure = await waitForStableMeasure(appSession, selector, deviceId, platform);
          if (!stableMeasure) {
            throw new Error(`Element not found for selector: ${selector}`);
          }
        }

        // 2. measure → screenshot → measure 샌드위치로 drift 감지 & 재시도
        //    스크린샷 전후 좌표가 1dp 이상 차이나면 다시 찍는다 (최대 5회).
        //    drift가 없으면 pre/post의 평균 좌표를 사용한다 (스크린샷 시점에 가장 가까운 추정).
        let rawPng: Buffer;
        const MAX_CAPTURE_RETRIES = 5;
        const DRIFT_TOLERANCE_DP = 1;
        for (let attempt = 0; attempt < MAX_CAPTURE_RETRIES; attempt++) {
          const preMeasure = selector
            ? await queryMeasure(appSession, selector, deviceId, platform)
            : null;

          rawPng = platform === 'android' ? await captureAndroid() : await captureIos();

          if (selector && preMeasure) {
            const postMeasure = await queryMeasure(appSession, selector, deviceId, platform);
            if (postMeasure) {
              const driftX = Math.abs(postMeasure.pageX - preMeasure.pageX);
              const driftY = Math.abs(postMeasure.pageY - preMeasure.pageY);
              if (driftX > DRIFT_TOLERANCE_DP || driftY > DRIFT_TOLERANCE_DP) {
                // drift 감지 — 안정화 대기 후 재시도
                stableMeasure = await waitForStableMeasure(
                  appSession,
                  selector,
                  deviceId,
                  platform
                );
                continue;
              }
              // drift 없음 — pre/post 평균 좌표 사용 (스크린샷은 그 사이에 찍혔으므로)
              stableMeasure = {
                pageX: (preMeasure.pageX + postMeasure.pageX) / 2,
                pageY: (preMeasure.pageY + postMeasure.pageY) / 2,
                width: (preMeasure.width + postMeasure.width) / 2,
                height: (preMeasure.height + postMeasure.height) / 2,
              };
            }
          }
          break;
        }

        rawPng = rawPng!;
        if (!isValidPng(rawPng)) {
          throw new Error('Capture produced invalid PNG.');
        }

        // 3. orientation에 맞게 회전
        const uprightPng = await rotateToUpright(rawPng, platform, appSession, deviceId);

        // 4. selector가 있으면 요소 크롭
        let currentPng: Buffer;
        if (stableMeasure) {
          const measure = stableMeasure;
          const runtimeRatio = appSession.getPixelRatio(deviceId, platform);
          const scale = await getScreenScale(uprightPng, platform, runtimeRatio);
          const topInsetDp = appSession.getTopInsetDp(deviceId, platform);

          const sharp = (await import('sharp')).default;
          const imgMeta = await sharp(uprightPng).metadata();
          const imgW = imgMeta.width!;
          const imgH = imgMeta.height!;

          const rect = {
            left: Math.round(measure.pageX * scale),
            top: Math.round((measure.pageY + topInsetDp) * scale),
            width: Math.round(measure.width * scale),
            height: Math.round(measure.height * scale),
          };

          // 스크린샷 범위를 초과하지 않도록 클램핑
          if (rect.left < 0) {
            rect.width += rect.left;
            rect.left = 0;
          }
          if (rect.top < 0) {
            rect.height += rect.top;
            rect.top = 0;
          }
          if (rect.left + rect.width > imgW) rect.width = imgW - rect.left;
          if (rect.top + rect.height > imgH) rect.height = imgH - rect.top;

          if (rect.width <= 0 || rect.height <= 0) {
            throw new Error(
              `Element is off-screen after clamping (rect: ${JSON.stringify(rect)}, img: ${imgW}x${imgH}).`
            );
          }

          currentPng = await cropElement(uprightPng, rect);
        } else {
          currentPng = uprightPng;
        }

        // 5. saveCurrent 옵션
        if (saveCurrent) {
          await mkdir(dirname(saveCurrent), { recursive: true });
          await writeFile(saveCurrent, currentPng);
        }

        // 6. updateBaseline 모드: 현재를 베이스라인으로 저장
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

        // 7. 베이스라인 로드
        let baselinePng: Buffer;
        try {
          baselinePng = await readFile(baseline);
        } catch {
          throw new Error(
            `Baseline not found: ${baseline}. Run with updateBaseline=true to create it.`
          );
        }

        // 8. 비교
        const result = await compareImages(baselinePng, currentPng, threshold);

        // 9. saveDiff 옵션
        if (saveDiff && result.diffBuffer) {
          await mkdir(dirname(saveDiff), { recursive: true });
          await writeFile(saveDiff, result.diffBuffer);
        }

        // 10. 결과 반환 (텍스트만 — diff 이미지는 saveDiff 파일로만 저장, 토큰 절약)
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

/**
 * measure를 반복 조회하여 좌표가 수렴(안정)할 때까지 대기한다.
 * 스크롤 관성이 남아있으면 pageX/pageY가 프레임마다 변하므로,
 * 연속 3번 measure가 toleranceDp 이내로 같으면 안정으로 판단한다.
 */
async function waitForStableMeasure(
  appSession: AppSession,
  selector: string,
  deviceId?: string,
  platform?: string,
  { maxAttempts = 15, intervalMs = 200, toleranceDp = 0.5, requiredConsecutive = 3 } = {}
): Promise<MeasureResult | null> {
  let prev = await queryMeasure(appSession, selector, deviceId, platform);
  if (!prev) return null;

  let consecutiveStable = 0;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const curr = await queryMeasure(appSession, selector, deviceId, platform);
    if (!curr) return null;

    if (
      Math.abs(curr.pageX - prev.pageX) <= toleranceDp &&
      Math.abs(curr.pageY - prev.pageY) <= toleranceDp
    ) {
      consecutiveStable++;
      if (consecutiveStable >= requiredConsecutive) {
        return curr;
      }
    } else {
      consecutiveStable = 0;
    }
    prev = curr;
  }

  return prev;
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
