import { NETWORK_BODY_LIMIT } from './shared';
import { pushNetworkEntry } from './network-helpers';

// ─── fetch monkey-patch — 네이티브 fetch 요청 캡처 ──────────────
(function () {
  var g: any =
    typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : null;
  if (!g || typeof g.fetch !== 'function') return;
  var _origFetch = g.fetch;

  g.fetch = function (input: any, init: any) {
    var url = '';
    var method = 'GET';
    var requestHeaders: Record<string, string> = {};
    var requestBody: any = null;

    if (typeof input === 'string') {
      url = input;
    } else if (input && typeof input === 'object' && typeof input.url === 'string') {
      url = input.url;
      if (input.method) method = input.method.toUpperCase();
      if (input.headers) {
        try {
          if (typeof input.headers.forEach === 'function') {
            input.headers.forEach(function (v: string, k: string) {
              requestHeaders[k] = v;
            });
          } else if (typeof input.headers === 'object') {
            var hk = Object.keys(input.headers);
            for (var i = 0; i < hk.length; i++) {
              var key = hk[i];
              if (key === undefined) continue;
              requestHeaders[key] = input.headers[key];
            }
          }
        } catch (_e) {}
      }
      if (input.body != null) requestBody = input.body;
    }

    if (init && typeof init === 'object') {
      if (init.method) method = init.method.toUpperCase();
      if (init.headers) {
        try {
          if (typeof init.headers.forEach === 'function') {
            init.headers.forEach(function (v: string, k: string) {
              requestHeaders[k] = v;
            });
          } else if (typeof init.headers === 'object') {
            var hk2 = Object.keys(init.headers);
            for (var j = 0; j < hk2.length; j++) {
              var key = hk2[j];
              if (key === undefined) continue;
              requestHeaders[key] = init.headers[key];
            }
          }
        } catch (_e) {}
      }
      if (init.body != null) requestBody = init.body;
    }

    var bodyStr: string | null = null;
    if (requestBody != null) {
      bodyStr =
        typeof requestBody === 'string'
          ? requestBody
          : typeof requestBody.toString === 'function'
            ? requestBody.toString()
            : String(requestBody);
      if (bodyStr.length > NETWORK_BODY_LIMIT) bodyStr = bodyStr.substring(0, NETWORK_BODY_LIMIT);
    }

    var entry: any = {
      id: 0,
      method: method,
      url: url,
      requestHeaders: requestHeaders,
      requestBody: bodyStr,
      status: null,
      statusText: null,
      responseHeaders: null,
      responseBody: null,
      startTime: Date.now(),
      duration: null,
      error: null,
      state: 'pending',
    };

    return _origFetch.apply(this, arguments).then(
      function (response: any) {
        entry.status = response.status;
        entry.statusText = response.statusText || null;
        try {
          var headerObj: Record<string, string> = {};
          if (response.headers && typeof response.headers.forEach === 'function') {
            response.headers.forEach(function (v: string, k: string) {
              headerObj[k] = v;
            });
          }
          entry.responseHeaders = JSON.stringify(headerObj);
        } catch (_e) {
          entry.responseHeaders = null;
        }
        entry.duration = Date.now() - entry.startTime;
        entry.state = 'done';

        // Clone response to read body without consuming it
        try {
          var cloned = response.clone();
          cloned
            .text()
            .then(function (text: string) {
              entry.responseBody =
                text && text.length > NETWORK_BODY_LIMIT
                  ? text.substring(0, NETWORK_BODY_LIMIT)
                  : text || null;
              pushNetworkEntry(entry);
            })
            .catch(function () {
              pushNetworkEntry(entry);
            });
        } catch (_e) {
          pushNetworkEntry(entry);
        }

        return response;
      },
      function (err: any) {
        entry.duration = Date.now() - entry.startTime;
        entry.error = err && err.message ? err.message : 'Network error';
        entry.state = 'error';
        pushNetworkEntry(entry);
        throw err;
      }
    );
  };
})();
