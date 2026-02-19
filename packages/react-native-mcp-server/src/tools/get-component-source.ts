/**
 * MCP 도구: get_component_source
 * 셀렉터 또는 uid로 컴포넌트를 지정하면, _debugStack + Metro 소스맵으로 원본 파일/라인을 반환.
 * 에디터에서 "해당 코드로 이동"에 사용.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';
import { getSourcePosition } from '../symbolicate.js';

const schema = z.object({
  selector: z
    .string()
    .optional()
    .describe('Selector to find the component. If omitted, uid is required.'),
  uid: z
    .string()
    .optional()
    .describe(
      'uid from take_snapshot (testID or path like "0.1.2"). If omitted, selector is required.'
    ),
  deviceId: deviceParam,
  platform: platformParam,
});

export function registerGetComponentSource(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'get_component_source',
    {
      description:
        'Resolve component to source location (file, line, column) via _debugStack and Metro source map. Use selector or uid from take_snapshot. Returns path suitable for opening in editor.',
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

      let uid: string | null = null;
      if (parsed.success && parsed.data.uid) {
        uid = parsed.data.uid;
      } else if (parsed.success && parsed.data.selector) {
        const code = `(function(){ var M = typeof __REACT_NATIVE_MCP__ !== 'undefined' ? __REACT_NATIVE_MCP__ : null; if (!M || !M.querySelector) return null; var r = M.querySelector(${JSON.stringify(parsed.data.selector)}); return r && r.uid != null ? r.uid : null; })();`;
        try {
          const res = await appSession.sendRequest(
            { method: 'eval', params: { code } },
            5000,
            deviceId,
            platform
          );
          if (res.error != null) {
            return {
              content: [{ type: 'text' as const, text: `querySelector error: ${res.error}` }],
            };
          }
          uid = typeof res.result === 'string' ? res.result : null;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { content: [{ type: 'text' as const, text: `eval failed: ${msg}` }] };
        }
      }

      if (!uid) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Provide either selector or uid. No matching component or missing uid from selector.',
            },
          ],
        };
      }

      const refCode = `(function(){ var M = typeof __REACT_NATIVE_MCP__ !== 'undefined' ? __REACT_NATIVE_MCP__ : null; return M && M.getSourceRefForUid ? M.getSourceRefForUid(${JSON.stringify(uid)}) : []; })();`;
      let refs: Array<{ bundleUrl: string; line: number; column: number }> = [];
      try {
        const res = await appSession.sendRequest(
          { method: 'eval', params: { code: refCode } },
          5000,
          deviceId,
          platform
        );
        if (res.error != null) {
          return {
            content: [{ type: 'text' as const, text: `getSourceRefForUid error: ${res.error}` }],
          };
        }
        const r = res.result;
        if (Array.isArray(r)) {
          for (const ref of r) {
            if (
              ref &&
              typeof ref === 'object' &&
              typeof ref.bundleUrl === 'string' &&
              typeof ref.line === 'number'
            ) {
              refs.push({
                bundleUrl: ref.bundleUrl,
                line: ref.line,
                column: typeof ref.column === 'number' ? ref.column : 0,
              });
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `eval getSourceRefForUid failed: ${msg}` }],
        };
      }

      if (refs.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No source ref for this component (_debugStack missing or not available for this fiber).',
            },
          ],
        };
      }

      try {
        const isAppSource = (source: string) =>
          !source.includes('node_modules/react') && !source.includes('node_modules/react-native');
        let firstOk: {
          source: string;
          line: number | null;
          column: number | null;
          name?: string;
        } | null = null;
        for (const ref of refs) {
          const pos = await getSourcePosition(ref.bundleUrl, ref.line, ref.column, {
            useCache: true,
          });
          if (!pos.ok) continue;
          if (!firstOk) firstOk = pos;
          if (!isAppSource(pos.source)) continue;
          const text = JSON.stringify(
            {
              filePath: pos.source,
              lineNumber: pos.line ?? 0,
              columnNumber: pos.column ?? 0,
              name: pos.name,
            },
            null,
            2
          );
          return { content: [{ type: 'text' as const, text }] };
        }
        if (firstOk) {
          const text = JSON.stringify(
            {
              filePath: firstOk.source,
              lineNumber: firstOk.line ?? 0,
              columnNumber: firstOk.column ?? 0,
              name: firstOk.name,
            },
            null,
            2
          );
          return { content: [{ type: 'text' as const, text }] };
        }
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Could not resolve source position for any stack frame.',
            },
          ],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Symbolicate failed: ${msg}` }],
        };
      }
    }
  );
}
