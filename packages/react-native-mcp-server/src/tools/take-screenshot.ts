/**
 * MCP 도구: take_screenshot
 * 네이티브 모듈 없이 호스트 CLI(ADB / simctl)로 스크린샷 캡처.
 * 항상 JPEG 80% + 720p. 좌표 보정용 원본 포인트 해상도 포함.
 */

import { readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { runCommand } from './run-command.js';
import { getAndroidScale, getAndroidSurfaceOrientation } from './adb-utils.js';
import { getIOSOrientationInfo } from './ios-landscape.js';

const MAX_HEIGHT = 720;
const JPEG_QUALITY = 80;

const schema = z.object({
  platform: z.enum(['android', 'ios']).describe('android: adb. ios: simctl (simulator only).'),
  filePath: z.string().optional().describe('Path to save screenshot.'),
});

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function isValidPng(buf: Buffer): boolean {
  return buf.length >= PNG_SIGNATURE.length && buf.subarray(0, 8).equals(PNG_SIGNATURE);
}

/** Android: adb exec-out screencap -p 로 raw PNG 수신. */
export async function captureAndroid(): Promise<Buffer> {
  const png = await runCommand('adb', ['exec-out', 'screencap', '-p'], { timeoutMs: 10000 });
  if (!isValidPng(png)) {
    throw new Error('adb screencap produced invalid PNG. Try again or check device.');
  }
  return png;
}

/** iOS 시뮬레이터: simctl io booted screenshot → 파일 읽기. */
export async function captureIos(): Promise<Buffer> {
  const path = join(tmpdir(), `rn-mcp-screenshot-${Date.now()}.png`);
  await runCommand('xcrun', ['simctl', 'io', 'booted', 'screenshot', path], { timeoutMs: 10000 });
  try {
    return await readFile(path);
  } finally {
    await unlink(path).catch(() => {});
  }
}

/**
 * 스크린샷을 디바이스 orientation에 맞게 회전.
 * iOS simctl은 항상 portrait 레이아웃으로 캡처하고,
 * 일부 Android 기기도 landscape에서 portrait 버퍼를 반환.
 */
export async function rotateToUpright(
  png: Buffer,
  platform: 'android' | 'ios',
  appSession: AppSession,
  deviceId?: string
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;

  if (platform === 'ios') {
    const info = await getIOSOrientationInfo(appSession, deviceId, 'ios', 'booted');
    let angle: number;
    switch (info.graphicsOrientation) {
      case 2:
        angle = 180;
        break;
      case 3:
        angle = 90;
        break;
      case 4:
        angle = 270;
        break;
      default:
        return png; // portrait — 회전 불필요
    }
    return sharp(png).rotate(angle).png().toBuffer();
  }

  // Android: SurfaceOrientation과 이미지 차원이 불일치할 때만 회전
  const surfaceOrientation = await getAndroidSurfaceOrientation();
  if (surfaceOrientation === 0) return png;

  const metadata = await sharp(png).metadata();
  const w = metadata.width || 0;
  const h = metadata.height || 0;
  const isPortraitImage = h > w;

  if (surfaceOrientation === 1 || surfaceOrientation === 3) {
    // landscape orientation — screencap이 이미 landscape이면 회전 불필요
    if (!isPortraitImage) return png;
    const angle = surfaceOrientation === 1 ? 90 : 270;
    return sharp(png).rotate(angle).png().toBuffer();
  }

  if (surfaceOrientation === 2) {
    // 180° portrait — 이미지 차원은 같지만 내용이 뒤집힘
    return sharp(png).rotate(180).png().toBuffer();
  }

  return png;
}

type ProcessResult = {
  buffer: Buffer;
  /** Original screen size in points (dp). */
  pointSize: { width: number; height: number };
  /** Output image size in pixels. */
  outputSize: { width: number; height: number };
};

/** 720p JPEG 80%로 변환. 원본 포인트 해상도와 출력 크기를 함께 반환. */
async function processImage(
  png: Buffer,
  platform: 'android' | 'ios',
  runtimePixelRatio?: number | null
): Promise<ProcessResult> {
  const sharp = (await import('sharp')).default;
  const metadata = await sharp(png).metadata();
  const rawWidth = metadata.width || 0;
  const rawHeight = metadata.height || 0;

  // 화면 스케일 계산 (pixel → point 변환용)
  // 런타임 pixelRatio 우선, 없으면 플랫폼별 fallback
  let scale: number;
  if (runtimePixelRatio != null) {
    scale = runtimePixelRatio;
  } else if (platform === 'android') {
    scale = await getAndroidScale();
  } else {
    // iOS fallback: simctl PNG DPI (144=2x, 216=3x). 일부 버전은 72로 찍힘
    const density = metadata.density || 72;
    scale = Math.round(density / 72) || 1;
  }

  const pointSize = {
    width: Math.round(rawWidth / scale),
    height: Math.round(rawHeight / scale),
  };

  // 720p로 리사이즈 + JPEG 80%
  const buffer = await sharp(png)
    .resize({ height: MAX_HEIGHT, fit: 'inside' })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  const outMeta = await sharp(buffer).metadata();
  const outputSize = { width: outMeta.width || 0, height: outMeta.height || 0 };

  return { buffer, pointSize, outputSize };
}

export function registerTakeScreenshot(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'take_screenshot',
    {
      description:
        'Capture device screen as JPEG. Prefer assert_text/assert_visible over screenshots when possible.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, filePath } = schema.parse(args);

      try {
        const rawPng = platform === 'android' ? await captureAndroid() : await captureIos();
        if (!isValidPng(rawPng)) {
          throw new Error('Capture produced invalid PNG.');
        }
        // orientation에 맞게 회전 (landscape → 가로 이미지로 표시)
        const png = await rotateToUpright(rawPng, platform, appSession);
        const runtimeRatio = appSession.getPixelRatio(undefined, platform);
        const { buffer, pointSize, outputSize } = await processImage(png, platform, runtimeRatio);
        if (filePath) {
          await writeFile(filePath, buffer);
        }
        const base64 = buffer.toString('base64');
        const scaleX = (pointSize.width / outputSize.width).toFixed(4);
        const scaleY = (pointSize.height / outputSize.height).toFixed(4);

        const textBlock = {
          type: 'text' as const,
          text: `Screenshot captured (${platform}).${filePath ? ` Saved to ${filePath}.` : ''} Device point size: ${pointSize.width}x${pointSize.height}. Screenshot size: ${outputSize.width}x${outputSize.height}. Coordinate scale: point_x = screenshot_x × ${scaleX}, point_y = screenshot_y × ${scaleY}.`,
        };

        const content = [
          textBlock,
          {
            type: 'image' as const,
            data: base64,
            mimeType: 'image/jpeg' as const,
          },
        ];

        return { content };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Screenshot failed: ${message}. Ensure ${platform === 'android' ? 'adb devices has a device' : 'iOS Simulator is booted (xcrun simctl list devices)'}.`,
            },
          ],
        };
      }
    }
  );
}
