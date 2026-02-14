import { GlobalRegistrator } from '@happy-dom/global-registrator';
try {
  await GlobalRegistrator.unregister();
} catch {}

import { describe, expect, it, afterEach, beforeEach } from 'bun:test';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import {
  setMetroBaseUrlFromApp,
  getMetroBaseUrl,
  fetchCdpEvents,
  fetchCdpEventsRaw,
  getDebuggerStatus,
} from '../tools/metro-cdp.ts';

// ─── Mock Metro + CDP 서버 ──────────────────────────────────────

let httpServer: http.Server;
let wss: WebSocketServer;
let serverPort: number;
let cdpConnections: WebSocket[];

function startMockMetro(): Promise<void> {
  return new Promise((resolve) => {
    cdpConnections = [];
    httpServer = http.createServer((req, res) => {
      if (req.url === '/json') {
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify([
            {
              id: 'test-target-1',
              title: 'Test App',
              webSocketDebuggerUrl: `ws://localhost:${serverPort}/inspector/debug`,
            },
          ])
        );
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    wss = new WebSocketServer({ noServer: true });
    httpServer.on('upgrade', (req, socket, head) => {
      wss.handleUpgrade(req, socket, head, (ws) => {
        cdpConnections.push(ws);
        wss.emit('connection', ws, req);
      });
    });

    httpServer.listen(0, () => {
      const addr = httpServer.address();
      serverPort = typeof addr === 'object' && addr ? addr.port : 0;
      resolve();
    });
  });
}

function stopMockMetro(): Promise<void> {
  return new Promise((resolve) => {
    for (const ws of cdpConnections) {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    }
    cdpConnections = [];
    wss.close();
    httpServer.close(() => resolve());
  });
}

/** CDP 이벤트를 연결된 클라이언트에 전송 */
function sendCdpEvent(method: string, params?: unknown) {
  for (const ws of cdpConnections) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ method, params }));
    }
  }
}

/** CDP 클라이언트가 연결될 때까지 대기 */
function waitForCdpConnection(timeoutMs = 3000): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    if (cdpConnections.length > 0) {
      resolve(cdpConnections[0]);
      return;
    }
    const timeout = setTimeout(() => reject(new Error('CDP connection timeout')), timeoutMs);
    wss.once('connection', (ws) => {
      clearTimeout(timeout);
      resolve(ws);
    });
  });
}

/** 짧은 대기 */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── 테스트 ─────────────────────────────────────────────────────

describe('getMetroBaseUrl', () => {
  afterEach(() => {
    setMetroBaseUrlFromApp(null);
    delete process.env.METRO_BASE_URL;
  });

  it('기본값은 http://localhost:8230', () => {
    expect(getMetroBaseUrl()).toBe('http://localhost:8230');
  });

  it('환경변수 METRO_BASE_URL 우선', () => {
    process.env.METRO_BASE_URL = 'http://localhost:9999';
    expect(getMetroBaseUrl()).toBe('http://localhost:9999');
  });

  it('앱이 전송한 metroBaseUrl이 최우선', () => {
    process.env.METRO_BASE_URL = 'http://localhost:9999';
    setMetroBaseUrlFromApp('http://localhost:7777');
    expect(getMetroBaseUrl()).toBe('http://localhost:7777');
  });
});

describe('CdpClient (via public API)', () => {
  beforeEach(async () => {
    await startMockMetro();
  });

  afterEach(async () => {
    setMetroBaseUrlFromApp(null);
    await wait(100); // disconnect 처리 대기
    await stopMockMetro();
  });

  it('앱 연결 시 자동으로 CDP WebSocket에 연결', async () => {
    setMetroBaseUrlFromApp(`http://localhost:${serverPort}`);
    const ws = await waitForCdpConnection();
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  it('연결 후 Runtime.enable, Network.enable, Log.enable 전송', async () => {
    const receivedMethods: string[] = [];

    setMetroBaseUrlFromApp(`http://localhost:${serverPort}`);
    const ws = await waitForCdpConnection();

    await new Promise<void>((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        receivedMethods.push(msg.method);
        if (receivedMethods.length >= 3) resolve();
      });
    });

    expect(receivedMethods).toContain('Runtime.enable');
    expect(receivedMethods).toContain('Network.enable');
    expect(receivedMethods).toContain('Log.enable');
  });

  it('CDP 이벤트를 수집하여 fetchCdpEvents로 반환', async () => {
    setMetroBaseUrlFromApp(`http://localhost:${serverPort}`);
    await waitForCdpConnection();
    await wait(50);

    sendCdpEvent('Runtime.consoleAPICalled', {
      type: 'log',
      args: [{ type: 'string', value: 'hello' }],
    });
    await wait(50);

    const events = await fetchCdpEvents();
    expect(events.length).toBeGreaterThanOrEqual(1);
    const consoleEvent = events.find((e) => e.method === 'Runtime.consoleAPICalled');
    expect(consoleEvent).toBeDefined();
    expect(consoleEvent!.direction).toBe('device');
  });

  it('fetchCdpEventsRaw는 lastEventTimestamp 포함', async () => {
    setMetroBaseUrlFromApp(`http://localhost:${serverPort}`);
    await waitForCdpConnection();
    await wait(50);

    sendCdpEvent('Network.requestWillBeSent', {
      requestId: '1',
      request: { url: 'https://example.com' },
    });
    await wait(50);

    const raw = await fetchCdpEventsRaw();
    expect(raw.events.length).toBeGreaterThanOrEqual(1);
    expect(raw.lastEventTimestamp).toBeGreaterThan(0);
  });

  it('getDebuggerStatus는 연결 상태 반환', async () => {
    // 연결 전
    const before = await getDebuggerStatus();
    expect(before.connected).toBe(false);

    // 연결 후 (connect()가 events 초기화)
    setMetroBaseUrlFromApp(`http://localhost:${serverPort}`);
    await waitForCdpConnection();
    await wait(50);

    const after = await getDebuggerStatus();
    expect(after.connected).toBe(true);
    expect(after.eventCount).toBe(0); // 새 연결이므로 이벤트 없음
  });

  it('disconnect 시 연결 해제', async () => {
    setMetroBaseUrlFromApp(`http://localhost:${serverPort}`);
    await waitForCdpConnection();
    await wait(50);

    const connected = await getDebuggerStatus();
    expect(connected.connected).toBe(true);

    setMetroBaseUrlFromApp(null);
    await wait(100);

    const disconnected = await getDebuggerStatus();
    expect(disconnected.connected).toBe(false);
  });

  it('CDP 응답(id만 있는 메시지)은 이벤트로 수집하지 않음', async () => {
    setMetroBaseUrlFromApp(`http://localhost:${serverPort}`);
    await waitForCdpConnection();
    await wait(50);

    // CDP 응답 (method 없음)
    for (const ws of cdpConnections) {
      ws.send(JSON.stringify({ id: 1, result: {} }));
    }
    // CDP 이벤트 (method 있음)
    sendCdpEvent('Runtime.consoleAPICalled', { type: 'log', args: [] });
    await wait(50);

    const events = await fetchCdpEvents();
    const hasResponse = events.some((e) => e.method === undefined);
    expect(hasResponse).toBe(false);

    const hasEvent = events.some((e) => e.method === 'Runtime.consoleAPICalled');
    expect(hasEvent).toBe(true);
  });
});
