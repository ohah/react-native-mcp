import { consoleLogs, resetConsoleLogs } from './shared';

/**
 * 콘솔 로그 조회. options: { level?, since?, limit? }
 * level 맵핑: 0=log, 1=info, 2=warn, 3=error
 */
export function getConsoleLogs(options?: any): any[] {
  var opts = typeof options === 'object' && options !== null ? options : {};
  var levelMap: Record<string, number> = { log: 0, info: 1, warn: 2, error: 3 };
  var out = consoleLogs;
  if (opts.level != null) {
    var targetLevel = typeof opts.level === 'string' ? levelMap[opts.level] : opts.level;
    if (targetLevel != null) {
      out = out.filter(function (entry) {
        return entry.level === targetLevel;
      });
    }
  }
  if (typeof opts.since === 'number') {
    var since = opts.since;
    out = out.filter(function (entry) {
      return entry.timestamp > since;
    });
  }
  var limit = typeof opts.limit === 'number' && opts.limit > 0 ? opts.limit : 100;
  if (out.length > limit) out = out.slice(out.length - limit);
  return out;
}

/** 콘솔 로그 버퍼 초기화 */
export function clearConsoleLogs(): void {
  resetConsoleLogs();
}
