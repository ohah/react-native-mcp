/**
 * React Native 앱에 주입되는 MCP 런타임 (Phase 1)
 * - __REACT_NATIVE_MCP__.registerComponent → AppRegistry.registerComponent 위임
 * - __DEV__ 시 WebSocket으로 MCP 서버(12300)에 연결, eval 요청 처리
 *
 * Metro transformer가 진입점 상단에 require('@ohah/react-native-mcp-server/runtime') 주입
 * global은 모듈 로드 직후 최상단에서 설정해 ReferenceError 방지.
 */

'use strict';

// ─── DevTools hook 보장 ───────────────────────────────────────
// DEV: React DevTools가 이미 hook을 설치 → 건너뜀.
// Release: hook이 없으므로 MCP가 설치. React 로드 시 inject/onCommitFiberRoot로
// renderer·fiber root를 캡처해 DEV와 동일하게 Fiber 트리 접근 가능.
(function () {
  var g =
    typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : null;
  if (!g || g.__REACT_DEVTOOLS_GLOBAL_HOOK__) return;

  var _renderers = new Map();
  var _roots = new Map();

  g.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: _renderers,
    inject: function (internals) {
      var id = _renderers.size + 1;
      _renderers.set(id, internals);
      return id;
    },
    onCommitFiberRoot: function (rendererID, root) {
      if (!_roots.has(rendererID)) _roots.set(rendererID, new Set());
      _roots.get(rendererID).add(root);
    },
    onCommitFiberUnmount: function () {},
    getFiberRoots: function (rendererID) {
      return _roots.get(rendererID) || new Set();
    },
  };
})();

var _pressHandlers = {};
var _webViews = {};
var _scrollRefs = {};

// ─── Fiber 트리 헬퍼 ────────────────────────────────────────────

/** DevTools hook에서 root Fiber를 얻는다. hook.getFiberRoots 우선, fallback으로 getCurrentFiber 사용. */
function getFiberRootFromHook(hook, rendererID) {
  if (!hook) return null;
  function toRootFiber(r) {
    return r && r.current ? r.current : r;
  }
  if (typeof hook.getFiberRoots === 'function') {
    try {
      var roots = hook.getFiberRoots(rendererID);
      if (roots && roots.size > 0) {
        var first = roots.values().next().value;
        if (first) return toRootFiber(first);
      }
    } catch (_e) {}
  }
  var renderer = hook.renderers && hook.renderers.get(rendererID);
  if (renderer && typeof renderer.getCurrentFiber === 'function') {
    var fiber = renderer.getCurrentFiber();
    if (fiber) {
      while (fiber && fiber.return) fiber = fiber.return;
      return fiber || null;
    }
  }
  return null;
}

/** __REACT_DEVTOOLS_GLOBAL_HOOK__ 반환. 없으면 null. */
function getDevToolsHook() {
  return (
    (typeof global !== 'undefined' && global.__REACT_DEVTOOLS_GLOBAL_HOOK__) ||
    (typeof globalThis !== 'undefined' && globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__) ||
    null
  );
}

/** DevTools hook → fiber root. 없으면 null. */
function getFiberRoot() {
  var hook = getDevToolsHook();
  if (!hook || !hook.renderers) return null;
  return getFiberRootFromHook(hook, 1);
}

/** fiber 하위 Text 노드의 문자열 수집 */
function collectText(fiber, TextComponent) {
  if (!fiber) return '';
  if (fiber.type === TextComponent && fiber.memoizedProps) {
    var c = fiber.memoizedProps.children;
    if (typeof c === 'string') return c.trim();
    if (typeof c === 'number' || typeof c === 'boolean') return String(c);
    if (Array.isArray(c))
      return c
        .map(function (x) {
          if (typeof x === 'string') return x;
          if (typeof x === 'number' || typeof x === 'boolean') return String(x);
          return '';
        })
        .join('')
        .trim();
  }
  var s = '';
  var ch = fiber.child;
  while (ch) {
    s += collectText(ch, TextComponent);
    ch = ch.sibling;
  }
  return s;
}

