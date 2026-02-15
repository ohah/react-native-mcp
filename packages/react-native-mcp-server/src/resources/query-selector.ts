import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { querySelectorGuide } from '../guides/query-selector.js';

export function registerQuerySelectorResource(server: McpServer): void {
  server.registerResource(
    querySelectorGuide.name,
    `docs://guides/${querySelectorGuide.name}`,
    {
      description: querySelectorGuide.description,
      mimeType: 'text/markdown',
    },
    () => ({
      contents: [
        {
          uri: `docs://guides/${querySelectorGuide.name}`,
          text: querySelectorGuide.content,
          mimeType: 'text/markdown',
        },
      ],
    })
  );
}
