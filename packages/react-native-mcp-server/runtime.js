/**
 * React Native 앱에 주입되는 MCP 런타임 (Phase 1)
 * - __REACT_NATIVE_MCP__.registerComponent → AppRegistry.registerComponent 위임
 * - __DEV__ 시 WebSocket으로 MCP 서버(12300)에 연결, eval 요청 처리
 *
 * Metro transformer가 진입점 상단에 require('@ohah/react-native-mcp-server/runtime') 주입
 * global은 모듈 로드 직후 최상단에서 설정해 ReferenceError 방지.
 */

'use strict';

var _pressHandlers = {};
var _webViews = {};

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
    if (Array.isArray(c))
      return c
        .map(function (x) {
          return typeof x === 'string' ? x : '';
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
   * Fiber 트리에서 라벨(텍스트)에 해당하는 노드를 찾아 onPress 호출. testID 없어도 동작.
   */
  pressByLabel: function (labelSubstring) {
    if (typeof labelSubstring !== 'string' || !labelSubstring.trim()) return false;
    try {
      var root = getFiberRoot();
      if (!root) return false;
      var c = getRNComponents();
      var search = labelSubstring.trim();
      var found = false;
      function visit(fiber) {
        if (!fiber || found) return;
        var props = fiber.memoizedProps;
        var onPress = props && props.onPress;
        if (typeof onPress === 'function') {
          var label = getLabel(fiber, c.Text, c.Image);
          if (label.indexOf(search) !== -1) {
            try {
              onPress();
            } catch (e) {}
            found = true;
            return;
          }
          visit(fiber.sibling);
          return;
        }
        visit(fiber.child);
        visit(fiber.sibling);
      }
      visit(root);
      return found;
    } catch (e) {
      return false;
    }
  },
  registerWebView: function (ref, id) {
    if (ref && typeof id === 'string') _webViews[id] = ref;
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
  getRegisteredWebViewIds: function () {
    return Object.keys(_webViews);
  },
};
if (typeof global !== 'undefined') global.__REACT_NATIVE_MCP__ = MCP;
if (typeof globalThis !== 'undefined') globalThis.__REACT_NATIVE_MCP__ = MCP;
if (typeof __DEV__ !== 'undefined' && __DEV__ && typeof console !== 'undefined' && console.warn) {
  console.warn('[MCP] runtime loaded, __REACT_NATIVE_MCP__ available');
}

// ─── WebSocket 연결 (DEV 전용) ──────────────────────────────────

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  var wsUrl = 'ws://localhost:12300';
  var ws = null;
  var _reconnectTimer = null;
  var reconnectDelay = 1000;

  function connect() {
    ws = new WebSocket(wsUrl);
    ws.onopen = function () {
      reconnectDelay = 1000;
      if (_reconnectTimer != null) clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
      try {
        var rn = require('react-native');
        var scriptURL =
          rn.NativeModules && rn.NativeModules.SourceCode && rn.NativeModules.SourceCode.scriptURL;
        if (scriptURL && typeof scriptURL === 'string') {
          var origin = new URL(scriptURL).origin;
          ws.send(JSON.stringify({ type: 'init', metroBaseUrl: origin }));
        }
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

  // 네이티브 브릿지 준비 후 연결: runApplication은 호스트가 앱을 시작할 때 호출
  var _AppRegistry = require('react-native').AppRegistry;
  var _originalRun = _AppRegistry.runApplication;
  _AppRegistry.runApplication = function () {
    if (!ws) connect();
    return _originalRun.apply(this, arguments);
  };
}
