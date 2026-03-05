/**
 * MCP 도구: describe_ui
 * iOS(idb describe-all/describe-point) / Android(uiautomator dump) UI 트리 통합.
 */

import { z } from 'zod';
import { XMLParser } from 'fast-xml-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  checkIdbAvailable,
  resolveUdid,
  runIdbCommand,
  idbNotInstalledError,
} from './idb-utils.js';
import {
  checkAdbAvailable,
  resolveSerial,
  runAdbCommand,
  adbNotInstalledError,
} from './adb-utils.js';

/* ─── Android XML → JSON 변환 ─── */

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  isArray: (name) => name === 'node',
});

interface UiNode {
  [key: string]: unknown;
  node?: UiNode[];
}

function stripEmpty(node: UiNode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'node') continue;
    if (v === '' || v === 'false') continue;
    out[k] = v;
  }
  if (node.node && Array.isArray(node.node)) {
    out.children = node.node.map(stripEmpty);
  }
  return out;
}

/** compact 텍스트: Android UI 노드 → 들여쓰기 텍스트 */
function formatUiNodeCompact(node: Record<string, unknown>, depth: number): string[] {
  const cls = String(node['class'] ?? node['type'] ?? '');
  const shortClass = cls.includes('.') ? cls.split('.').pop()! : cls;
  const text = String(node['text'] ?? '');
  const contentDesc = String(node['content-desc'] ?? node['contentDesc'] ?? '');
  const resourceId = String(node['resource-id'] ?? node['resourceId'] ?? '');
  const shortId = resourceId.includes('/') ? resourceId.split('/').pop()! : resourceId;
  const clickable = node['clickable'] === 'true' || node['clickable'] === true;
  const scrollable = node['scrollable'] === 'true' || node['scrollable'] === true;
  const enabled = node['enabled'];
  const bounds = String(node['bounds'] ?? '');

  const indent = '  '.repeat(depth);
  const parts: string[] = [shortClass || 'node'];
  if (shortId) parts.push(`#${shortId}`);
  if (text) parts.push(`"${text}"`);
  if (contentDesc && contentDesc !== text) parts.push(`desc="${contentDesc}"`);
  if (clickable) parts.push('[clickable]');
  if (scrollable) parts.push('[scrollable]');
  if (enabled === 'false' || enabled === false) parts.push('[disabled]');
  if (bounds) parts.push(`bounds=${bounds}`);

  const out: string[] = [];
  if (parts.length > 1 || depth === 0) {
    out.push(`${indent}- ${parts.join(' ')}`);
  }
  const children = node['children'] as Record<string, unknown>[] | undefined;
  if (Array.isArray(children)) {
    for (const child of children) {
      out.push(...formatUiNodeCompact(child, depth + 1));
    }
  }
  return out;
}

function xmlToCompact(xml: string): string {
  const parsed = xmlParser.parse(xml) as {
    hierarchy?: { node?: UiNode[] } & Record<string, unknown>;
  };
  const hierarchy = parsed.hierarchy;
  if (!hierarchy) return xml.slice(0, 500);

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(hierarchy)) {
    if (k === 'node') continue;
    if (v !== '' && v !== 'false') result[k] = v;
  }
  if (hierarchy.node) {
    result.children = hierarchy.node.map(stripEmpty);
  }
  const lines = formatUiNodeCompact(result, 0);
  return lines.length > 0 ? lines.join('\n') : '(empty UI tree)';
}

/** iOS JSON 출력도 compact로 변환 */
function iosJsonToCompact(jsonStr: string): string {
  try {
    const data = JSON.parse(jsonStr);
    if (Array.isArray(data)) {
      const lines: string[] = [];
      for (const item of data) {
        lines.push(...formatIosNode(item as Record<string, unknown>, 0));
      }
      return lines.length > 0 ? lines.join('\n') : '(empty)';
    }
    return formatIosNode(data as Record<string, unknown>, 0).join('\n') || '(empty)';
  } catch {
    return jsonStr;
  }
}

