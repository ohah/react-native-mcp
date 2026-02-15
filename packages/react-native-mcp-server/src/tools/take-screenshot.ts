/**
 * MCP 도구: take_screenshot
 * DESIGN.md Phase 4 — 네이티브 모듈 없이 호스트 CLI(ADB / simctl)로 스크린샷 캡처
 * AI vision 친화: 기본 JPEG 80% + 720p (full PNG는 타임아웃 유발)
 */

import { spawn } from 'node:child_process';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** Chrome DevTools MCP 스펙 정렬 + AI vision: 기본 jpeg/80%/720p */
const schema = z.object({
  platform: z
    .enum(['android', 'ios'])
    .describe('android: adb shell screencap. ios: xcrun simctl (simulator only).'),
  filePath: z.string().optional().describe('Path to save screenshot (optional).'),
  format: z
    .enum(['png', 'jpeg', 'webp'])
    .optional()
    .default('jpeg')
    .describe('Image format. Default jpeg for AI vision (avoids timeout).'),
  quality: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .default(80)
    .describe('JPEG/WebP quality 0–100. Default 80. Ignored for PNG.'),
  maxHeight: z
    .number()
    .min(0)
    .optional()
    .default(720)
    .describe(
      'Max height in pixels (aspect ratio preserved). Default 720 for 720p. Set 0 to keep original size.'
    ),
});

function runCommand(
  command: string,
  args: string[],
  options?: { stdin?: Buffer; timeoutMs?: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: options?.stdin ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    });
    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    proc.stdout?.on('data', (chunk: Buffer) => outChunks.push(chunk));
    proc.stderr?.on('data', (chunk: Buffer) => errChunks.push(chunk));
    const timeout =
      options?.timeoutMs != null
        ? setTimeout(() => {
            proc.kill('SIGKILL');
            reject(new Error('Command timed out'));
          }, options.timeoutMs)
        : undefined;
    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        const stderr = Buffer.concat(errChunks).toString('utf8').slice(0, 300);
        reject(new Error(`Command failed with code ${code}. ${stderr}`));
        return;
      }
      resolve(Buffer.concat(outChunks));
    });
    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    if (options?.stdin && proc.stdin) {
      proc.stdin.write(options.stdin);
      proc.stdin.end();
    }
  });
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isValidPng(buf: Buffer): boolean {
  return buf.length >= PNG_SIGNATURE.length && buf.subarray(0, 8).equals(PNG_SIGNATURE);
}

/** Android: adb exec-out screencap -p 로 raw PNG 수신 (shell 은 PTY 때문에 바이너리 손상 가능). */
async function captureAndroid(): Promise<Buffer> {
  const png = await runCommand('adb', ['exec-out', 'screencap', '-p'], { timeoutMs: 10000 });
  if (!isValidPng(png)) {
    throw new Error(
      'adb screencap produced invalid PNG (wrong signature or empty). Try again or check device.'
    );
  }
  return png;
}

/** iOS 시뮬레이터: simctl io booted screenshot <path> → 파일 읽기 */
async function captureIos(): Promise<Buffer> {
  const path = join(tmpdir(), `rn-mcp-screenshot-${Date.now()}.png`);
  await runCommand('xcrun', ['simctl', 'io', 'booted', 'screenshot', path], { timeoutMs: 10000 });
  try {
    return await readFile(path);
  } finally {
    await unlink(path).catch(() => {});
  }
}

type ProcessOptions = { format: 'png' | 'jpeg' | 'webp'; quality: number; maxHeight: number };

/** Resize (720p by default) and encode to format. Reduces payload for AI vision. sharp는 동적 import (번들 시 네이티브 로드 이슈 회피). */
async function processImage(
  png: Buffer,
  opts: ProcessOptions
): Promise<{ buffer: Buffer; mimeType: string }> {
  const sharp = (await import('sharp')).default;
  let pipeline = sharp(png);
  if (opts.maxHeight > 0) {
    pipeline = pipeline.resize({ height: opts.maxHeight, fit: 'inside' });
  }
  const q = opts.quality;
  if (opts.format === 'jpeg') {
    const buffer = await pipeline.jpeg({ quality: q }).toBuffer();
    return { buffer, mimeType: 'image/jpeg' };
  }
  if (opts.format === 'webp') {
    const buffer = await pipeline.webp({ quality: q }).toBuffer();
    return { buffer, mimeType: 'image/webp' };
  }
  const buffer = await pipeline.png().toBuffer();
  return { buffer, mimeType: 'image/png' };
}

/**
 * take_screenshot 도구 등록: Android(adb) 또는 iOS 시뮬레이터(simctl)로 화면 캡처 후
 * 기본 JPEG 80% + 720p로 변환해 반환 (AI vision 타임아웃 방지)
 */
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
        'Capture current screen of connected Android device (adb) or booted iOS simulator (xcrun simctl). No in-app native module. Default: JPEG 80% + 720p for AI vision (avoids timeout). Returns image as MCP image content.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, filePath, format, quality, maxHeight } = schema.parse(args);

      try {
        const png = platform === 'android' ? await captureAndroid() : await captureIos();
        if (!isValidPng(png)) {
          throw new Error('Capture produced invalid PNG.');
        }
        const { buffer, mimeType } = await processImage(png, {
          format,
          quality,
          maxHeight,
        });
        if (filePath) {
          await writeFile(filePath, buffer);
        }
        const base64 = buffer.toString('base64');

        const textBlock = {
          type: 'text' as const,
          text: `Screenshot captured (${platform}).${filePath ? ` Saved to ${filePath}.` : ''} Format: ${format}, quality: ${quality}, maxHeight: ${maxHeight}.`,
        };
        const imageBlock = {
          type: 'image' as const,
          data: base64,
          mimeType: mimeType as 'image/png' | 'image/jpeg' | 'image/webp',
        };

        // Android: Cursor 등 일부 클라이언트에서 image content 처리 시 "Could not find MIME for Buffer" 발생.
        const dataUrl = `data:${mimeType};base64,${base64}`;
        const content =
          platform === 'android'
            ? [
                textBlock,
                {
                  type: 'text' as const,
                  text: `Screenshot (${mimeType}, base64 data URL):\n${dataUrl}`,
                },
              ]
            : [textBlock, imageBlock];

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
