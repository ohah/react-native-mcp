/**
 * MCP 도구: scroll
 * 등록된 ScrollView ref(testID)로 scrollTo 호출. 앱에서 registerScrollRef(testID, ref) 필요.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';

const schema = z.object({
  uid: z.string().describe('ScrollView의 testID (앱에서 registerScrollRef로 등록 필요)'),
  y: z.number().optional().describe('세로 오프셋(픽셀). 기본 0.'),
  x: z.number().optional().describe('가로 오프셋(픽셀). 기본 0.'),
  animated: z.boolean().optional().describe('애니메이션 여부. 기본 true.'),
});

export function registerScroll(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'scroll',
    {
      description:
        '지정한 testID(uid)의 ScrollView를 스크롤. 앱에서 __REACT_NATIVE_MCP__.registerScrollRef(testID, ref)로 ScrollView ref 등록 필요. scrollTo({ x, y, animated }) 사용.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const parsed = schema.safeParse(args);
      const uid = parsed.success ? parsed.data.uid : (args as { uid?: string })?.uid;
      const y = parsed.success ? parsed.data.y : (args as { y?: number })?.y;
      const x = parsed.success ? parsed.data.x : (args as { x?: number })?.x;
      const animated = parsed.success
        ? parsed.data.animated
        : (args as { animated?: boolean })?.animated;

      if (typeof uid !== 'string') {
        return { content: [{ type: 'text' as const, text: 'uid (testID) is required.' }] };
      }

      if (!appSession.isConnected()) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No React Native app connected. Start the app with Metro and ensure the MCP runtime is loaded.',
            },
          ],
        };
      }

      const options = { x: x ?? 0, y: y ?? 0, animated: animated !== false };
      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.scrollTo ? __REACT_NATIVE_MCP__.scrollTo(${JSON.stringify(uid)}, ${JSON.stringify(options)}) : { ok: false, error: 'scrollTo not available' }; })();`;
      try {
        const res = await appSession.sendRequest({ method: 'eval', params: { code } });
        if (res.error != null) {
          return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] };
        }
        const out = res.result;
        const ok = out && typeof out.ok === 'boolean' ? out.ok : false;
        const text = ok
          ? `scrolled to x=${options.x}, y=${options.y}`
          : out && out.error
            ? out.error
            : 'scrollTo failed';
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `scroll failed: ${message}` }] };
      }
    }
  );
}
