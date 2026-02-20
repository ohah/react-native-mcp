import {
  networkRequests,
  nextNetworkRequestId,
  NETWORK_BUFFER_SIZE,
  NETWORK_BODY_LIMIT,
} from './shared';

/** 같은 요청(url + method + startTime 근접)이 fetch/XHR 양쪽에서 기록될 때 하나로 묶기 위한 허용 시간(ms) */
const SAME_REQUEST_MS = 15;

// ─── 네트워크 캡처 공통 헬퍼 ─────────────────────────────────────
export function pushNetworkEntry(entry: any): void {
  const start = entry.startTime ?? 0;
  const existing = networkRequests.find(
    (e: any) =>
      e.url === entry.url &&
      e.method === entry.method &&
      Math.abs((e.startTime ?? 0) - start) <= SAME_REQUEST_MS
  );
  if (existing) {
    if (entry.status != null) existing.status = entry.status;
    if (entry.statusText != null) existing.statusText = entry.statusText;
    if (entry.responseHeaders != null) existing.responseHeaders = entry.responseHeaders;
    if (entry.responseBody != null) existing.responseBody = entry.responseBody;
    if (entry.duration != null) existing.duration = entry.duration;
    if (entry.state != null) existing.state = entry.state;
    if (entry.error != null) existing.error = entry.error;
    if (entry.mocked != null) existing.mocked = entry.mocked;
    return;
  }
  entry.id = nextNetworkRequestId();
  networkRequests.push(entry);
  if (networkRequests.length > NETWORK_BUFFER_SIZE) networkRequests.shift();
}

export function truncateBody(body: any): string | null {
  if (body == null) return null;
  var s = typeof body === 'string' ? body : String(body);
  return s.length > NETWORK_BODY_LIMIT ? s.substring(0, NETWORK_BODY_LIMIT) : s;
}
