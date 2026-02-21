/**
 * Health check 및 메트릭용 HTTP 서버.
 * WebSocket 서버(12300)와 별도 포트에서 GET /health, GET /metrics 제공.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AppSession } from './websocket-server.js';

const DEFAULT_HEALTH_PORT = 12301;

function getHealthPort(): number {
  const env = process.env.REACT_NATIVE_MCP_HEALTH_PORT;
  if (env == null || env === '') return DEFAULT_HEALTH_PORT;
  if (env === '0') return 0;
  const n = parseInt(env, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_HEALTH_PORT;
}

export function startHealthServer(appSession: AppSession, wsPort: number): Server {
  const port = getHealthPort();
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    if (method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed');
      return;
    }

    if (url === '/health' || url === '/health/') {
      const status = appSession.getConnectionStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          wsPort,
          hasServer: status.hasServer,
          deviceCount: status.deviceCount,
        })
      );
      return;
    }

    if (url === '/metrics' || url === '/metrics/') {
      const status = appSession.getConnectionStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          deviceCount: status.deviceCount,
          connected: status.connected,
        })
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  if (port === 0) {
    return server; // Disabled (REACT_NATIVE_MCP_HEALTH_PORT=0)
  }

  server.listen(port, '127.0.0.1', () => {
    console.error(
      `[react-native-mcp-server] Health server listening on http://127.0.0.1:${port} (GET /health, GET /metrics)`
    );
  });

  server.on('error', (err) => {
    console.error('[react-native-mcp-server] Health server error:', err.message);
  });

  return server;
}
