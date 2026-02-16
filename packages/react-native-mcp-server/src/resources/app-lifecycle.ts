import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { appLifecycleGuide } from '../guides/app-lifecycle.js';

export function registerAppLifecycleResource(server: McpServer): void {
  server.registerResource(
    appLifecycleGuide.name,
    `docs://guides/${appLifecycleGuide.name}`,
    {
      description: appLifecycleGuide.description,
      mimeType: 'text/markdown',
    },
    () => ({
      contents: [
        {
          uri: `docs://guides/${appLifecycleGuide.name}`,
          text: appLifecycleGuide.content,
          mimeType: 'text/markdown',
        },
      ],
    })
  );
}
