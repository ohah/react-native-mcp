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
import { runCommand } from './run-command.js';

const MAX_HEIGHT = 720;
const JPEG_QUALITY = 80;

const schema = z.object({
  platform: z
    .enum(['android', 'ios'])
    .describe('android: adb shell screencap. ios: xcrun simctl (simulator only).'),
  filePath: z.string().optional().describe('Path to save screenshot (optional).'),
});

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isValidPng(buf: Buffer): boolean {
  return buf.length >= PNG_SIGNATURE.length && buf.subarray(0, 8).equals(PNG_SIGNATURE);
}

/** Android: adb exec-out screencap -p 로 raw PNG 수신. */
async function captureAndroid(): Promise<Buffer> {
  const png = await runCommand('adb', ['exec-out', 'screencap', '-p'], { timeoutMs: 10000 });
  if (!isValidPng(png)) {
    throw new Error('adb screencap produced invalid PNG. Try again or check device.');
  }
  return png;
}

/** iOS 시뮬레이터: simctl io booted screenshot → 파일 읽기. */
async function captureIos(): Promise<Buffer> {
  const path = join(tmpdir(), `rn-mcp-screenshot-${Date.now()}.png`);
  await runCommand('xcrun', ['simctl', 'io', 'booted', 'screenshot', path], { timeoutMs: 10000 });
  try {
    return await readFile(path);
  } finally {
    await unlink(path).catch(() => {});
  }
}

/** Android screen density (dp scale) via adb shell wm density. */
async function getAndroidScale(): Promise<number> {
  try {
    const buf = await runCommand('adb', ['shell', 'wm', 'density'], { timeoutMs: 5000 });
    const match = buf.toString().match(/(\d+)/);
    return match ? parseInt(match[1], 10) / 160 : 1;
  } catch {
    return 1;
  }
}

type ProcessResult = {
  buffer: Buffer;
  /** Original screen size in points (dp). */
  pointSize: { width: number; height: number };
  /** Output image size in pixels. */
  outputSize: { width: number; height: number };
};

/** 720p JPEG 80%로 변환. 원본 포인트 해상도와 출력 크기를 함께 반환. */
async function processImage(png: Buffer, platform: 'android' | 'ios'): Promise<ProcessResult> {
  const sharp = (await import('sharp')).default;
  const metadata = await sharp(png).metadata();
  const rawWidth = metadata.width || 0;
  const rawHeight = metadata.height || 0;

  // 화면 스케일 계산 (pixel → point 변환용)
  let scale: number;
  if (platform === 'android') {
    scale = await getAndroidScale();
  } else {
    // iOS simctl PNG: 144 DPI = 2x, 216 DPI = 3x
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

export function registerTakeScreenshot(server: McpServer): void {
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
        'Capture current screen of Android device (adb) or iOS simulator (xcrun simctl). Always JPEG 80% 720p. Response includes device point size and coordinate scale for mapping screenshot pixels to device points. NOTE: Screenshots use vision tokens (expensive). Prefer assert_text or assert_visible for verification.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, filePath } = schema.parse(args);

      try {
        const png = platform === 'android' ? await captureAndroid() : await captureIos();
        if (!isValidPng(png)) {
          throw new Error('Capture produced invalid PNG.');
        }
        const { buffer, pointSize, outputSize } = await processImage(png, platform);
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

        // Android: 일부 클라이언트에서 image content 처리 이슈 → data URL로 전송
        const dataUrl = `data:image/jpeg;base64,${base64}`;
        const content =
          platform === 'android'
            ? [
                textBlock,
                {
                  type: 'text' as const,
                  text: `Screenshot (image/jpeg, base64 data URL):\n${dataUrl}`,
                },
              ]
            : [
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
