/// <reference lib="dom" />
import { pushNetworkEntry, truncateBody } from './network-helpers';

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
      var xhr = this;

      xhr.addEventListener('load', function () {
        entry.status = xhr.status;
        entry.statusText = xhr.statusText || null;
        try {
          entry.responseHeaders = xhr.getAllResponseHeaders() || null;
        } catch (_e) {
          entry.responseHeaders = null;
        }
        try {
          entry.responseBody = truncateBody(xhr.responseText);
        } catch (_e) {
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
