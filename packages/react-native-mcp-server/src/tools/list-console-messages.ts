/**
 * MCP 도구: list_console_messages, get_console_message
 * Chrome DevTools MCP 스펙. CDP 가로채기(/__mcp_cdp_events__)에서 Runtime.consoleAPICalled 등 수집
 * @see docs/chrome-devtools-mcp-spec-alignment.md
 * @see https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md
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

const CONSOLE_METHODS = new Set([
  'Runtime.consoleAPICalled',
  'Log.entryAdded',
  'Runtime.exceptionThrown',
]);

function parseConsoleEvent(
  ev: CdpEventEntry
): { level: string; text: string; url?: string; line?: number; column?: number } | null {
  const method = ev.method;
  const params = ev.params as Record<string, unknown> | undefined;
  if (!params) return null;

  if (method === 'Runtime.consoleAPICalled') {
    const args = (params.args as Array<{ type?: string; value?: unknown }>) ?? [];
    const text = args.map((a) => (a?.value != null ? String(a.value) : '')).join(' ');
    const type = (params.type as string) ?? 'log';
    return { level: type, text, url: undefined, line: undefined, column: undefined };
  }
  if (method === 'Log.entryAdded') {
    const entry = params.entry as
      | { level?: string; text?: string; url?: string; lineNumber?: number }
      | undefined;
    if (!entry) return null;
    return {
      level: entry.level ?? 'verbose',
      text: entry.text ?? '',
      url: entry.url,
      line: entry.lineNumber,
      column: undefined,
    };
  }
  if (method === 'Runtime.exceptionThrown') {
    const ex = params.exceptionDetails as
      | {
          text?: string;
          exception?: { description?: string };
          url?: string;
          lineNumber?: number;
          columnNumber?: number;
        }
      | undefined;
    if (!ex) return null;
    const text = ex.exception?.description ?? ex.text ?? JSON.stringify(ex);
    return {
      level: 'error',
      text,
      url: ex.url,
      line: ex.lineNumber,
      column: ex.columnNumber,
    };
  }
  return null;
}

function buildConsoleList(events: CdpEventEntry[]): Array<{
  msgid: number;
  level: string;
  text: string;
  url?: string;
  line?: number;
  column?: number;
  timestamp: number;
}> {
  const out: Array<{
    msgid: number;
    level: string;
    text: string;
    url?: string;
    line?: number;
    column?: number;
    timestamp: number;
  }> = [];
  let msgid = 1;
  for (const ev of events) {
    if (ev.direction !== 'device' || !CONSOLE_METHODS.has(ev.method)) continue;
    const parsed = parseConsoleEvent(ev);
    if (!parsed) continue;
    out.push({
      msgid: msgid++,
      level: parsed.level,
      text: parsed.text,
      url: parsed.url,
      line: parsed.line,
      column: parsed.column,
      timestamp: ev.timestamp,
    });
  }
  return out;
}

const listSchema = z.object({
  pageIdx: z.number().optional().describe('Page number (0-based). Omit for first page.'),
  pageSize: z.number().optional().describe('Max messages to return. Omit for all.'),
  types: z
    .array(z.string())
    .optional()
    .describe('Filter by level: log, warning, error, etc. Omit for all.'),
  includePreservedMessages: z
    .boolean()
    .optional()
    .describe('If true, return preserved messages over last navigations. RN: same list.'),
});

const getSchema = z.object({
  msgid: z.number().describe('Message ID from list_console_messages'),
});

const serverRegister = (server: McpServer) =>
  server as {
    registerTool(
      name: string,
      def: { description: string; inputSchema: z.ZodTypeAny },
      handler: (args: unknown) => Promise<unknown>
    ): void;
  };

export function registerListConsoleMessages(server: McpServer): void {
  const s = serverRegister(server);
  s.registerTool(
    'list_console_messages',
    {
      description:
        'List console messages for the current page since last navigation. Uses Metro CDP events. Set METRO_BASE_URL if Metro runs on non-default port.',
      inputSchema: listSchema,
    },
    async (args: unknown) => {
      const params = listSchema.parse(args);
      try {
        const events = await fetchCdpEvents();
        let list = buildConsoleList(events);
        if (params.types && params.types.length > 0) {
          const set = new Set(params.types.map((t) => t.toLowerCase()));
          list = list.filter((m) => set.has(m.level.toLowerCase()));
        }
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
            `Showing page ${pageIdx + 1} of ${totalPages}, ${slice.length} of ${list.length} messages.`
          );
        }
        for (const m of slice) {
          lines.push(
            `[${m.msgid}] ${m.level}: ${m.text}${m.url != null ? ` (${m.url}${m.line != null ? `:${m.line}` : ''})` : ''}`
          );
        }
        return {
          content: [{ type: 'text' as const, text: lines.join('\n') || 'No console messages.' }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `list_console_messages failed: ${message}` }],
        };
      }
    }
  );
  s.registerTool(
    'get_console_message',
    {
      description: 'Get a console message by its ID (msgid from list_console_messages).',
      inputSchema: getSchema,
    },
    async (args: unknown) => {
      const { msgid } = getSchema.parse(args);
      try {
        const events = await fetchCdpEvents();
        const list = buildConsoleList(events);
        const entry = list.find((m) => m.msgid === msgid);
        if (!entry) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Console message not found for msgid ${msgid}. Use list_console_messages to get valid msgids.`,
              },
            ],
          };
        }
        const text = [
          `msgid: ${entry.msgid}`,
          `level: ${entry.level}`,
          `text: ${entry.text}`,
          ...(entry.url != null ? [`url: ${entry.url}`] : []),
          ...(entry.line != null ? [`line: ${entry.line}`] : []),
          ...(entry.column != null ? [`column: ${entry.column}`] : []),
        ].join('\n');
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `get_console_message failed: ${message}` }],
        };
      }
    }
  );
}
