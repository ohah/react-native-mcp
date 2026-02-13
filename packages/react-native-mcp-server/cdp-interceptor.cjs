/**
 * CDP 이벤트 가로채기 진입점 (Metro config에서 require 시 패치 적용)
 * 디바이스→디버거, 디버거→디바이스 모든 CDP 메시지를 수집해 GET /__mcp_cdp_events__ 로 노출.
 *
 * Metro 문서(https://metrobundler.dev/docs/configuration/)의 server.enhanceMiddleware는
 * "Metro 미들웨어"(createConnectMiddleware 결과)만 감싸므로, RN CLI가 unstable_extraMiddleware로
 * 넣는 communityMiddleware·devMiddleware보다 뒤에 실행됨. 그들이 모르는 경로에서 404를 반환하면
 * 우리 경로에 도달하지 않으므로, runServer를 패치해 unstable_extraMiddleware 맨 앞에
 * /__mcp_cdp_events__ 전용 핸들러를 넣음.
 *
 * CDP 수집: CLI가 require('@react-native/dev-middleware')하는 시점보다 먼저 Module._load 후크를
 * 걸어야 하므로, Metro를 node -r @ohah/react-native-mcp-server/cdp-interceptor 로 실행하면
 * 이벤트가 수집됨. config에서만 require하면 엔드포인트만 동작하고 events는 빈 배열.
 *
 * @see docs/cdp-interceptor-library-design.md
 */

'use strict';

const MAX_EVENTS = 2000;

const eventStore = [];
function pushEvent(entry) {
  eventStore.push(entry);
  if (eventStore.length > MAX_EVENTS) {
    eventStore.shift();
  }
}

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

const CDP_EVENTS_PATH = '/__mcp_cdp_events__';

/** /__mcp_cdp_events__ 요청을 맨 앞에서 처리 (communityMiddleware가 먼저 404 내지 않도록) */
function createCdpEventsMiddleware() {
  return function (req, res, next) {
    const pathname = req.url?.split('?')[0];
    if (pathname !== CDP_EVENTS_PATH) {
      return next();
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(JSON.stringify({ events: eventStore }));
  };
}

function wrapMiddleware(originalMiddleware) {
  if (typeof originalMiddleware !== 'function') return originalMiddleware;
  return function (req, res, next) {
    const pathname = req.url?.split('?')[0];
    if (pathname === CDP_EVENTS_PATH) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(JSON.stringify({ events: eventStore }));
      return;
    }
    return originalMiddleware(req, res, next);
  };
}

/** createDevMiddleware 래퍼: customInspectorMessageHandler 주입 + middleware에 /__mcp_cdp_events__ 처리 */
function createWrappedCreateDevMiddleware(original) {
  return function (options) {
    const opts = Object.assign({}, options);
    opts.unstable_customInspectorMessageHandler = createOurHandler(
      opts.unstable_customInspectorMessageHandler
    );
    const result = original(opts);
    if (result && result.middleware) {
      result.middleware = wrapMiddleware(result.middleware);
    }
    return result;
  };
}

/**
 * Module._load 후크: @react-native/dev-middleware 최초 로드 시 exports를 래핑.
 * CLI가 require하기 전에 후크가 걸려 있어야 하므로, Metro는 다음처럼 실행해야 이벤트가 수집됨:
 *   node -r @ohah/react-native-mcp-server/cdp-interceptor node_modules/.bin/react-native start --port 8230
 * Node가 _load에 넘기는 request는 require() 인자(패키지명 또는 경로). 반환값은 module.exports라서 filename 사용 불가.
 */
function installDevMiddlewareLoadHook() {
  const Module = require('module');
  const originalLoad = Module._load;
  if (typeof originalLoad !== 'function') return;
  function isDevMiddlewareRequest(request) {
    if (typeof request !== 'string') return false;
    if (request === '@react-native/dev-middleware') return true;
    return request.includes('dev-middleware');
  }
  Module._load = function (request, _parent, _isMain) {
    const result = originalLoad.apply(this, arguments);
    if (!isDevMiddlewareRequest(request)) return result;
    const orig = result;
    const originalFn =
      typeof orig === 'function' ? orig : (orig?.createDevMiddleware ?? orig?.default);
    if (typeof originalFn !== 'function') return result;
    const wrapped = createWrappedCreateDevMiddleware(originalFn);
    return new Proxy(orig, {
      get(target, prop) {
        if (prop === 'default' || prop === 'createDevMiddleware') return wrapped;
        return target[prop];
      },
    });
  };
}

installDevMiddlewareLoadHook();

/**
 * CLI가 사용하는 것과 같은 metro 인스턴스를 얻기 위해, config를 로드하는 프로젝트(cwd) 기준으로 resolve.
 * 서버 패키지에서 require('metro')하면 모노레포 루트의 metro를 가져와 CLI(demo-app의 metro)와 달라질 수 있음.
 */
function getMetroModule() {
  const path = require('path');
  const searchPaths = [process.cwd(), path.join(process.cwd(), 'node_modules'), __dirname];
  for (const p of searchPaths) {
    try {
      const metroPath = require.resolve('metro', { paths: [p] });
      return require(metroPath);
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Metro runServer에서 unstable_extraMiddleware 맨 앞에 /__mcp_cdp_events__ 핸들러 추가.
 * 문서의 server.enhanceMiddleware는 "Metro 미들웨어"만 감싸므로, RN CLI가 넣는 communityMiddleware
 * 다음에 실행됨. 그쪽이 알 수 없는 경로에서 404를 내면 우리 경로에 도달하지 않으므로,
 * extraMiddleware 배열 선두에 넣어서 우리가 먼저 처리하도록 패치.
 */
function patchMetroRunServer() {
  const metro = getMetroModule();
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
    opts.unstable_extraMiddleware = [createCdpEventsMiddleware(), ...extra];
    return runServer.call(this, config, opts);
  };
  if (metro.runServer) metro.runServer = wrapped;
  if (metro.default && typeof metro.default.runServer === 'function')
    metro.default.runServer = wrapped;
}

/** 프로젝트(cwd) 또는 현재 패키지 기준으로 모듈 resolve (모노레포에서 demo-app의 dev-middleware 찾기) */
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

function patchCreateDevMiddlewareAndWrapReturn() {
  const devMiddleware = requireFromProject('@react-native/dev-middleware');
  if (!devMiddleware) {
    console.warn(
      '[react-native-mcp] cdp-interceptor: @react-native/dev-middleware not found. Skipping CDP event collection (GET /__mcp_cdp_events__ will return []).'
    );
    return;
  }
  const original = devMiddleware.default ?? devMiddleware.createDevMiddleware ?? devMiddleware;
  if (typeof original !== 'function') {
    console.warn('[react-native-mcp] cdp-interceptor: createDevMiddleware not found. Skipping.');
    return;
  }
  const wrapped = function (options) {
    const opts = { ...options };
    const existing = opts.unstable_customInspectorMessageHandler;
    opts.unstable_customInspectorMessageHandler = createOurHandler(existing);
    const result = original(opts);
    if (result && result.middleware) {
      result.middleware = wrapMiddleware(result.middleware);
    }
    return result;
  };

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
    } catch (_) {
      // getter-only 등 쓸 수 없으면 무시
    }
  }

  assignIfWritable(devMiddleware, 'default', wrapped);
  assignIfWritable(devMiddleware, 'createDevMiddleware', wrapped);
}

patchMetroRunServer();
patchCreateDevMiddlewareAndWrapReturn();
