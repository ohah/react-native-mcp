/**
 * Metro Base URL 관리 (Multi-Device)
 * 디바이스별 metroBaseUrl 저장 및 조회.
 * CDP 이벤트 조회: GET /__mcp_cdp_events__ (cdp-interceptor)
 */

const DEFAULT_METRO_BASE_URL = 'http://localhost:8230';

/** CDP 이벤트 한 건 (cdp-interceptor eventStore 항목) */
export interface CdpEventEntry {
  direction: 'device' | 'debugger';
  method: string;
  params?: unknown;
  timestamp: number;
}

// ─── 디바이스별 Metro URL 관리 ──────────────────────────────────

/** deviceId → metroBaseUrl */
const deviceMetroUrls = new Map<string, string>();

let metroBaseUrlFromApp: string | null = null;

export function setMetroBaseUrlFromApp(url: string | null, deviceId?: string): void {
  if (deviceId) {
    if (url) {
      deviceMetroUrls.set(deviceId, url);
    } else {
      deviceMetroUrls.delete(deviceId);
    }
  } else {
    metroBaseUrlFromApp = url;
  }
}

export function getMetroBaseUrl(deviceId?: string): string {
  if (deviceId) {
    const url = deviceMetroUrls.get(deviceId);
    if (url) return url;
  }
  return metroBaseUrlFromApp ?? process.env.METRO_BASE_URL ?? DEFAULT_METRO_BASE_URL;
}

/**
 * CDP 이벤트 목록 조회. Metro에 cdp-interceptor 적용 시 GET /__mcp_cdp_events__ 사용.
 * @param deviceId - 대상 디바이스(선택). 생략 시 기본 Metro URL 사용.
 */
export async function fetchCdpEvents(deviceId?: string): Promise<CdpEventEntry[]> {
  const base = getMetroBaseUrl(deviceId).replace(/\/$/, '');
  const url = `${base}/__mcp_cdp_events__`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { events?: CdpEventEntry[] };
  return Array.isArray(data.events) ? data.events : [];
}