/** fiber의 accessibilityLabel 또는 자식 Image의 accessibilityLabel 수집 */
function collectAccessibilityLabel(fiber, ImageComponent) {
  if (!fiber || !fiber.memoizedProps) return '';
  var p = fiber.memoizedProps;
  if (typeof p.accessibilityLabel === 'string' && p.accessibilityLabel.trim())
    return p.accessibilityLabel.trim();
  var ch = fiber.child;
  while (ch) {
    if (
      ch.type === ImageComponent &&
      ch.memoizedProps &&
      typeof ch.memoizedProps.accessibilityLabel === 'string'
    )
      return ch.memoizedProps.accessibilityLabel.trim();
    ch = ch.sibling;
  }
  return '';
}

/** fiber에서 사용자에게 보이는 라벨 추출 (text 우선, a11y fallback) */
function getLabel(fiber, TextComponent, ImageComponent) {
  var text = collectText(fiber, TextComponent).replace(/\s+/g, ' ').trim();
  var a11y = collectAccessibilityLabel(fiber, ImageComponent);
  return text || a11y || '';
}

/** require('react-native')에서 Text, Image 컴포넌트 추출 */
function getRNComponents() {
  var rn = typeof require !== 'undefined' && require('react-native');
  return { Text: rn && rn.Text, Image: rn && rn.Image };
}

/** fiber 자신(또는 조상)에서 처음 나오는 testID */
function getAncestorTestID(fiber) {
  var f = fiber;
  while (f && f.memoizedProps) {
    if (typeof f.memoizedProps.testID === 'string' && f.memoizedProps.testID.trim())
      return f.memoizedProps.testID.trim();
    f = f.return;
  }
  return undefined;
}

/** Text fiber 한 노드의 직접 children 문자열만 (자식 Text 노드 제외) */
function getTextNodeContent(fiber, TextComponent) {
  if (!fiber || fiber.type !== TextComponent || !fiber.memoizedProps) return '';
  var c = fiber.memoizedProps.children;
  if (typeof c === 'string') return c.trim();
  if (Array.isArray(c))
    return c
      .map(function (x) {
        return typeof x === 'string' ? x : '';
      })
      .join('')
      .trim();
  return '';
}

/** Fiber의 컴포넌트 타입 이름 (displayName/name/문자열) */
function getFiberTypeName(fiber) {
  if (!fiber || !fiber.type) return 'Unknown';
  var t = fiber.type;
  if (typeof t === 'string') return t;
  if (t.displayName && typeof t.displayName === 'string') return t.displayName;
  if (t.name && typeof t.name === 'string') return t.name;
  return 'Component';
}

// ─── MCP 글로벌 객체 ────────────────────────────────────────────

