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

function xmlToJson(xml: string): string {
  const parsed = xmlParser.parse(xml) as {
    hierarchy?: { node?: UiNode[] } & Record<string, unknown>;
  };
  const hierarchy = parsed.hierarchy;
  if (!hierarchy) return JSON.stringify(parsed, null, 2);

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(hierarchy)) {
    if (k === 'node') continue;
    if (v !== '' && v !== 'false') result[k] = v;
  }
  if (hierarchy.node) {
    result.children = hierarchy.node.map(stripEmpty);
  }
  return JSON.stringify(result, null, 2);
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
          return {
            content: [{ type: 'text' as const, text: output }],
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
            output = xmlToJson(xml);
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
