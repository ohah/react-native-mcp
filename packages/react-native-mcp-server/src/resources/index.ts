import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerQuerySelectorResource } from './query-selector.js';

export function registerAllResources(server: McpServer): void {
  registerQuerySelectorResource(server);
}
