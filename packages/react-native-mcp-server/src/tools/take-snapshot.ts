/**
 * MCP 도구: take_snapshot
 * Chrome DevTools MCP 스펙 정렬. a11y 대신 Fiber 컴포넌트 트리(타입/testID/자식) 기반 스냅샷.
 * querySelector 대체: 트리에서 ScrollView, FlatList, Text 등 타입·uid로 요소 탐색.
 *
 * compact 출력: JSON 대신 들여쓰기 텍스트로 토큰 대폭 절감.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  maxDepth: z.number().int().min(1).max(100).optional().describe('Max tree depth. Default 30.'),
  interactive: z
    .boolean()
    .optional()
    .describe(
      'If true, show only interactive elements (Touchable, Button, TextInput, Switch, etc.).'
    ),
  deviceId: deviceParam,
  platform: platformParam,
});

/** 인터랙티브 컴포넌트 타입 */
const INTERACTIVE_TYPES = new Set([
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
  'Pressable',
  'Button',
  'TextInput',
  'Switch',
  'Slider',
  'Picker',
  'CheckBox',
]);

interface SnapshotNode {
  uid?: string;
  type?: string;
  testID?: string;
  text?: string;
  children?: SnapshotNode[];
}

/** Compact tree 포맷: JSON → 들여쓰기 텍스트 */
export function formatCompactTree(
  node: SnapshotNode,
  depth: number,
  options: { interactive?: boolean }
): string[] {
  const type = node.type ?? '';
  const uid = node.uid ?? '';
  const testID = node.testID ?? '';
  const text = node.text ?? '';
  const isInteractive = INTERACTIVE_TYPES.has(type);

  // interactive 모드: 인터랙티브가 아닌 노드는 자식만 순회
  if (options.interactive && !isInteractive && depth > 0) {
    const childLines: string[] = [];
    for (const child of node.children ?? []) {
      childLines.push(...formatCompactTree(child, depth, options));
    }
    return childLines;
  }

  const indent = '  '.repeat(depth);
  const parts: string[] = [type];
  if (testID) parts.push(`#${testID}`);
  if (text) parts.push(`"${text}"`);
  if (uid && uid !== testID) parts.push(`uid=${uid}`);

  const line = `${indent}- ${parts.join(' ')}`;
  const out: string[] = [];

  // 빈 줄(타입만 있고 의미 없는 노드)은 스킵, 자식만 출력
  if (parts.length > 1 || isInteractive || depth === 0) {
    out.push(line);
  }

  for (const child of node.children ?? []) {
    out.push(...formatCompactTree(child, depth + 1, options));
  }
  return out;
}

export function registerTakeSnapshot(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'take_snapshot',
    {
      description:
        'Capture component tree. Compact text output. uid = testID or path for tap/swipe. Use interactive=true for minimal token usage.',
      inputSchema: schema,
    },
    async (args) => {
      const parsed = schema.safeParse(args ?? {});
      const deviceId = parsed.success ? parsed.data.deviceId : undefined;
      const platform = parsed.success ? parsed.data.platform : undefined;

      if (!appSession.isConnected(deviceId, platform)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No React Native app connected. Start the app with Metro and ensure the MCP runtime is loaded.',
            },
          ],
        };
      }
      const maxDepth = parsed.success && parsed.data.maxDepth != null ? parsed.data.maxDepth : 30;
      const interactive = parsed.success ? (parsed.data.interactive ?? false) : false;
      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getComponentTree ? __REACT_NATIVE_MCP__.getComponentTree({ maxDepth: ${maxDepth} }) : null; })();`;
      try {
        const res = await appSession.sendRequest(
          { method: 'eval', params: { code } },
          10000,
          deviceId,
          platform
        );
        if (res.error != null) {
          return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] };
        }
        const tree = res.result as SnapshotNode | null;
        if (tree == null) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Snapshot unavailable (DevTools hook or fiber root missing).',
              },
            ],
          };
        }
        const lines = formatCompactTree(tree, 0, { interactive });
        const text = lines.length > 0 ? lines.join('\n') : '(empty tree)';
        return {
          content: [{ type: 'text' as const, text }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `take_snapshot failed: ${message}` }],
        };
      }
    }
  );
}
