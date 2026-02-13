/**
 * Metro CDP 이벤트 조회 (GET /__mcp_cdp_events__)
 * cdp-interceptor.cjs가 수집한 이벤트를 MCP 도구에서 사용.
 * Metro 포트: 앱 연결 시 앱이 전송한 metroBaseUrl 우선, 없으면 METRO_BASE_URL env, 기본 8230.
 */

const DEFAULT_METRO_BASE_URL = 'http://localhost:8230';
const CDP_EVENTS_PATH = '/__mcp_cdp_events__';

/** 앱이 WebSocket 연결 시 보낸 Metro origin (스크립트 로드 출처) */
let metroBaseUrlFromApp: string | null = null;

export function setMetroBaseUrlFromApp(url: string | null): void {
  metroBaseUrlFromApp = url;
}

export function getMetroBaseUrl(): string {
  return metroBaseUrlFromApp ?? process.env.METRO_BASE_URL ?? DEFAULT_METRO_BASE_URL;
}

export interface CdpEventEntry {
  direction: string;
  method: string;
  params?: unknown;
  id?: number;
  timestamp: number;
}

export interface CdpEventsResponse {
  events: CdpEventEntry[];
}

export async function fetchCdpEvents(): Promise<CdpEventEntry[]> {
  const base = getMetroBaseUrl().replace(/\/$/, '');
  const url = `${base}${CDP_EVENTS_PATH}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Metro CDP events failed: ${res.status} ${res.statusText}. Ensure Metro is running with cdp-interceptor (require in metro.config.js).`
    );
  }
  const data = (await res.json()) as CdpEventsResponse;
  return data.events ?? [];
}
