/**
 * MCP 도구: adb_describe
 * uiautomator dump → fast-xml-parser로 JSON 변환하여 반환.
 * 빈 속성 제거로 토큰 절약.
 */

import { z } from 'zod';
import { XMLParser } from 'fast-xml-parser';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  checkAdbAvailable,
  resolveSerial,
  runAdbCommand,
  adbNotInstalledError,
} from './adb-utils.js';

/* ─── XML → JSON 변환 ─── */

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  // node 배열을 항상 배열로 유지
  isArray: (name) => name === 'node',
});

interface UiNode {
  [key: string]: unknown;
  node?: UiNode[];
}

/** 빈 문자열·false 불리언 속성 제거, children 재귀 처리 */
function stripEmpty(node: UiNode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'node') continue; // children은 별도 처리
    if (v === '' || v === 'false') continue; // 빈 값·false 제거
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
  // hierarchy 속성 (rotation 등)
  for (const [k, v] of Object.entries(hierarchy)) {
    if (k === 'node') continue;
    if (v !== '' && v !== 'false') result[k] = v;
  }
  if (hierarchy.node) {
    result.children = hierarchy.node.map(stripEmpty);
  }
  return JSON.stringify(result, null, 2);
}

/* ─── 도구 등록 ─── */

const schema = z.object({
  serial: z
    .string()
    .optional()
    .describe(
      'Device serial. Auto-resolved if only one device is connected. Use adb_list_devices to find serials.'
    ),
});

export function registerAdbDescribe(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'adb_describe',
    {
      description:
        'Dump Android UI hierarchy (XML) via uiautomator. Returns JSON with all visible elements, their bounds, text, content-desc, resource-id, etc. WARNING: Large payload (high token cost). For React Native elements, prefer evaluate_script with measureView(testID). Use adb_describe for native-only elements or debugging layout.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { serial } = schema.parse(args);

      if (!(await checkAdbAvailable())) return adbNotInstalledError();

      try {
        const targetSerial = await resolveSerial(serial);

        // dump to file → cat → cleanup
        const remotePath = '/sdcard/ui_dump.xml';
        await runAdbCommand(['shell', 'uiautomator', 'dump', remotePath], targetSerial, {
          timeoutMs: 15000,
        });
        const xml = await runAdbCommand(['exec-out', 'cat', remotePath], targetSerial, {
          timeoutMs: 10000,
        });
        // Cleanup temp file (best-effort)
        runAdbCommand(['shell', 'rm', '-f', remotePath], targetSerial).catch(() => {});

        // XML → JSON 변환 (실패 시 원본 XML fallback)
        let output: string;
        try {
          output = xmlToJson(xml);
        } catch {
          output = xml;
        }

        return {
          content: [{ type: 'text' as const, text: output }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `adb_describe failed: ${message}` }],
        };
      }
    }
  );
}
