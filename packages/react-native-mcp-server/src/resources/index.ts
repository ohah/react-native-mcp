import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerQuerySelectorResource } from './query-selector.js';
import { registerAppLifecycleResource } from './app-lifecycle.js';

export function registerAllResources(server: McpServer): void {
  registerQuerySelectorResource(server);
  registerAppLifecycleResource(server);
}
