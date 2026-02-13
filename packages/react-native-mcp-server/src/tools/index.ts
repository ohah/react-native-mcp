/**
 * MCP 도구 등록 집합
 * DESIGN.md Phase 1~5 로드맵에 따라 도구 추가
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { registerEvalCode } from './eval-code.js';

export function registerAllTools(server: McpServer, appSession: AppSession): void {
  registerEvalCode(server, appSession);
}
