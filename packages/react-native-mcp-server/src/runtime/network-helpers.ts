import {
  networkRequests,
  nextNetworkRequestId,
  NETWORK_BUFFER_SIZE,
  NETWORK_BODY_LIMIT,
} from './shared';

/** fetch가 id를 부여한 뒤 XHR(폴리필)이 같은 id를 쓰면 한 엔트리로 묶임. RECENT_FETCH_MS 내에만 매칭 */
const RECENT_FETCH_MS = 200;
let currentFetchRequest: { url: string; method: string; id: number; time: number } | null = null;

/** fetch 진입 시 호출. 이 요청용 request id를 등록해 두고, XHR이 takeCurrentFetchRequestId로 가져감 */
export function setCurrentFetchRequest(url: string, method: string, id: number): void {
  currentFetchRequest = { url, method, id, time: Date.now() };
}

/** XHR send 시 호출. 방금 시작한 fetch와 url+method가 같으면 그 fetch의 request id를 반환하고 초기화(한 번만 사용) */
export function takeCurrentFetchRequestId(url: string, method: string): number | null {
  if (!currentFetchRequest) return null;
  const now = Date.now();
  if (
    currentFetchRequest.url !== url ||
    currentFetchRequest.method !== method ||
    now - currentFetchRequest.time > RECENT_FETCH_MS
  ) {
    return null;
  }
  const id = currentFetchRequest.id;
  currentFetchRequest = null;
  return id;
}

// ─── 네트워크 캡처 공통 헬퍼 ─────────────────────────────────────
/** entry.id가 이미 있으면 기존 항목에 병합(id로 동일 요청 판단). 없으면 새 id 부여 후 push */
export function pushNetworkEntry(entry: any): void {
  const id = entry.id;
  if (id != null && id > 0) {
    const existing = networkRequests.find((e: any) => e.id === id);
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
  }
  if (entry.id == null || entry.id === 0) {
    entry.id = nextNetworkRequestId();
  }
  networkRequests.push(entry);
  if (networkRequests.length > NETWORK_BUFFER_SIZE) networkRequests.shift();
}

export function truncateBody(body: any): string | null {
  if (body == null) return null;
  var s = typeof body === 'string' ? body : String(body);
  return s.length > NETWORK_BODY_LIMIT ? s.substring(0, NETWORK_BODY_LIMIT) : s;
}
