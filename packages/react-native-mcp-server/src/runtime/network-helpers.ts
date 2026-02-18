import {
  networkRequests,
  nextNetworkRequestId,
  NETWORK_BUFFER_SIZE,
  NETWORK_BODY_LIMIT,
} from './shared';

// ─── 네트워크 캡처 공통 헬퍼 ─────────────────────────────────────
export function pushNetworkEntry(entry: any): void {
  entry.id = nextNetworkRequestId();
  networkRequests.push(entry);
  if (networkRequests.length > NETWORK_BUFFER_SIZE) networkRequests.shift();
}

export function truncateBody(body: any): string | null {
  if (body == null) return null;
  var s = typeof body === 'string' ? body : String(body);
  return s.length > NETWORK_BODY_LIMIT ? s.substring(0, NETWORK_BODY_LIMIT) : s;
}
