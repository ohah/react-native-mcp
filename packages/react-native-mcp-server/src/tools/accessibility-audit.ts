/**
 * MCP 도구: accessibility_audit
 * Fiber 트리 순회로 접근성(a11y) 규칙 위반 자동 검출.
 * 규칙: pressable-needs-label, image-needs-alt, touch-target-size, missing-role.
 * text-contrast는 미구현(어려움: RN processColor 숫자화·스타일 병합으로 대비비 계산 불가).
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  maxDepth: z.number().int().min(1).max(100).optional().describe('Max tree depth. Default 999.'),
  deviceId: deviceParam,
  platform: platformParam,
});

export function registerAccessibilityAudit(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'accessibility_audit',
    {
      description:
        'Run a11y audit on RN tree. Returns violations: rule, selector, severity, message. Rules: pressable-needs-label, image-needs-alt, touch-target-size, missing-role.',
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
      const maxDepth = parsed.success && parsed.data.maxDepth != null ? parsed.data.maxDepth : 999;
      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getAccessibilityAudit ? __REACT_NATIVE_MCP__.getAccessibilityAudit({ maxDepth: ${maxDepth} }) : []; })();`;
      try {
        const res = await appSession.sendRequest(
          { method: 'eval', params: { code } },
          15000,
          deviceId,
          platform
        );
        if (res.error != null) {
          return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] };
        }
        const violations = Array.isArray(res.result) ? res.result : [];
        const text = JSON.stringify(violations, null, 2);
        return {
          content: [{ type: 'text' as const, text }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `accessibility_audit failed: ${message}`,
            },
          ],
        };
      }
    }
  );
}
