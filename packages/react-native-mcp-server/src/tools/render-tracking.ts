/**
 * MCP 도구: start_render_profile, get_render_report, clear_render_profile
 * React 컴포넌트 리렌더 프로파일링 — 불필요 리렌더 탐지, 핫 컴포넌트 리포트.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const startSchema = z.object({
  components: z
    .array(z.string())
    .optional()
    .describe('Whitelist: track only these components. Overrides ignore.'),
  ignore: z
    .array(z.string())
    .optional()
    .describe(
      'Blacklist: skip these components (added to default ignore list). Ignored when components is set.'
    ),
  deviceId: deviceParam,
  platform: platformParam,
});

const reportSchema = z.object({
  deviceId: deviceParam,
  platform: platformParam,
});

const clearSchema = z.object({
  deviceId: deviceParam,
  platform: platformParam,
});

type ServerWithRegisterTool = {
  registerTool(
    name: string,
    def: { description: string; inputSchema: z.ZodTypeAny },
    handler: (args: unknown) => Promise<unknown>
  ): void;
};

export function registerRenderTracking(server: McpServer, appSession: AppSession): void {
  const s = server as unknown as ServerWithRegisterTool;

  // ─── start_render_profile ─────────────────────────────────────
  s.registerTool(
    'start_render_profile',
    {
      description:
        'Start React component render profiling (not JS/GPU engine). Tracks mounts, re-renders, and unnecessary renders. Optional `components` filter.',
      inputSchema: startSchema,
    },
    async (args: unknown) => {
      const parsed = startSchema.safeParse(args ?? {});
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

      const options: Record<string, unknown> = {};
      if (parsed.success && parsed.data.components) {
        options.components = parsed.data.components;
      }
      if (parsed.success && parsed.data.ignore) {
        options.ignore = parsed.data.ignore;
      }

      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.startRenderProfile ? __REACT_NATIVE_MCP__.startRenderProfile(${JSON.stringify(options)}) : null; })();`;

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
        let filterMsg = '';
        if (parsed.success && parsed.data.components) {
          filterMsg = ` Whitelist: ${parsed.data.components.join(', ')}`;
        } else if (parsed.success && parsed.data.ignore) {
          filterMsg = ` Ignoring: ${parsed.data.ignore.join(', ')} (+ defaults)`;
        } else {
          filterMsg = ' Tracking all components (default ignore applied).';
        }
        return {
          content: [{ type: 'text' as const, text: `Render profiling started.${filterMsg}` }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `start_render_profile failed: ${message}` }],
        };
      }
    }
  );

  // ─── get_render_report ────────────────────────────────────────
  s.registerTool(
    'get_render_report',
    {
      description:
        'Get React component render report (not engine perf). Hot components by render count, unnecessary renders (React.memo), recent details with trigger analysis.',
      inputSchema: reportSchema,
    },
    async (args: unknown) => {
      const parsed = reportSchema.safeParse(args ?? {});
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

      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getRenderReport ? __REACT_NATIVE_MCP__.getRenderReport() : null; })();`;

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
        if (!res.result) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No render profiling data. Call start_render_profile first.',
              },
            ],
          };
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(res.result, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `get_render_report failed: ${message}` }],
        };
      }
    }
  );

  // ─── clear_render_profile ─────────────────────────────────────
  s.registerTool(
    'clear_render_profile',
    {
      description:
        'Stop React component render profiling and clear collected data (not engine perf).',
      inputSchema: clearSchema,
    },
    async (args: unknown) => {
      const parsed = clearSchema.safeParse(args ?? {});
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

      const code = `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.clearRenderProfile) { __REACT_NATIVE_MCP__.clearRenderProfile(); return true; } return false; })();`;

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
        return {
          content: [{ type: 'text' as const, text: 'Render profiling stopped and data cleared.' }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `clear_render_profile failed: ${message}` }],
        };
      }
    }
  );
}