var MCP = {
  registerComponent: function (name, component) {
    return require('react-native').AppRegistry.registerComponent(name, component);
  },
  registerPressHandler: function (testID, handler) {
    if (typeof testID === 'string' && typeof handler === 'function')
      _pressHandlers[testID] = handler;
  },
  triggerPress: function (testID) {
    var h = _pressHandlers[testID];
    if (typeof h === 'function') {
      h();
      return true;
    }
    return false;
  },
  getRegisteredPressTestIDs: function () {
    return Object.keys(_pressHandlers);
  },
  /**
   * 클릭 가능 요소 목록 (uid + label). 텍스트로 찾은 뒤 click(uid) 호출용.
   */
  getClickables: function () {
    var ids = Object.keys(_pressHandlers);
    var fiberLabels = MCP._getClickableLabelsFromFiber && MCP._getClickableLabelsFromFiber();
    return ids.map(function (id) {
      var label = (fiberLabels && fiberLabels[id]) != null ? fiberLabels[id] : '';
      return { uid: id, label: label };
    });
  },
  _getClickableLabelsFromFiber: function () {
    try {
      var root = getFiberRoot();
      if (!root) return null;
      var c = getRNComponents();
      var out = {};
      function visit(fiber) {
        if (!fiber) return;
        var props = fiber.memoizedProps;
        var testID = props && props.testID;
        if (testID && _pressHandlers[testID]) {
          var text = collectText(fiber, c.Text).trim();
          if (text) out[testID] = text.replace(/\s+/g, ' ');
        }
        visit(fiber.child);
        visit(fiber.sibling);
      }
      visit(root);
      return Object.keys(out).length ? out : null;
    } catch (e) {
      return null;
    }
  },
  /**
   * Fiber 라벨 검색 디버그: hookPresent, rendererPresent, rootPresent, labelsWithOnPress 목록 반환.
   */
  getByLabel: function (labelSubstring) {
    var hook = getDevToolsHook();
    var result = {
      hookPresent: !!(hook && hook.renderers),
      rendererPresent: false,
      rootPresent: false,
      labelsWithOnPress: [],
      match: null,
      error: null,
      rendererKeys: null,
      rootSource: null,
    };
    try {
      if (!hook || !hook.renderers) return result;
      var renderer = hook.renderers.get(1);
      result.rendererPresent = !!renderer;
      if (!renderer) return result;
      result.rendererKeys = Object.keys(renderer);
      var root = getFiberRootFromHook(hook, 1);
      if (!root) return result;
      result.rootPresent = true;
      result.rootSource =
        typeof hook.getFiberRoots === 'function'
          ? 'hook.getFiberRoots'
          : 'getCurrentFiber().return*';
      var c = getRNComponents();
      var search = typeof labelSubstring === 'string' ? labelSubstring.trim() : '';
      function visit(fiber) {
        if (!fiber) return;
        var props = fiber.memoizedProps;
        if (typeof (props && props.onPress) === 'function') {
          var label = getLabel(fiber, c.Text, c.Image);
          var testID = (props && props.testID) || undefined;
          result.labelsWithOnPress.push({ text: label, testID: testID });
          if (search && label.indexOf(search) !== -1 && !result.match) {
            result.match = { text: label, testID: testID };
          }
          visit(fiber.sibling);
          return;
        }
        visit(fiber.child);
        visit(fiber.sibling);
      }
      visit(root);
      return result;
    } catch (e) {
      result.error = e && e.message ? e.message : String(e);
      return result;
    }
  },
  getByLabels: function () {
    return MCP.getByLabel('');
  },
  /**
   * onPress 있는 노드별 전체 텍스트(textContent). querySelector + textContent처럼 검증용.
   * 반환: [{ text, testID? }] — text는 해당 버튼 하위 Text 전체 이어붙인 값.
   */
  getClickableTextContent: function () {
    var r = MCP.getByLabel('');
    return r && r.labelsWithOnPress ? r.labelsWithOnPress : [];
  },
  /**
   * Fiber 트리 전체에서 Text 노드 내용 수집. 버튼 여부와 무관하게 모든 보이는 텍스트.
   * 반환: [{ text, testID? }] — testID는 해당 Text의 조상 중 가장 가까운 testID.
   */
  getTextNodes: function () {
    try {
      var root = getFiberRoot();
      if (!root) return [];
      var c = getRNComponents();
      var TextComponent = c && c.Text;
      if (!TextComponent) return [];
      var out = [];
      function visit(fiber) {
        if (!fiber) return;
        if (fiber.type === TextComponent) {
          var text = getTextNodeContent(fiber, TextComponent);
          if (text) out.push({ text: text.replace(/\s+/g, ' '), testID: getAncestorTestID(fiber) });
        }
        visit(fiber.child);
        visit(fiber.sibling);
      }
      visit(root);
      return out;
    } catch (e) {
      return [];
    }
  },
  /**
   * Fiber 트리 전체를 컴포넌트 트리로 직렬화. querySelector 대체용 스냅샷.
   * 노드: { uid, type, testID?, accessibilityLabel?, text?, children? }
   * uid: testID 있으면 testID, 없으면 경로 "0.1.2". click(uid)는 testID일 때만 동작.
   * options: { maxDepth } (기본 무제한, 권장 20~30)
   */
  getComponentTree: function (options) {
    try {
      var root = getFiberRoot();
      if (!root) return null;
      var c = getRNComponents();
      var TextComponent = c && c.Text;
      var ImageComponent = c && c.Image;
      var maxDepth = options && typeof options.maxDepth === 'number' ? options.maxDepth : 999;
      function buildNode(fiber, path, depth) {
        if (!fiber || depth > maxDepth) return null;
        var props = fiber.memoizedProps || {};
        var testID =
          typeof props.testID === 'string' && props.testID.trim() ? props.testID.trim() : undefined;
        var typeName = getFiberTypeName(fiber);
        var uid = testID || path;
        var node = {
          uid: uid,
          type: typeName,
        };
        if (testID) node.testID = testID;
        var a11y = typeof props.accessibilityLabel === 'string' && props.accessibilityLabel.trim();
        if (a11y) node.accessibilityLabel = props.accessibilityLabel.trim();
        if (fiber.type === TextComponent) {
          var text = getTextNodeContent(fiber, TextComponent);
          if (text) node.text = text.replace(/\s+/g, ' ');
        }
        var children = [];
        var child = fiber.child;
        var idx = 0;
        while (child) {
          var childPath = path + '.' + idx;
          var childNode = buildNode(child, childPath, depth + 1);
          if (childNode) children.push(childNode);
          child = child.sibling;
          idx += 1;
        }
        if (children.length) node.children = children;
        return node;
      }
      return buildNode(root, '0', 0);
    } catch (e) {
      return null;
    }
  },
  /**
   * Fiber 트리에서 라벨(텍스트)에 해당하는 onPress 노드들을 순서대로 수집한 뒤, index번째(0-based) 호출.
   * index 생략 시 0 (첫 번째). querySelectorAll()[index]와 유사.
   */
  pressByLabel: function (labelSubstring, index) {
    if (typeof labelSubstring !== 'string' || !labelSubstring.trim()) return false;
    try {
      var root = getFiberRoot();
      if (!root) return false;
      var c = getRNComponents();
      var search = labelSubstring.trim();
      var matches = [];
      function visit(fiber) {
        if (!fiber) return;
        var props = fiber.memoizedProps;
        var onPress = props && props.onPress;
        if (typeof onPress === 'function') {
          var label = getLabel(fiber, c.Text, c.Image);
          if (label.indexOf(search) !== -1) matches.push(onPress);
          visit(fiber.sibling);
          return;
        }
        visit(fiber.child);
        visit(fiber.sibling);
      }
      visit(root);
      var idx = typeof index === 'number' && index >= 0 ? index : 0;
      if (matches[idx]) {
        try {
          matches[idx]();
        } catch (e) {}
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  },
  registerWebView: function (ref, id) {
    if (ref && typeof id === 'string') _webViews[id] = ref;
  },
  unregisterWebView: function (id) {
    if (typeof id === 'string') delete _webViews[id];
  },
  clickInWebView: function (id, selector) {
    var ref = _webViews[id];
    if (!ref || typeof ref.injectJavaScript !== 'function')
      return { ok: false, error: 'WebView not found or injectJavaScript not available' };
    var script =
      '(function(){ var el = document.querySelector(' +
      JSON.stringify(selector) +
      '); if (el) el.click(); })();';
    ref.injectJavaScript(script);
    return { ok: true };
  },
  /** 등록된 WebView 내부에서 임의의 JavaScript를 실행 */
  evaluateInWebView: function (id, script) {
    var ref = _webViews[id];
    if (!ref || typeof ref.injectJavaScript !== 'function')
      return { ok: false, error: 'WebView not found or injectJavaScript not available' };
    ref.injectJavaScript(script);
    return { ok: true };
  },
  getRegisteredWebViewIds: function () {
    return Object.keys(_webViews);
  },
  registerScrollRef: function (testID, ref) {
    if (typeof testID === 'string' && ref != null) _scrollRefs[testID] = ref;
  },
  unregisterScrollRef: function (testID) {
    if (typeof testID === 'string') delete _scrollRefs[testID];
  },
  scrollTo: function (testID, options) {
    var ref = _scrollRefs[testID];
    if (!ref) return { ok: false, error: 'ScrollView ref not found or scrollTo not available' };
    var opts = typeof options === 'object' && options !== null ? options : {};
    var x = opts.x || 0;
    var y = opts.y || 0;
    var animated = opts.animated !== false;
    try {
      if (typeof ref.scrollTo === 'function') {
        ref.scrollTo({ x: x, y: y, animated: animated });
        return { ok: true };
      }
      if (typeof ref.scrollToOffset === 'function') {
        ref.scrollToOffset({ offset: y, animated: animated });
        return { ok: true };
      }
      return { ok: false, error: 'ScrollView ref not found or scrollTo not available' };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  },
  getRegisteredScrollTestIDs: function () {
    return Object.keys(_scrollRefs);
  },
};
if (typeof global !== 'undefined') global.__REACT_NATIVE_MCP__ = MCP;
if (typeof globalThis !== 'undefined') globalThis.__REACT_NATIVE_MCP__ = MCP;

var _isDevMode = typeof __DEV__ !== 'undefined' && __DEV__;

if (_isDevMode && typeof console !== 'undefined' && console.warn) {
  console.warn('[MCP] runtime loaded, __REACT_NATIVE_MCP__ available');
}

// ─── WebSocket 연결 (__DEV__ 자동 · 릴리즈는 MCP.enable() 호출) ─
// TODO: wsUrl은 나중에 설정 가능하게 할 예정 (환경/옵션으로 변경 가능).

var wsUrl = 'ws://localhost:12300';
var ws = null;
var _reconnectTimer = null;
var reconnectDelay = 1000;
var _mcpEnabled = _isDevMode;

function _shouldConnect() {
  if (_mcpEnabled) return true;
  if (typeof global !== 'undefined' && global.__REACT_NATIVE_MCP_ENABLED__) return true;
  if (typeof globalThis !== 'undefined' && globalThis.__REACT_NATIVE_MCP_ENABLED__) return true;
  return false;
}

function connect() {
  if (!_shouldConnect()) return;
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  if (ws)
    try {
      ws.close();
    } catch (_e) {}
  ws = new WebSocket(wsUrl);
  ws.onopen = function () {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[MCP] Connected to server', wsUrl);
    }
    reconnectDelay = 1000;
    if (_reconnectTimer != null) clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
    try {
      var rn = require('react-native');
      var platform = rn.Platform && rn.Platform.OS;
      var deviceName =
        (rn.Platform && rn.Platform.constants && rn.Platform.constants.Model) || null;
      var scriptURL =
        rn.NativeModules && rn.NativeModules.SourceCode && rn.NativeModules.SourceCode.scriptURL;
      var origin = null;
      if (scriptURL && typeof scriptURL === 'string') {
        origin = new URL(scriptURL).origin;
      }
      ws.send(
        JSON.stringify({
          type: 'init',
          platform: platform,
          deviceId: platform ? platform + '-1' : undefined,
          deviceName: deviceName,
          metroBaseUrl: origin,
        })
      );
    } catch (_e) {}
  };
  ws.onmessage = function (ev) {
    try {
      var msg = JSON.parse(ev.data);
      if (msg.method === 'eval' && msg.id != null) {
        var result;
        var errMsg = null;
        try {
          // oxlint-disable-next-line no-eval -- MCP evaluate_script 도구용 의도적 사용
          result = eval(msg.params && msg.params.code != null ? msg.params.code : 'undefined');
        } catch (e) {
          errMsg = e && e.message != null ? e.message : String(e);
        }
        if (ws && ws.readyState === 1) {
          ws.send(
            JSON.stringify(
              errMsg != null ? { id: msg.id, error: errMsg } : { id: msg.id, result: result }
            )
          );
        }
      }
    } catch {}
  };
  ws.onclose = function () {
    ws = null;
    _reconnectTimer = setTimeout(function () {
      connect();
      if (reconnectDelay < 30000) reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
    }, reconnectDelay);
  };
  ws.onerror = function () {};
}

/**
 * 릴리즈 빌드에서 MCP WebSocket 연결을 활성화한다.
 * 앱 진입점에서 __REACT_NATIVE_MCP__.enable() 호출.
 */
MCP.enable = function () {
  _mcpEnabled = true;
  connect();
};

// DEV: 번들 로드 직후 자동 연결
if (_isDevMode) connect();

// runApplication 시점에 미연결이면 한 번 더 시도
var _AppRegistry = require('react-native').AppRegistry;
var _originalRun = _AppRegistry.runApplication;
_AppRegistry.runApplication = function () {
  if (_shouldConnect() && (!ws || ws.readyState !== 1)) connect();
  return _originalRun.apply(this, arguments);
};

// 주기적 재시도: 앱이 먼저 떠 있고 나중에 MCP를 켜도 자동 연결 (순서 무관)
var PERIODIC_INTERVAL_MS = 5000;
setInterval(function () {
  if (!_shouldConnect()) return;
  if (ws && ws.readyState === 1) return;
  connect();
}, PERIODIC_INTERVAL_MS);
