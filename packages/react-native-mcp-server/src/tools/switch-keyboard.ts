/**
 * MCP 도구: switch_keyboard
 * iOS 시뮬레이터 / Android 에뮬레이터 키보드 전환.
 * idb_text는 HID 키코드 기반이라 현재 키보드 언어에 의존 — 이 도구로 영문 전환 후 사용.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runCommand } from './run-command.js';

const schema = z.object({
  platform: z.enum(['ios', 'android']).describe('Target platform.'),
  action: z
    .enum(['list', 'get', 'switch'])
    .describe(
      'list: show available keyboards. get: show current keyboard. switch: toggle (iOS) or set (Android) keyboard.'
    ),
  keyboard_id: z
    .string()
    .optional()
    .describe(
      'Required for Android switch. The IME ID to activate (e.g. "com.google.android.inputmethod.latin/.LatinIME"). Use action=list to see available IDs.'
    ),
});

/* ─── iOS helpers ─── */

async function iosListKeyboards(): Promise<string> {
  const buf = await runCommand(
    'xcrun',
    ['simctl', 'spawn', 'booted', 'defaults', 'read', '-g', 'AppleKeyboards'],
    { timeoutMs: 10000 }
  );
  return buf.toString('utf8').trim();
}

async function iosSwitchKeyboard(): Promise<string> {
  const script = [
    'tell application "Simulator" to activate',
    'delay 0.3',
    'tell application "System Events"',
    '    key code 49 using control down',
    'end tell',
  ].join('\n');

  await runCommand('osascript', ['-e', script], { timeoutMs: 10000 });
  return 'Keyboard toggled via Ctrl+Space on iOS Simulator. If it did not work, ensure Simulator has multiple keyboards configured (Settings → General → Keyboard → Keyboards).';
}

/* ─── Android helpers ─── */

async function androidListKeyboards(): Promise<string> {
  const buf = await runCommand('adb', ['shell', 'ime', 'list', '-s'], { timeoutMs: 10000 });
  return buf.toString('utf8').trim();
}

async function androidGetKeyboard(): Promise<string> {
  const buf = await runCommand(
    'adb',
    ['shell', 'settings', 'get', 'secure', 'default_input_method'],
    { timeoutMs: 10000 }
  );
  return buf.toString('utf8').trim();
}

async function androidSwitchKeyboard(keyboardId: string): Promise<string> {
  const buf = await runCommand('adb', ['shell', 'ime', 'set', keyboardId], { timeoutMs: 10000 });
  return buf.toString('utf8').trim();
}

/* ─── 도구 등록 ─── */

export function registerSwitchKeyboard(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'switch_keyboard',
    {
      description:
        'Switch keyboard language on iOS simulator or Android emulator. Use before idb_text to ensure correct keyboard layout (e.g. switch to English before typing English text). iOS: toggles via Ctrl+Space. Android: sets IME by ID.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, action, keyboard_id } = schema.parse(args);

      try {
        if (platform === 'ios') {
          switch (action) {
            case 'list': {
              const list = await iosListKeyboards();
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Registered keyboards on booted iOS Simulator:\n${list}`,
                  },
                ],
              };
            }
            case 'get': {
              const list = await iosListKeyboards();
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `iOS Simulator does not expose the currently active keyboard directly. Registered keyboards:\n${list}\n\nUse action=switch to toggle between them (Ctrl+Space).`,
                  },
                ],
              };
            }
            case 'switch': {
              const result = await iosSwitchKeyboard();
              return { content: [{ type: 'text' as const, text: result }] };
            }
          }
        } else {
          // android
          switch (action) {
            case 'list': {
              const list = await androidListKeyboards();
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Available Android IMEs:\n${list}`,
                  },
                ],
              };
            }
            case 'get': {
              const current = await androidGetKeyboard();
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Current Android IME: ${current}`,
                  },
                ],
              };
            }
            case 'switch': {
              if (!keyboard_id) {
                return {
                  content: [
                    {
                      type: 'text' as const,
                      text: 'keyboard_id is required for Android switch. Use action=list to see available keyboards.',
                    },
                  ],
                };
              }
              const result = await androidSwitchKeyboard(keyboard_id);
              return {
                content: [
                  {
                    type: 'text' as const,
                    text: `Android IME switched: ${result}`,
                  },
                ],
              };
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `switch_keyboard failed: ${message}` }],
        };
      }
    }
  );
}
