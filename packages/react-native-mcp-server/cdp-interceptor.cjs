/**
 * CDP 이벤트 가로채기 진입점 (Metro config에서 require 또는 node -r로 적용)
 * 디바이스↔디버거 모든 CDP 메시지를 수집해 GET /__mcp_cdp_events__ 로 노출.
 *
 * 두 가지 패치를 적용:
 * 1. Module._load 후크 → @react-native/dev-middleware 최초 로드 시 래핑 (node -r 필요)
 * 2. Metro runServer 패치 → unstable_extraMiddleware 선두에 엔드포인트 등록
 *
 * @see docs/cdp-interceptor-library-design.md
 */

'use strict';

// ─── 이벤트 스토어 ──────────────────────────────────────────────

const MAX_EVENTS = 2000;
const eventStore = [];

function pushEvent(entry) {
  eventStore.push(entry);
  if (eventStore.length > MAX_EVENTS) eventStore.shift();
}

// ─── 공통 헬퍼 ──────────────────────────────────────────────────

const CDP_EVENTS_PATH = '/__mcp_cdp_events__';

/** /__mcp_cdp_events__ JSON 응답 */
function sendCdpEventsResponse(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  const lastEventTimestamp =
    eventStore.length > 0 ? eventStore[eventStore.length - 1].timestamp : null;
  res.end(JSON.stringify({ events: eventStore, lastEventTimestamp }));
}

/** cwd, cwd/node_modules, __dirname 순서로 모듈 resolve 후 require */
function requireFromProject(moduleId) {
  const path = require('path');
  for (const p of [process.cwd(), path.join(process.cwd(), 'node_modules'), __dirname]) {
    try {
      return require(require.resolve(moduleId, { paths: [p] }));
    } catch {
      continue;
    }
  }
  return null;
}

// ─── CDP 메시지 핸들러 ──────────────────────────────────────────

/** customInspectorMessageHandler 팩토리: 기존 핸들러를 감싸서 이벤트 수집 추가 */
function createOurHandler(existingFactory) {
  return function (connection) {
    const existing = existingFactory ? existingFactory(connection) : null;
    return {
      handleDeviceMessage(message) {
        try {
          pushEvent({
            direction: 'device',
            method: message.method,
            params: message.params,
            id: message.id,
            timestamp: Date.now(),
          });
        } catch {}
        if (existing?.handleDeviceMessage?.(message) === true) return true;
      },
      handleDebuggerMessage(message) {
        try {
          pushEvent({
            direction: 'debugger',
            method: message.method,
            params: message.params,
            id: message.id,
            timestamp: Date.now(),
          });
        } catch {}
        if (existing?.handleDebuggerMessage?.(message) === true) return true;
      },
    };
  };
}

// ─── createDevMiddleware 래핑 ───────────────────────────────────

/** 이미 래핑 했는지 추적 (Module._load과 직접 패치 이중 적용 방지) */
let devMiddlewarePatched = false;

/** createDevMiddleware를 래핑: CDP 핸들러 주입 + 미들웨어에 이벤트 엔드포인트 추가 */
function wrapCreateDevMiddleware(original) {
  return function (options) {
    const opts = Object.assign({}, options);
    opts.unstable_customInspectorMessageHandler = createOurHandler(
      opts.unstable_customInspectorMessageHandler
    );
    const result = original(opts);
    if (result && typeof result.middleware === 'function') {
      const originalMiddleware = result.middleware;
      result.middleware = function (req, res, next) {
        if (req.url?.split('?')[0] === CDP_EVENTS_PATH) {
          sendCdpEventsResponse(res);
          return;
        }
        return originalMiddleware(req, res, next);
      };
    }
    return result;
  };
}

// ─── 패치 1: Module._load 후크 ─────────────────────────────────

function installDevMiddlewareLoadHook() {
  const Module = require('module');
  const originalLoad = Module._load;
  if (typeof originalLoad !== 'function') return;

  Module._load = function (request, _parent, _isMain) {
    const result = originalLoad.apply(this, arguments);
    if (typeof request !== 'string') return result;
    if (request !== '@react-native/dev-middleware' && !request.includes('dev-middleware')) {
      return result;
    }
    if (devMiddlewarePatched) return result;
    devMiddlewarePatched = true;

    const orig = result;
    const originalFn =
      typeof orig === 'function' ? orig : (orig?.createDevMiddleware ?? orig?.default);
    if (typeof originalFn !== 'function') return result;

    const wrapped = wrapCreateDevMiddleware(originalFn);
    return new Proxy(orig, {
      get(target, prop) {
        if (prop === 'default' || prop === 'createDevMiddleware') return wrapped;
        return target[prop];
      },
    });
  };
}

// ─── 패치 2: Metro runServer ────────────────────────────────────

function patchMetroRunServer() {
  const metro = requireFromProject('metro');
  if (!metro) {
    console.warn(
      '[react-native-mcp] cdp-interceptor: metro module not found, /__mcp_cdp_events__ will not be registered.'
    );
    return;
  }
  const runServer = metro.runServer ?? metro.default?.runServer;
  if (typeof runServer !== 'function') {
    console.warn('[react-native-mcp] cdp-interceptor: runServer not found on metro.');
    return;
  }
  const wrapped = function (config, options) {
    const opts = { ...options };
    const extra = opts.unstable_extraMiddleware ?? [];
    opts.unstable_extraMiddleware = [
      function (req, res, next) {
        if (req.url?.split('?')[0] === CDP_EVENTS_PATH) {
          sendCdpEventsResponse(res);
          return;
        }
        return next();
      },
      ...extra,
    ];
    return runServer.call(this, config, opts);
  };
  if (metro.runServer) metro.runServer = wrapped;
  if (metro.default && typeof metro.default.runServer === 'function') {
    metro.default.runServer = wrapped;
  }
}

// ─── 패치 3: 직접 모듈 패치 (Module._load이 먼저 로드된 경우 fallback) ──

function patchDevMiddlewareDirect() {
  if (devMiddlewarePatched) return;

  const devMiddleware = requireFromProject('@react-native/dev-middleware');
  if (!devMiddleware) return;

  const original = devMiddleware.default ?? devMiddleware.createDevMiddleware ?? devMiddleware;
  if (typeof original !== 'function') return;

  devMiddlewarePatched = true;
  const wrapped = wrapCreateDevMiddleware(original);

  function assignIfWritable(obj, key, value) {
    if (obj[key] === undefined) return;
    try {
      const d = Object.getOwnPropertyDescriptor(obj, key);
      if (d && d.writable) {
        obj[key] = value;
        return;
      }
      if (d && d.configurable) {
        Object.defineProperty(obj, key, {
          value,
          configurable: true,
          enumerable: d.enumerable !== false,
          writable: true,
        });
      }
    } catch (_) {}
  }

  assignIfWritable(devMiddleware, 'default', wrapped);
  assignIfWritable(devMiddleware, 'createDevMiddleware', wrapped);
}

// ─── 실행 ───────────────────────────────────────────────────────

installDevMiddlewareLoadHook();
patchMetroRunServer();
patchDevMiddlewareDirect();
