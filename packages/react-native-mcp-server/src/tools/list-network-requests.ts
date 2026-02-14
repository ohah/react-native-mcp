/**
 * MCP 도구: list_network_requests, get_network_request
 * Chrome DevTools MCP 스펙. CDP 가로채기에서 Network.* 이벤트 수집
 * @see docs/chrome-devtools-mcp-spec-alignment.md
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// CDP 기능 보류 — 이 파일은 현재 index.ts에서 등록되지 않음.
// CDP 복구 시 metro-cdp.ts에 fetchCdpEvents, CdpEventEntry를 다시 추가해야 함.

interface CdpEventEntry {
  direction: string;
  method: string;
  params?: unknown;
  id?: number;
  timestamp: number;
}

async function fetchCdpEvents(): Promise<CdpEventEntry[]> {
  return [];
}

interface NetworkEntry {
  requestId: string;
  url: string;
  method: string;
  responseStatus?: number;
  responseStatusText?: string;
  receivedTime: number;
}

function buildNetworkList(events: CdpEventEntry[]): NetworkEntry[] {
  const byId = new Map<string, NetworkEntry>();
  for (const ev of events) {
    if (ev.direction !== 'device') continue;
    const params = ev.params as Record<string, unknown> | undefined;
    const requestId = params?.requestId as string | undefined;
    if (!requestId) continue;

    if (ev.method === 'Network.requestWillBeSent') {
      const request = params.request as { url?: string; method?: string } | undefined;
      byId.set(requestId, {
        requestId,
        url: request?.url ?? '',
        method: request?.method ?? 'GET',
        receivedTime: ev.timestamp,
      });
    } else if (ev.method === 'Network.responseReceived') {
      const entry = byId.get(requestId);
      if (entry) {
        const response = params.response as { status?: number; statusText?: string } | undefined;
        entry.responseStatus = response?.status;
        entry.responseStatusText = response?.statusText;
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.receivedTime - b.receivedTime);
}

const listSchema = z.object({
  pageIdx: z.number().optional().describe('Page number (0-based). Omit for first page.'),
  pageSize: z.number().optional().describe('Max requests to return. Omit for all.'),
  resourceTypes: z.array(z.string()).optional().describe('Filter by resource type. Omit for all.'),
  includePreservedRequests: z
    .boolean()
    .optional()
    .describe('Include preserved requests. RN: same list.'),
});

const getSchema = z.object({
  reqid: z.string().describe('Request ID (requestId) from list_network_requests'),
});

function serverRegister(server: McpServer) {
  return server as {
    registerTool(
      name: string,
      def: { description: string; inputSchema: z.ZodTypeAny },
      handler: (args: unknown) => Promise<unknown>
    ): void;
  };
}

export function registerListNetworkRequests(server: McpServer): void {
  const s = serverRegister(server);
  s.registerTool(
    'list_network_requests',
    {
      description:
        'List network requests for the current page. Uses Metro CDP events. Set METRO_BASE_URL if Metro runs on non-default port.',
      inputSchema: listSchema,
    },
    async (args: unknown) => {
      const params = listSchema.parse(args);
      try {
        const events = await fetchCdpEvents();
        let list = buildNetworkList(events);
        const pageIdx = params.pageIdx ?? 0;
        const pageSize = params.pageSize;
        const slice =
          pageSize != null && pageSize > 0
            ? list.slice(pageIdx * pageSize, (pageIdx + 1) * pageSize)
            : list;
        const lines: string[] = [];
        if (pageSize != null && pageSize > 0 && list.length > 0) {
          const totalPages = Math.ceil(list.length / pageSize);
          lines.push(
            `Showing page ${pageIdx + 1} of ${totalPages}, ${slice.length} of ${list.length} requests.`
          );
        }
        for (const r of slice) {
          lines.push(`reqid=${r.requestId} ${r.method} ${r.url} ${r.responseStatus ?? '-'}`);
        }
        return {
          content: [{ type: 'text' as const, text: lines.join('\n') || 'No network requests.' }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `list_network_requests failed: ${message}` }],
        };
      }
    }
  );
  s.registerTool(
    'get_network_request',
    {
      description:
        'Get details of a network request by reqid (requestId from list_network_requests).',
      inputSchema: getSchema,
    },
    async (args: unknown) => {
      const { reqid } = getSchema.parse(args);
      try {
        const events = await fetchCdpEvents();
        const list = buildNetworkList(events);
        const entry = list.find((r) => r.requestId === reqid);
        if (!entry) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Network request not found for reqid ${reqid}. Use list_network_requests to get valid reqids.`,
              },
            ],
          };
        }
        const lines = [
          `requestId: ${entry.requestId}`,
          `url: ${entry.url}`,
          `method: ${entry.method}`,
          ...(entry.responseStatus != null ? [`responseStatus: ${entry.responseStatus}`] : []),
          ...(entry.responseStatusText != null
            ? [`responseStatusText: ${entry.responseStatusText}`]
            : []),
        ];
        return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `get_network_request failed: ${message}` }],
        };
      }
    }
  );
}
