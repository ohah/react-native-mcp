/**
 * CDP 직접 연결 클라이언트
 * 앱 연결 시 Metro /json에서 디버거 타겟을 발견하고 WebSocket으로 CDP에 직접 연결.
 * cdp-interceptor / node -r 불필요.
 */

import { WebSocket } from 'ws';

const DEFAULT_METRO_BASE_URL = 'http://localhost:8230';
const MAX_EVENTS = 2000;

export interface CdpEventEntry {
  direction: string;
  method: string;
  params?: unknown;
  id?: number;
  timestamp: number;
}

export interface CdpEventsResponse {
  events: CdpEventEntry[];
  lastEventTimestamp?: number | null;
}

// ─── CDP 클라이언트 ─────────────────────────────────────────────

class CdpClient {
  private ws: WebSocket | null = null;
  private events: CdpEventEntry[] = [];
  private nextId = 1;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Metro /json에서 타겟을 발견하고 CDP WebSocket에 연결 */
  async connect(metroBaseUrl: string): Promise<void> {
    this.disconnect();
    this.events = [];

    try {
      const res = await fetch(`${metroBaseUrl.replace(/\/$/, '')}/json`);
      if (!res.ok) return;
      const targets = (await res.json()) as Array<{
        webSocketDebuggerUrl?: string;
      }>;
      const target = targets?.[0];
      if (!target?.webSocketDebuggerUrl) return;

      this.connectWebSocket(target.webSocketDebuggerUrl, metroBaseUrl);
    } catch {
      // Metro not ready, retry in 2s
      this.reconnectTimer = setTimeout(() => this.connect(metroBaseUrl), 2000);
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getEvents(): CdpEventEntry[] {
    return this.events;
  }

  getLastEventTimestamp(): number | null {
    const last = this.events[this.events.length - 1];
    return last ? last.timestamp : null;
  }

  isConnected(): boolean {
    return this.ws != null && this.ws.readyState === WebSocket.OPEN;
  }

  private connectWebSocket(url: string, metroBaseUrl: string): void {
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.send('Runtime.enable');
      this.send('Network.enable');
      this.send('Log.enable');
      console.error('[react-native-mcp-server] CDP connected to', url);
    });

    this.ws.on('message', (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        // CDP 이벤트: method 있고 id 없음 (응답은 id만 있음)
        if (typeof msg.method === 'string') {
          this.pushEvent({
            direction: 'device',
            method: msg.method,
            params: msg.params,
            timestamp: Date.now(),
          });
        }
      } catch {}
    });

    this.ws.on('close', () => {
      this.ws = null;
      this.reconnectTimer = setTimeout(() => this.connect(metroBaseUrl), 2000);
    });

    this.ws.on('error', () => {
      this.ws = null;
    });
  }

  private send(method: string, params?: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ id: this.nextId++, method, params }));
    }
  }

  private pushEvent(event: CdpEventEntry): void {
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) this.events.shift();
  }
}

// ─── 싱글톤 + 공개 API ─────────────────────────────────────────

const cdpClient = new CdpClient();

let metroBaseUrlFromApp: string | null = null;

export function setMetroBaseUrlFromApp(url: string | null): void {
  metroBaseUrlFromApp = url;
  if (url) {
    cdpClient.connect(url).catch(() => {});
  } else {
    cdpClient.disconnect();
  }
}

export function getMetroBaseUrl(): string {
  return metroBaseUrlFromApp ?? process.env.METRO_BASE_URL ?? DEFAULT_METRO_BASE_URL;
}

/** CDP 이벤트 목록 반환 (in-memory) */
export async function fetchCdpEvents(): Promise<CdpEventEntry[]> {
  return cdpClient.getEvents();
}

/** CDP 이벤트 원시 응답 반환 (in-memory) */
export async function fetchCdpEventsRaw(): Promise<CdpEventsResponse> {
  const events = cdpClient.getEvents();
  return { events, lastEventTimestamp: cdpClient.getLastEventTimestamp() };
}

/** CDP WebSocket 연결 상태 */
export async function getDebuggerStatus(): Promise<{
  connected: boolean;
  lastEventTimestamp: number | null;
  eventCount: number;
}> {
  return {
    connected: cdpClient.isConnected(),
    lastEventTimestamp: cdpClient.getLastEventTimestamp(),
    eventCount: cdpClient.getEvents().length,
  };
}
