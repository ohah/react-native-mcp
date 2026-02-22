/**
 * MCP 도구: start_render_highlight, stop_render_highlight
 * react-scan 스타일 시각적 리렌더 하이라이트를 디바이스 화면에 표시.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const startSchema = z.object({
  components: z
    .array(z.string())
    .optional()
    .describe('Whitelist: highlight only these components. Overrides ignore.'),
  ignore: z
    .array(z.string())
    .optional()
    .describe('Blacklist: skip these components (added to default ignore list).'),
  showLabels: z
    .boolean()
    .optional()
    .describe('Show component name labels on each highlight rect. Default: false.'),
  fadeTimeout: z
    .number()
    .optional()
    .describe('Milliseconds before highlights fade out. Default: 500 (react-scan native align).'),
  maxHighlights: z
    .number()
    .optional()
    .describe('Maximum simultaneous highlights on screen. Default: 100.'),
  deviceId: deviceParam,
  platform: platformParam,
});

const stopSchema = z.object({
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

export function registerRenderOverlay(server: McpServer, appSession: AppSession): void {
  const s = server as unknown as ServerWithRegisterTool;

  // ─── start_render_highlight ─────────────────────────────────────
  s.registerTool(
    'start_render_highlight',
    {
      description:
        'Show visual re-render overlay on device. Highlights re-rendering components with count badges.',
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
      if (parsed.success && parsed.data.components) options.components = parsed.data.components;
      if (parsed.success && parsed.data.ignore) options.ignore = parsed.data.ignore;
      if (parsed.success && parsed.data.showLabels != null)
        options.showLabels = parsed.data.showLabels;
      if (parsed.success && parsed.data.fadeTimeout != null)
        options.fadeTimeout = parsed.data.fadeTimeout;
      if (parsed.success && parsed.data.maxHighlights != null)
        options.maxHighlights = parsed.data.maxHighlights;

      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.startRenderHighlight ? __REACT_NATIVE_MCP__.startRenderHighlight(${JSON.stringify(options)}) : null; })();`;

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
          filterMsg = ' Highlighting all components (default ignore applied).';
        }
        return {
          content: [{ type: 'text' as const, text: `Render highlighting started.${filterMsg}` }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `start_render_highlight failed: ${message}` }],
        };
      }
    }
  );

  // ─── stop_render_highlight ──────────────────────────────────────
  s.registerTool(
    'stop_render_highlight',
    {
      description:
        'Stop React component render overlay. Removes highlight rects and resets counts.',
      inputSchema: stopSchema,
    },
    async (args: unknown) => {
      const parsed = stopSchema.safeParse(args ?? {});
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

      const code = `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.stopRenderHighlight) { return __REACT_NATIVE_MCP__.stopRenderHighlight(); } return null; })();`;

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
          content: [
            {
              type: 'text' as const,
              text: 'Render highlighting stopped. All highlights removed.',
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `stop_render_highlight failed: ${message}` }],
        };
      }
    }
  );
}
