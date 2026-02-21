/// <reference lib="dom" />
import { pushNetworkEntry, truncateBody, takeCurrentFetchRequestId } from './network-helpers';
import { findMatchingMock } from './network-mock';

// ─── XHR monkey-patch — 네트워크 요청 캡처 ──────────────────────
// DEV/Release 무관하게 항상 설치. MCP.enable() 없이도 네트워크 캡처 동작.
(function () {
  if (typeof XMLHttpRequest === 'undefined') return;
  var XHR = XMLHttpRequest.prototype as any;
  var _origOpen = XHR.open;
  var _origSend = XHR.send;
  var _origSetRequestHeader = XHR.setRequestHeader;

  XHR.open = function (method: string, url: string) {
    this.__mcpNetworkEntry = {
      id: 0,
      method: (method || 'GET').toUpperCase(),
      url: String(url || ''),
      requestHeaders: {},
      requestBody: null,
      status: null,
      statusText: null,
      responseHeaders: null,
      responseBody: null,
      startTime: Date.now(),
      duration: null,
      error: null,
      state: 'pending',
    };
    return _origOpen.apply(this, arguments);
  };

  XHR.setRequestHeader = function (name: string, value: string) {
    if (this.__mcpNetworkEntry) {
      this.__mcpNetworkEntry.requestHeaders[name] = value;
    }
    return _origSetRequestHeader.apply(this, arguments);
  };

  XHR.send = function (body: any) {
    var entry = this.__mcpNetworkEntry;
    if (entry) {
      entry.requestBody = truncateBody(body);
      var fetchId = takeCurrentFetchRequestId(entry.url, entry.method);
      if (fetchId != null) entry.id = fetchId;

      // ─── Network mock intercept ──────────────────────
      var mockRule = findMatchingMock(entry.method, entry.url);
      if (mockRule) {
        // eslint-disable-next-line no-this-alias -- XHR open/send 콜백에서 this 바인딩 유지
        var xhr = this;
        var mockResp = mockRule.response;
        var deliverMock = function () {
          entry.status = mockResp.status;
          entry.statusText = mockResp.statusText || null;
          entry.responseHeaders = JSON.stringify(mockResp.headers);
          entry.responseBody = truncateBody(mockResp.body);
          entry.duration = Date.now() - entry.startTime;
          entry.state = 'done';
          entry.mocked = true;
          pushNetworkEntry(entry);
          // Why RN internal methods instead of dispatchEvent:
          // Hermes에는 global Event 생성자가 없고 (typeof Event === 'undefined'),
          // RN의 dispatchEvent는 Event 인스턴스만 허용하므로 plain object {type:'load'}도 실패.
          // RN XMLHttpRequest 내부 메서드를 직접 호출하면 내부 이벤트 파이프라인을 타고
          // addEventListener('load', ...) 콜백이 정상 트리거됨.
          // 호출 순서: __didCreateRequest → __didReceiveResponse → __didReceiveData → __didCompleteResponse
          var fakeId = -1 - Date.now();
          try {
            xhr.__didCreateRequest(fakeId);
            xhr.__didReceiveResponse(fakeId, mockResp.status, mockResp.headers || {}, entry.url);
            if (mockResp.body) {
              xhr.__didReceiveData(fakeId, mockResp.body);
            }
            xhr.__didCompleteResponse(fakeId, '', false);
          } catch {}
        };
        setTimeout(deliverMock, mockResp.delay > 0 ? mockResp.delay : 0);
        return;
      }
      // ─── End mock intercept ──────────────────────────

      // eslint-disable-next-line no-this-alias -- load 이벤트 콜백에서 this 바인딩 유지
      var xhr = this;

      xhr.addEventListener('load', function () {
        entry.status = xhr.status;
        entry.statusText = xhr.statusText || null;
        try {
          entry.responseHeaders = xhr.getAllResponseHeaders() || null;
        } catch {
          entry.responseHeaders = null;
        }
        try {
          entry.responseBody = truncateBody(xhr.responseText);
        } catch {
          entry.responseBody = null;
        }
        entry.duration = Date.now() - entry.startTime;
        entry.state = 'done';
        pushNetworkEntry(entry);
      });

      xhr.addEventListener('error', function () {
        entry.duration = Date.now() - entry.startTime;
        entry.error = 'Network error';
        entry.state = 'error';
        pushNetworkEntry(entry);
      });

      xhr.addEventListener('timeout', function () {
        entry.duration = Date.now() - entry.startTime;
        entry.error = 'Timeout';
        entry.state = 'error';
        pushNetworkEntry(entry);
      });
    }
    return _origSend.apply(this, arguments);
  };
})();
