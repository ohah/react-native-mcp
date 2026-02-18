import { networkRequests, resetNetworkRequests } from './shared';

/**
 * 네트워크 요청 조회. options: { url?, method?, status?, since?, limit? }
 * url: substring 매칭, method: 정확 매칭, status: 정확 매칭
 */
export function getNetworkRequests(options?: any): any[] {
  var opts = typeof options === 'object' && options !== null ? options : {};
  var out = networkRequests;
  if (typeof opts.url === 'string' && opts.url) {
    var urlFilter = opts.url;
    out = out.filter(function (entry) {
      return entry.url.indexOf(urlFilter) !== -1;
    });
  }
  if (typeof opts.method === 'string' && opts.method) {
    var methodFilter = opts.method.toUpperCase();
    out = out.filter(function (entry) {
      return entry.method === methodFilter;
    });
  }
  if (typeof opts.status === 'number') {
    var statusFilter = opts.status;
    out = out.filter(function (entry) {
      return entry.status === statusFilter;
    });
  }
  if (typeof opts.since === 'number') {
    var since = opts.since;
    out = out.filter(function (entry) {
      return entry.startTime > since;
    });
  }
  var limit = typeof opts.limit === 'number' && opts.limit > 0 ? opts.limit : 50;
  if (out.length > limit) out = out.slice(out.length - limit);
  return out;
}

/** 네트워크 요청 버퍼 초기화 */
export function clearNetworkRequests(): void {
  resetNetworkRequests();
}
