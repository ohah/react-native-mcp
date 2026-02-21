/**
 * MCP 도구: start_video_recording / stop_video_recording
 * idb(iOS) / adb(Android) 화면 녹화를 spawn으로 띄우고, stop 시 SIGINT 후 파일 반환.
 * runCommand는 사용하지 않음(완료 대기 전제). child_process.spawn만 사용.
 */

import { resolve, sep } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { runCommand } from './run-command.js';
import { checkIdbAvailable, resolveUdid, idbNotInstalledError } from './idb-utils.js';
import {
  checkAdbAvailable,
  resolveSerial,
  adbNotInstalledError,
} from './adb-utils.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

function isPathUnderBase(filePath: string, allowedBase: string): boolean {
  const resolved = resolve(filePath);
  const base = resolve(allowedBase);
  return resolved === base || resolved.startsWith(base + sep);
}

/** 서버당 최대 1개. v1에서는 Map 없이 단일 슬롯만 사용. */
interface ActiveRecording {
  platform: 'ios' | 'android';
  process: ChildProcess;
  hostPath: string;
  devicePath?: string;
  serial?: string;
}

let activeRecording: ActiveRecording | null = null;

/** 서버 종료 또는 테스트 정리 시 호출. 활성 녹화가 있으면 SIGINT 전송. */
export function stopAllRecordings(): void {
  if (!activeRecording) return;
  try {
    activeRecording.process.kill('SIGINT');
  } catch {
    try {
      activeRecording.process.kill('SIGKILL');
    } catch {
      /* ignore */
    }
  }
  activeRecording = null;
}

// Process exit 시 정리 (appSession.stop()이 호출되지 않는 경우 대비)
if (typeof process !== 'undefined') {
  const onExit = () => {
    stopAllRecordings();
  };
  process.once('beforeExit', onExit);
  process.once('SIGINT', onExit);
  process.once('SIGTERM', onExit);
}

const startSchema = z.object({
  platform: z.enum(['ios', 'android']).describe('ios or android.'),
  filePath: z
    .string()
    .describe('Host path to save the recording (must be under e2e-artifacts or cwd).'),
  deviceId: z
    .string()
    .optional()
    .describe('Device ID. iOS: udid, Android: serial. Omit for single device.'),
});

const stopSchema = z.object({
  platform: z
    .enum(['ios', 'android'])
    .optional()
    .describe('Platform to stop. Omit when only one recording.'),
});

export function registerStartVideoRecording(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'start_video_recording',
    {
      description:
        'Start screen recording on device/simulator. Save with stop_video_recording. iOS: idb, Android: adb screenrecord.',
      inputSchema: startSchema,
    },
    async (args: unknown) => {
      const { platform, filePath, deviceId } = startSchema.parse(args);

      if (activeRecording) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'Already recording. Call stop_video_recording first.',
            },
          ],
        };
      }

      if (!isPathUnderBase(filePath, process.cwd())) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `filePath must be under current working directory. Got: ${filePath}`,
            },
          ],
        };
      }

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          // idb video <path> --udid <udid>. 일부 버전은 record-video 서브커맨드 사용 가능.
          const proc = spawn('idb', ['video', filePath, '--udid', udid], {
            stdio: 'ignore',
          });
          proc.on('error', () => {
            if (activeRecording?.platform === 'ios') activeRecording = null;
          });
          proc.unref();
          activeRecording = { platform: 'ios', process: proc, hostPath: resolve(filePath) };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          const devicePath = `/sdcard/Download/rn-mcp-recording-${Date.now()}.mp4`;
          const proc = spawn('adb', ['-s', serial, 'shell', 'screenrecord', devicePath], {
            stdio: 'ignore',
          });
          proc.on('error', () => {
            if (activeRecording?.platform === 'android') activeRecording = null;
          });
          proc.unref();
          activeRecording = {
            platform: 'android',
            process: proc,
            hostPath: resolve(filePath),
            devicePath,
            serial,
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: 'Recording started. Use stop_video_recording to stop and save.',
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `start_video_recording failed: ${message}. Ensure ${platform === 'ios' ? 'idb list-targets has a booted simulator' : 'adb devices has a device'}.`,
            },
          ],
        };
      }
    }
  );
}

export function registerStopVideoRecording(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'stop_video_recording',
    {
      description: 'Stop the current screen recording and return the saved file path.',
      inputSchema: stopSchema,
    },
    async (args: unknown) => {
      const parsed = stopSchema.safeParse(args);
      const platform = parsed.success ? parsed.data.platform : undefined;

      if (!activeRecording) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ success: false, error: 'No active recording.' }),
            },
          ],
        };
      }

      if (platform != null && activeRecording.platform !== platform) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                error: `Active recording is ${activeRecording.platform}, not ${platform}.`,
              }),
            },
          ],
        };
      }

      const rec = activeRecording;
      activeRecording = null;
      const { process: proc, hostPath, devicePath, serial, platform: recPlatform } = rec;

      return new Promise<{ content: Array<{ type: 'text'; text: string }> }>((resolveContent) => {
        const timeout = setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch {
            /* ignore */
          }
          resolveContent({
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  success: false,
                  error: 'Recording process did not exit in time. File may be incomplete.',
                  filePath: hostPath,
                }),
              },
            ],
          });
        }, 15000);

        proc.on('close', async () => {
          clearTimeout(timeout);
          let resultPath = hostPath;
          if (recPlatform === 'android' && devicePath && serial) {
            try {
              await runCommand('adb', ['-s', serial, 'pull', devicePath, hostPath], {
                timeoutMs: 30000,
              });
            } catch (pullErr) {
              const msg = pullErr instanceof Error ? pullErr.message : String(pullErr);
              resolveContent({
                content: [
                  {
                    type: 'text' as const,
                    text: JSON.stringify({
                      success: false,
                      error: `Pull failed: ${msg}`,
                      filePath: hostPath,
                    }),
                  },
                ],
              });
              return;
            }
          }
          resolveContent({
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ success: true, filePath: resultPath }),
              },
            ],
          });
        });

        try {
          proc.kill('SIGINT');
        } catch {
          try {
            proc.kill('SIGKILL');
          } catch {
            /* ignore */
          }
          clearTimeout(timeout);
          resolveContent({
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  success: false,
                  error: 'Failed to send signal to recording process.',
                  filePath: hostPath,
                }),
              },
            ],
          });
        }
      });
    }
  );
}