function formatIosNode(node: Record<string, unknown>, depth: number): string[] {
  const type = String(node['AXType'] ?? node['type'] ?? node['AXRole'] ?? '');
  const label = String(node['AXLabel'] ?? node['label'] ?? '');
  const value = String(node['AXValue'] ?? node['value'] ?? '');
  const role = String(node['AXRole'] ?? node['role'] ?? '');
  const enabled = node['AXEnabled'] ?? node['enabled'];
  const frame = node['AXFrame'] ?? node['frame'];

  const indent = '  '.repeat(depth);
  const parts: string[] = [type || 'element'];
  if (role && role !== type) parts.push(`role=${role}`);
  if (label) parts.push(`"${label}"`);
  if (value && value !== label) parts.push(`value="${value}"`);
  if (enabled === false || enabled === 0) parts.push('[disabled]');
  if (frame && typeof frame === 'object') {
    const f = frame as Record<string, number>;
    if (f.x != null && f.y != null)
      parts.push(
        `frame=(${Math.round(f.x)},${Math.round(f.y)},${Math.round(f.width ?? 0)},${Math.round(f.height ?? 0)})`
      );
  }

  const out: string[] = [];
  if (parts.length > 1 || depth === 0) {
    out.push(`${indent}- ${parts.join(' ')}`);
  }
  const children = (node['children'] ?? node['AXChildren']) as
    | Record<string, unknown>[]
    | undefined;
  if (Array.isArray(children)) {
    for (const child of children) {
      out.push(...formatIosNode(child, depth + 1));
    }
  }
  return out;
}

/* ─── 스키마 ─── */

const schema = z.object({
  platform: z.enum(['ios', 'android']).describe('Target platform.'),
  mode: z
    .enum(['all', 'point'])
    .optional()
    .default('all')
    .describe('iOS: "all" or "point" at (x,y). Android: ignored.'),
  x: z.number().optional().describe('X in points. iOS, required for mode=point.'),
  y: z.number().optional().describe('Y in points. iOS, required for mode=point.'),
  nested: z
    .boolean()
    .optional()
    .default(false)
    .describe('iOS: hierarchical tree. Android: ignored.'),
  deviceId: z.string().optional().describe('Device ID. Auto if single. list_devices to find.'),
});

export function registerDescribeUi(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'describe_ui',
    {
      description:
        'Query native UI/accessibility tree. Large payload. Prefer query_selector for RN elements.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, mode, x, y, nested, deviceId } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (mode === 'point' && (x == null || y == null)) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: 'x and y coordinates are required when mode is "point".',
                },
              ],
            };
          }
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          const cmd: string[] = [];
          if (mode === 'point') {
            // idb expects integer arguments for describe-point
            const ix = Math.round(x!);
            const iy = Math.round(y!);
            cmd.push('ui', 'describe-point', String(ix), String(iy));
          } else {
            cmd.push('ui', 'describe-all');
          }
          if (nested) cmd.push('--nested');
          cmd.push('--json');
          const output = await runIdbCommand(cmd, udid, { timeoutMs: 15000 });
          const compact = iosJsonToCompact(output);
          return {
            content: [{ type: 'text' as const, text: compact }],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          const remotePath = '/sdcard/ui_dump.xml';
          await runAdbCommand(['shell', 'uiautomator', 'dump', remotePath], serial, {
            timeoutMs: 15000,
          });
          const xml = await runAdbCommand(['exec-out', 'cat', remotePath], serial, {
            timeoutMs: 10000,
          });
          runAdbCommand(['shell', 'rm', '-f', remotePath], serial).catch(() => {});

          let output: string;
          try {
            output = xmlToCompact(xml);
          } catch {
            output = xml;
          }
          return {
            content: [{ type: 'text' as const, text: output }],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `describe_ui failed: ${message}` }],
        };
      }
    }
  );
}
