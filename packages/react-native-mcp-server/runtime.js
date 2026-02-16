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
/** requestId -> { resolve, reject } for webview_evaluate_script result feedback via postMessage */
var _webViewEvalPending = {};
var _webViewEvalRequestId = 0;
var _scrollRefs = {};
var _consoleLogs = [];
var _consoleLogId = 0;
var _CONSOLE_BUFFER_SIZE = 500;

var _networkRequests = [];
var _networkRequestId = 0;
var _NETWORK_BUFFER_SIZE = 200;
var _NETWORK_BODY_LIMIT = 10000;

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

// ─── querySelector 셀렉터 파서 & 매칭 엔진 ──────────────────────

/**
 * 셀렉터 문자열을 AST로 파싱한다 (재귀 하강 파서).
 * 지원 문법:
 *   Type#testID[attr="val"]:text("..."):nth(N):has-press:has-scroll
 *   A > B (직접 자식), A B (후손), A, B (OR)
 */
function parseSelector(input) {
  var pos = 0;
  var len = input.length;

  function isIdentChar(ch) {
    return /[A-Za-z0-9_.-]/.test(ch);
  }

  function skipSpaces() {
    while (pos < len && (input.charAt(pos) === ' ' || input.charAt(pos) === '\t')) pos++;
  }

  function readIdentifier() {
    var start = pos;
    while (pos < len && isIdentChar(input.charAt(pos))) pos++;
    return input.substring(start, pos);
  }

  function readQuotedString() {
    var quote = input.charAt(pos);
    if (quote !== '"' && quote !== "'") return '';
    pos++; // skip opening quote
    var start = pos;
    while (pos < len && input.charAt(pos) !== quote) {
      if (input.charAt(pos) === '\\') pos++; // skip escaped char
      pos++;
    }
    if (pos >= len) return null; // 따옴표 미닫힘 → 파싱 실패로 처리
    var str = input.substring(start, pos);
    pos++; // skip closing quote
    return str;
  }

  function readNumber() {
    var start = pos;
    while (pos < len && /[0-9]/.test(input.charAt(pos))) pos++;
    return parseInt(input.substring(start, pos), 10);
  }

  function parseCompound() {
    var sel = {
      type: null,
      testID: null,
      attrs: [],
      text: null,
      nth: -1,
      hasPress: false,
      hasScroll: false,
    };

    // Optional type selector
    var ch = pos < len ? input.charAt(pos) : '';
    if (/[A-Za-z_]/.test(ch)) {
      sel.type = readIdentifier();
    }

    // Optional #testID
    if (pos < len && input.charAt(pos) === '#') {
      pos++; // skip #
      sel.testID = readIdentifier();
    }

    // Zero or more [attr="val"]
    while (pos < len && input.charAt(pos) === '[') {
      pos++; // skip [
      skipSpaces();
      var attrName = readIdentifier();
      skipSpaces();
      if (pos < len && input.charAt(pos) === '=') {
        pos++; // skip =
        skipSpaces();
        var attrVal = readQuotedString();
        if (attrVal === null) throw new Error('Unclosed quote in selector [attr="..."]');
        sel.attrs.push({ name: attrName, value: attrVal });
      }
      skipSpaces();
      if (pos < len && input.charAt(pos) === ']') pos++; // skip ]
    }

    // Zero or more :pseudo selectors
    while (pos < len && input.charAt(pos) === ':') {
      pos++; // skip :
      var pseudo = readIdentifier();
      if (pseudo === 'text') {
        if (pos < len && input.charAt(pos) === '(') {
          pos++; // skip (
          skipSpaces();
          var textVal = readQuotedString();
          if (textVal === null) throw new Error('Unclosed quote in selector :text(...)');
          sel.text = textVal;
          skipSpaces();
          if (pos < len && input.charAt(pos) === ')') pos++; // skip )
        }
      } else if (pseudo === 'nth') {
        if (pos < len && input.charAt(pos) === '(') {
          pos++; // skip (
          skipSpaces();
          sel.nth = readNumber();
          skipSpaces();
          if (pos < len && input.charAt(pos) === ')') pos++; // skip )
        }
      } else if (pseudo === 'has-press') {
        sel.hasPress = true;
      } else if (pseudo === 'has-scroll') {
        sel.hasScroll = true;
      }
    }

    return sel;
  }

  function parseComplex() {
    skipSpaces();
    var segments = [];
    segments.push({ selector: parseCompound(), combinator: null });

    while (pos < len) {
      var beforeSkip = pos;
      skipSpaces();
      if (pos >= len || input.charAt(pos) === ',') break;

      var combinator = ' '; // 기본: 후손 (descendant)
      if (input.charAt(pos) === '>') {
        combinator = '>';
        pos++; // skip >
        skipSpaces();
      } else if (pos === beforeSkip) {
        // 공백 없이 바로 다음 토큰 → compound의 연속이므로 break
        break;
      }

      // 다음 compound가 있는지 확인
      var nextCh = pos < len ? input.charAt(pos) : '';
      if (!/[A-Za-z_#[:]/.test(nextCh)) break;

      segments.push({ selector: parseCompound(), combinator: combinator });
    }

    return { segments: segments };
  }

  var selectors = [];
  selectors.push(parseComplex());
  while (pos < len) {
    skipSpaces();
    if (pos >= len || input.charAt(pos) !== ',') break;
    pos++; // skip comma
    selectors.push(parseComplex());
  }

  return { selectors: selectors };
}

/** compound 셀렉터가 단일 fiber 노드에 매칭되는지 검사 */
function matchesCompound(fiber, compound, TextComp, ImgComp) {
  if (!fiber) return false;
  var props = fiber.memoizedProps || {};

  // 타입 검사
  if (compound.type !== null && getFiberTypeName(fiber) !== compound.type) return false;

  // testID 검사
  if (compound.testID !== null && props.testID !== compound.testID) return false;

  // 속성 검사
  for (var i = 0; i < compound.attrs.length; i++) {
    var attr = compound.attrs[i];
    if (String(props[attr.name] || '') !== attr.value) return false;
  }

  // 텍스트 검사 (substring)
  if (compound.text !== null) {
    var text = collectText(fiber, TextComp).replace(/\s+/g, ' ').trim();
    if (text.indexOf(compound.text) === -1) return false;
  }

  // :has-press
  if (compound.hasPress && typeof props.onPress !== 'function') return false;

  // :has-scroll
  if (compound.hasScroll) {
    var sn = fiber.stateNode;
    if (!sn || (typeof sn.scrollTo !== 'function' && typeof sn.scrollToOffset !== 'function'))
      return false;
  }

  return true;
}

/** 계층 셀렉터(A > B, A B) 매칭 — fiber.return을 상향 탐색 */
function matchesComplexSelector(fiber, complex, TextComp, ImgComp) {
  var segs = complex.segments;
  var last = segs.length - 1;

  // 마지막 segment가 현재 fiber에 매칭되어야 함
  if (!matchesCompound(fiber, segs[last].selector, TextComp, ImgComp)) return false;

  var current = fiber;
  for (var i = last - 1; i >= 0; i--) {
    var combinator = segs[i + 1].combinator;
    var targetSel = segs[i].selector;

    if (combinator === '>') {
      // 직접 부모가 매칭되어야 함
      current = current.return;
      if (!current || !matchesCompound(current, targetSel, TextComp, ImgComp)) return false;
    } else {
      // 후손: 조상 중 하나가 매칭되면 됨
      current = current.return;
      while (current) {
        if (matchesCompound(current, targetSel, TextComp, ImgComp)) break;
        current = current.return;
      }
      if (!current) return false;
    }
  }
  return true;
}

/** testID 없는 fiber의 경로 기반 uid 계산 ("0.1.2" 형식) */
function getPathUid(fiber) {
  var parts = [];
  var cur = fiber;
  while (cur && cur.return) {
    var parent = cur.return;
    var idx = 0;
    var ch = parent.child;
    while (ch) {
      if (ch === cur) break;
      ch = ch.sibling;
      idx++;
    }
    parts.unshift(idx);
    cur = parent;
  }
  parts.unshift(0); // root
  return parts.join('.');
}

/** path("0.1.2")로 Fiber 트리에서 노드 찾기. getComponentTree와 동일한 인덱스 규칙. */
function getFiberByPath(root, pathStr) {
  if (!root || typeof pathStr !== 'string') return null;
  var parts = pathStr.trim().split('.');
  var fiber = root;
  for (var i = 0; i < parts.length; i++) {
    if (!fiber) return null;
    var idx = parseInt(parts[i], 10);
    if (i === 0) {
      if (idx !== 0) return null;
      continue;
    }
    var child = fiber.child;
    var j = 0;
    while (child && j < idx) {
      child = child.sibling;
      j++;
    }
    fiber = child;
  }
  return fiber;
}

/** uid가 경로 형식인지 ("0", "0.1", "0.1.2" 등) */
function isPathUid(uid) {
  return typeof uid === 'string' && /^\d+(\.\d+)*$/.test(uid.trim());
}

/** fiber 노드를 결과 객체로 직렬화 */
function fiberToResult(fiber, TextComp, ImgComp) {
  var props = fiber.memoizedProps || {};
  var typeName = getFiberTypeName(fiber);
  var testID =
    typeof props.testID === 'string' && props.testID.trim() ? props.testID.trim() : undefined;
  var text = collectText(fiber, TextComp).replace(/\s+/g, ' ').trim() || undefined;
  var a11y =
    typeof props.accessibilityLabel === 'string' && props.accessibilityLabel.trim()
      ? props.accessibilityLabel.trim()
      : undefined;
  var hasOnPress = typeof props.onPress === 'function';
  var hasOnLongPress = typeof props.onLongPress === 'function';
  var sn = fiber.stateNode;
  var hasScrollTo = !!(
    sn &&
    (typeof sn.scrollTo === 'function' || typeof sn.scrollToOffset === 'function')
  );

  var uid = testID || getPathUid(fiber);
  var result = { uid: uid, type: typeName };
  if (testID) result.testID = testID;
  if (text) result.text = text;
  if (a11y) result.accessibilityLabel = a11y;
  result.hasOnPress = hasOnPress;
  result.hasOnLongPress = hasOnLongPress;
  result.hasScrollTo = hasScrollTo;
  // Fabric: measureViewSync → 동기 좌표, Bridge: null
  var measure = null;
  try {
    measure = MCP.measureViewSync(uid);
  } catch (e) {}
  result.measure = measure;
  return result;
}

// ─── Android 루트 뷰 Y 오프셋 (상태바 등 시스템 UI 보정) ─────────
// Android에서 measureInWindow는 윈도우 기준 좌표를 반환하지만
// adb shell input은 스크린 절대 좌표를 사용. 루트 뷰의 pageY(-36dp 등)가
// 그 차이. iOS는 offset 0이므로 Android만 보정.
var _screenOffsetX = 0;
var _screenOffsetY = 0;
var _screenOffsetResolved = false;

function resolveScreenOffset() {
  if (_screenOffsetResolved) return;
  _screenOffsetResolved = true;
  try {
    var g = typeof globalThis !== 'undefined' ? globalThis : global;
    // Android만 보정 필요 (iOS는 offset 0)
    var Platform = require('react-native').Platform;
    if (!Platform || Platform.OS !== 'android') return;

    // 루트 Fiber의 host node를 찾아 measureInWindow
    var root = getFiberRoot();
    if (!root || !g.nativeFabricUIManager) return;
    // 루트 fiber → 첫 번째 host fiber (stateNode가 있는)
    var fiber = root;
    var hostFiber = null;
    (function findHost(f) {
      if (!f || hostFiber) return;
      if (f.stateNode && (f.tag === 5 || f.tag === 27)) {
        hostFiber = f;
        return;
      }
      findHost(f.child);
    })(fiber);
    if (!hostFiber) return;
    var node = hostFiber.stateNode;
    var shadowNode =
      node.node ||
      (node._internalInstanceHandle &&
        node._internalInstanceHandle.stateNode &&
        node._internalInstanceHandle.stateNode.node);
    if (!shadowNode) return;
    g.nativeFabricUIManager.measureInWindow(shadowNode, function (x, y) {
      // 루트가 pageY=-36이면 offset = -(-36) = 36
      _screenOffsetX = -x;
      _screenOffsetY = -y;
    });
  } catch (e) {
    /* ignore */
  }
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
    // Fiber fallback: Babel 주입(INJECT_PRESS_HANDLER) 비활성 시 Fiber memoizedProps.onPress() 직접 호출
    var root = getFiberRoot();
    if (root) {
      var found = (function findByTestID(fiber) {
        if (!fiber) return null;
        if (
          fiber.memoizedProps &&
          fiber.memoizedProps.testID === testID &&
          typeof fiber.memoizedProps.onPress === 'function'
        )
          return fiber;
        return findByTestID(fiber.child) || findByTestID(fiber.sibling);
      })(root);
      if (found) {
        found.memoizedProps.onPress();
        return true;
      }
    }
    return false;
  },
  triggerLongPress: function (testID) {
    var root = getFiberRoot();
    if (!root) return false;
    var found = (function find(fiber) {
      if (!fiber) return null;
      if (
        fiber.memoizedProps &&
        fiber.memoizedProps.testID === testID &&
        typeof fiber.memoizedProps.onLongPress === 'function'
      )
        return fiber;
      return find(fiber.child) || find(fiber.sibling);
    })(root);
    if (found) {
      found.memoizedProps.onLongPress();
      return true;
    }
    return false;
  },
  getRegisteredPressTestIDs: function () {
    return Object.keys(_pressHandlers);
  },
  /**
   * 클릭 가능 요소 목록 (uid + label). Fiber 트리에서 onPress 있는 모든 노드 수집.
   * _pressHandlers 레지스트리가 있으면 우선 사용, 없으면 Fiber 순회.
   */
  getClickables: function () {
    var ids = Object.keys(_pressHandlers);
    // 레지스트리에 항목이 있으면 기존 방식 (INJECT_PRESS_HANDLER=true 시)
    if (ids.length > 0) {
      var root0 = getFiberRoot();
      var c0 = root0 ? getRNComponents() : null;
      return ids.map(function (id) {
        var label = '';
        if (root0 && c0) {
          (function visit(fiber) {
            if (!fiber || label) return;
            if (fiber.memoizedProps && fiber.memoizedProps.testID === id) {
              label = collectText(fiber, c0.Text).replace(/\s+/g, ' ').trim();
              return;
            }
            visit(fiber.child);
            visit(fiber.sibling);
          })(root0);
        }
        return { uid: id, label: label };
      });
    }
    // Fiber fallback: onPress 있는 모든 노드 수집
    try {
      var root = getFiberRoot();
      if (!root) return [];
      var c = getRNComponents();
      var out = [];
      function visit(fiber) {
        if (!fiber) return;
        var props = fiber.memoizedProps;
        if (typeof (props && props.onPress) === 'function') {
          var testID = (props && props.testID) || undefined;
          var label = getLabel(fiber, c.Text, c.Image);
          out.push({ uid: testID || '', label: label });
          visit(fiber.sibling);
          return;
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
  /**
   * Fiber 트리에서 라벨(텍스트)에 해당하는 onLongPress 노드들을 순서대로 수집한 뒤, index번째(0-based) 호출.
   */
  longPressByLabel: function (labelSubstring, index) {
    if (typeof labelSubstring !== 'string' || !labelSubstring.trim()) return false;
    try {
      var root = getFiberRoot();
      if (!root) return false;
      var c = getRNComponents();
      var search = labelSubstring.trim();
      var matches = [];
      function visitLP(fiber) {
        if (!fiber) return;
        var props = fiber.memoizedProps;
        var onLP = props && props.onLongPress;
        if (typeof onLP === 'function') {
          var label = getLabel(fiber, c.Text, c.Image);
          if (label.indexOf(search) !== -1) matches.push(onLP);
          visitLP(fiber.sibling);
          return;
        }
        visitLP(fiber.child);
        visitLP(fiber.sibling);
      }
      visitLP(root);
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
  /**
   * TextInput에 텍스트 입력. Fiber에서 testID 매칭 → onChangeText(text) 호출 + setNativeProps 동기화.
   */
  typeText: function (testID, text) {
    try {
      var root = getFiberRoot();
      if (!root) return { ok: false, error: 'No Fiber root' };
      var found = (function find(fiber) {
        if (!fiber) return null;
        if (
          fiber.memoizedProps &&
          fiber.memoizedProps.testID === testID &&
          typeof fiber.memoizedProps.onChangeText === 'function'
        )
          return fiber;
        return find(fiber.child) || find(fiber.sibling);
      })(root);
      if (!found) return { ok: false, error: 'TextInput not found: ' + testID };
      found.memoizedProps.onChangeText(text);
      if (found.stateNode && typeof found.stateNode.setNativeProps === 'function') {
        found.stateNode.setNativeProps({ text: text });
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
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
  /** 등록된 WebView 내부에서 임의의 JavaScript를 실행 (동기, 반환값 없음) */
  evaluateInWebView: function (id, script) {
    var ref = _webViews[id];
    if (!ref || typeof ref.injectJavaScript !== 'function')
      return { ok: false, error: 'WebView not found or injectJavaScript not available' };
    ref.injectJavaScript(script);
    return { ok: true };
  },
  /**
   * WebView에서 스크립트 실행 후 postMessage로 결과 수신. 앱이 WebView onMessage에서
   * __REACT_NATIVE_MCP__.handleWebViewMessage(event.nativeEvent.data) 호출 시 결과 반환.
   * @returns Promise<{ ok: true, value: string } | { ok: false, error: string }>
   */
  evaluateInWebViewAsync: function (id, script) {
    var ref = _webViews[id];
    if (!ref || typeof ref.injectJavaScript !== 'function')
      return Promise.resolve({
        ok: false,
        error: 'WebView not found or injectJavaScript not available',
      });
    var requestId = 'wv_' + ++_webViewEvalRequestId + '_' + Date.now();
    var wrapped =
      '(function(){ var __reqId=' +
      JSON.stringify(requestId) +
      '; var __script=' +
      JSON.stringify(script) +
      '; try { var __r=(function(){ return eval(__script); })(); var __v=typeof __r==="string" ? __r : (function(){ try { return JSON.stringify(__r); } catch(e){ return String(__r); } })(); window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({__mcpEvalResult:true,requestId:__reqId,value:__v})); } catch(e) { window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({__mcpEvalResult:true,requestId:__reqId,error:(e&&e.message)||String(e)})); } })();';
    return new Promise(function (resolve) {
      var t = setTimeout(function () {
        if (_webViewEvalPending[requestId]) {
          delete _webViewEvalPending[requestId];
          resolve({ ok: false, error: 'WebView eval timeout (10s)' });
        }
      }, 10000);
      _webViewEvalPending[requestId] = { resolve: resolve, timeout: t };
      ref.injectJavaScript(wrapped);
    });
  },
  /**
   * WebView onMessage에서 호출. postMessage로 온 __mcpEvalResult 수신 시 evaluateInWebViewAsync Promise resolve.
   * @returns {boolean} true if the message was __mcpEvalResult (consumed), false otherwise. 사용자 onMessage와 함께 쓰려면 createWebViewOnMessage 사용.
   */
  handleWebViewMessage: function (data) {
    if (!data || typeof data !== 'string') return false;
    try {
      var payload = JSON.parse(data);
      if (!payload || payload.__mcpEvalResult !== true || !payload.requestId) return false;
      var reqId = payload.requestId;
      var pending = _webViewEvalPending[reqId];
      if (!pending) return false;
      delete _webViewEvalPending[reqId];
      if (pending.timeout) clearTimeout(pending.timeout);
      if (payload.error != null) pending.resolve({ ok: false, error: payload.error });
      else pending.resolve({ ok: true, value: payload.value });
      return true;
    } catch (_) {
      return false;
    }
  },
  /**
   * WebView onMessage와 사용자 핸들러를 함께 쓰기 위한 래퍼. 우리 __mcpEvalResult는 처리하고, 나머지 메시지는 userHandler에 넘김.
   * 사용: onMessage={__REACT_NATIVE_MCP__.createWebViewOnMessage((e) => { ... })}
   */
  createWebViewOnMessage: function (userHandler) {
    if (typeof userHandler !== 'function')
      return function (e) {
        __REACT_NATIVE_MCP__.handleWebViewMessage(e.nativeEvent.data);
      };
    return function (e) {
      var data = e && e.nativeEvent && e.nativeEvent.data;
      var consumed = __REACT_NATIVE_MCP__.handleWebViewMessage(data);
      if (!consumed) userHandler(e);
    };
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
    // Fiber fallback: Babel 주입(INJECT_SCROLL_REF) 비활성 시 Fiber stateNode에서 직접 접근
    if (!ref) {
      var root = getFiberRoot();
      if (root) {
        ref = (function findScrollable(fiber) {
          if (!fiber) return null;
          if (fiber.memoizedProps && fiber.memoizedProps.testID === testID && fiber.stateNode) {
            var si = fiber.stateNode;
            if (typeof si.scrollTo === 'function' || typeof si.scrollToOffset === 'function')
              return si;
          }
          return findScrollable(fiber.child) || findScrollable(fiber.sibling);
        })(root);
      }
    }
    if (!ref) return { ok: false, error: 'ScrollView not found for testID: ' + testID };
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
      return { ok: false, error: 'scrollTo/scrollToOffset not available on stateNode' };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  },
  getRegisteredScrollTestIDs: function () {
    return Object.keys(_scrollRefs);
  },
  /**
   * 콘솔 로그 조회. options: { level?, since?, limit? }
   * level 맵핑: 0=log, 1=info, 2=warn, 3=error
   */
  getConsoleLogs: function (options) {
    var opts = typeof options === 'object' && options !== null ? options : {};
    var levelMap = { log: 0, info: 1, warn: 2, error: 3 };
    var out = _consoleLogs;
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
  },
  /** 콘솔 로그 버퍼 초기화 */
  clearConsoleLogs: function () {
    _consoleLogs = [];
    _consoleLogId = 0;
  },
  /**
   * 네트워크 요청 조회. options: { url?, method?, status?, since?, limit? }
   * url: substring 매칭, method: 정확 매칭, status: 정확 매칭
   */
  getNetworkRequests: function (options) {
    var opts = typeof options === 'object' && options !== null ? options : {};
    var out = _networkRequests;
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
  },
  /** 네트워크 요청 버퍼 초기화 */
  clearNetworkRequests: function () {
    _networkRequests = [];
    _networkRequestId = 0;
  },
  /**
   * querySelector(selector) → 첫 번째 매칭 fiber 정보 또는 null.
   * 셀렉터 문법: Type#testID[attr="val"]:text("..."):nth(N):has-press:has-scroll
   * 콤비네이터: ">" (직접 자식), " " (후손), "," (OR)
   * 반환: { uid, type, testID?, text?, accessibilityLabel?, hasOnPress, hasScrollTo }
   */
  querySelector: function (selector) {
    if (typeof selector !== 'string' || !selector.trim()) return null;
    try {
      var all = MCP.querySelectorAll(selector);
      return all.length > 0 ? all[0] : null;
    } catch (e) {
      return null;
    }
  },
  /**
   * querySelectorAll(selector) → 매칭되는 모든 fiber 정보 배열.
   * 반환: [{ uid, type, testID?, text?, accessibilityLabel?, hasOnPress, hasScrollTo }]
   */
  querySelectorAll: function (selector) {
    if (typeof selector !== 'string' || !selector.trim()) return [];
    try {
      var root = getFiberRoot();
      if (!root) return [];
      var c = getRNComponents();
      var parsed;
      try {
        parsed = parseSelector(selector.trim());
      } catch (parseErr) {
        return []; // 따옴표 미닫힘 등 파싱 실패 시 빈 배열
      }
      var results = [];

      for (var si = 0; si < parsed.selectors.length; si++) {
        var complex = parsed.selectors[si];
        var lastSeg = complex.segments[complex.segments.length - 1];
        var nth = lastSeg.selector.nth;
        var matchCount = 0;

        (function visit(fiber) {
          if (!fiber) return;
          if (matchesComplexSelector(fiber, complex, c.Text, c.Image)) {
            if (nth === -1) {
              results.push(fiberToResult(fiber, c.Text, c.Image));
            } else if (matchCount === nth) {
              results.push(fiberToResult(fiber, c.Text, c.Image));
            }
            matchCount++;
          }
          visit(fiber.child);
          visit(fiber.sibling);
        })(root);
      }

      // 같은 testID를 가진 중복 제거: capabilities가 더 많은 쪽 유지
      // (예: ScrollView가 composite + class instance 2개 fiber로 나올 때)
      var deduped = [];
      var seen = {};
      for (var di = 0; di < results.length; di++) {
        var r = results[di];
        var key = r.uid || '';
        if (!key || seen[key] === undefined) {
          seen[key] = deduped.length;
          deduped.push(r);
        } else {
          // 이미 있으면 capabilities 병합 (hasScrollTo, hasOnPress 중 true 우선)
          var prev = deduped[seen[key]];
          if (r.hasScrollTo && !prev.hasScrollTo) deduped[seen[key]] = r;
          else if (r.hasOnPress && !prev.hasOnPress) deduped[seen[key]] = r;
        }
      }
      return deduped;
    } catch (e) {
      return [];
    }
  },

  /**
   * querySelectorWithMeasure(selector) → Promise<결과 | null>
   * Fabric: fiberToResult의 measureViewSync로 이미 measure 포함 → 즉시 반환.
   * Bridge: measure가 null인 경우 async measureView fallback.
   */
  querySelectorWithMeasure: function (selector) {
    var el = MCP.querySelector(selector);
    if (!el) return Promise.resolve(null);
    if (el.measure) return Promise.resolve(el);
    // Bridge fallback
    return MCP.measureView(el.uid)
      .then(function (m) {
        el.measure = m;
        return el;
      })
      .catch(function () {
        return el;
      });
  },

  /**
   * querySelectorAllWithMeasure(selector) → Promise<배열>
   * measure가 null인 요소만 비동기 보충.
   */
  querySelectorAllWithMeasure: function (selector) {
    var list = MCP.querySelectorAll(selector);
    if (!list.length) return Promise.resolve(list);
    // measure가 null인 요소만 비동기 보충
    var needsMeasure = [];
    for (var i = 0; i < list.length; i++) {
      if (!list[i].measure) needsMeasure.push(i);
    }
    if (!needsMeasure.length) return Promise.resolve(list);
    // Bridge fallback — sequential measure
    var chain = Promise.resolve();
    needsMeasure.forEach(function (idx) {
      chain = chain.then(function () {
        return MCP.measureView(list[idx].uid)
          .then(function (m) {
            list[idx].measure = m;
          })
          .catch(function () {});
      });
    });
    return chain.then(function () {
      return list;
    });
  },

  // ─── 화면 정보 · 뷰 좌표 측정 ─────────────────────────────────

  /**
   * getScreenInfo() → { screen, window, scale, fontScale, orientation }
   * - screen: 물리 디스플레이 크기 (points)
   * - window: 앱 윈도우 크기 (points, 상태바·노치 제외 가능)
   * - scale: 픽셀 밀도 (1x, 2x, 3x)
   * - fontScale: 접근성 글꼴 배율
   * - orientation: 'portrait' | 'landscape'
   */
  getScreenInfo: function () {
    try {
      var rn = typeof require !== 'undefined' && require('react-native');
      if (!rn) return { error: 'react-native not available' };
      var screen = rn.Dimensions.get('screen');
      var win = rn.Dimensions.get('window');
      var pixelRatio = rn.PixelRatio ? rn.PixelRatio.get() : 1;
      var fontScale = rn.PixelRatio ? rn.PixelRatio.getFontScale() : 1;
      return {
        screen: { width: screen.width, height: screen.height },
        window: { width: win.width, height: win.height },
        scale: pixelRatio,
        fontScale: fontScale,
        orientation: win.width > win.height ? 'landscape' : 'portrait',
      };
    } catch (e) {
      return { error: String(e) };
    }
  },

  /**
   * measureView(uid) → Promise<{ x, y, width, height, pageX, pageY }>
   * uid: testID 또는 경로("0.1.2"). query_selector로 얻은 uid 그대로 사용 가능.
   * Fiber에서 native node를 찾아 measureInWindow (Fabric) 또는 measure (Bridge)로 절대 좌표 반환.
   * pageX/pageY: 화면 왼쪽 상단 기준 절대 좌표 (points).
   */
  measureView: function (uid) {
    return new Promise(function (resolve, reject) {
      try {
        var root = getFiberRoot();
        if (!root) return reject(new Error('no fiber root'));

        var found = null;
        if (isPathUid(uid)) {
          found = getFiberByPath(root, uid);
          if (found && !found.stateNode) found = null;
        }
        if (!found) {
          // testID로 host fiber 찾기
          (function find(fiber) {
            if (!fiber || found) return;
            if (fiber.memoizedProps && fiber.memoizedProps.testID === uid && fiber.stateNode) {
              found = fiber;
              return;
            }
            find(fiber.child);
            if (!found) find(fiber.sibling);
          })(root);
        }

        if (!found) return reject(new Error('uid "' + uid + '" not found or has no native view'));

        var node = found.stateNode;

        // Fabric: stateNode.node + nativeFabricUIManager.measureInWindow
        var g = typeof globalThis !== 'undefined' ? globalThis : global;
        if (g.nativeFabricUIManager && node) {
          var shadowNode =
            node.node ||
            (node._internalInstanceHandle &&
              node._internalInstanceHandle.stateNode &&
              node._internalInstanceHandle.stateNode.node);
          // Reanimated AnimatedComponent: _viewInfo.shadowNodeWrapper
          if (!shadowNode && node._viewInfo && node._viewInfo.shadowNodeWrapper) {
            shadowNode = node._viewInfo.shadowNodeWrapper;
          }
          if (shadowNode) {
            resolveScreenOffset();
            g.nativeFabricUIManager.measureInWindow(shadowNode, function (x, y, w, h) {
              resolve({
                x: x,
                y: y,
                width: w,
                height: h,
                pageX: x + _screenOffsetX,
                pageY: y + _screenOffsetY,
              });
            });
            return;
          }
        }

        // Bridge: UIManager.measure
        var rn = typeof require !== 'undefined' && require('react-native');
        if (rn && rn.UIManager && rn.findNodeHandle) {
          var handle = rn.findNodeHandle(node);
          if (handle) {
            rn.UIManager.measure(handle, function (x, y, w, h, pageX, pageY) {
              resolve({ x: x, y: y, width: w, height: h, pageX: pageX, pageY: pageY });
            });
            return;
          }
        }

        reject(new Error('cannot measure: no native node'));
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * measureViewSync(uid) → { x, y, width, height, pageX, pageY } | null
   * uid: testID 또는 경로("0.1.2"). Fabric에서는 동기 호출 가능. Bridge에서는 null → measureView() 사용 권장.
   */
  measureViewSync: function (uid) {
    try {
      var root = getFiberRoot();
      if (!root) return null;

      var found = null;
      if (isPathUid(uid)) {
        found = getFiberByPath(root, uid);
        if (found && !found.stateNode) found = null;
      }
      if (!found) {
        (function find(fiber) {
          if (!fiber || found) return;
          if (fiber.memoizedProps && fiber.memoizedProps.testID === uid && fiber.stateNode) {
            found = fiber;
            return;
          }
          find(fiber.child);
          if (!found) find(fiber.sibling);
        })(root);
      }

      if (!found) return null;

      var node = found.stateNode;
      var g = typeof globalThis !== 'undefined' ? globalThis : global;

      if (g.nativeFabricUIManager && node) {
        var shadowNode =
          node.node ||
          (node._internalInstanceHandle &&
            node._internalInstanceHandle.stateNode &&
            node._internalInstanceHandle.stateNode.node);
        if (!shadowNode && node._viewInfo && node._viewInfo.shadowNodeWrapper) {
          shadowNode = node._viewInfo.shadowNodeWrapper;
        }
        if (shadowNode) {
          var result = null;
          resolveScreenOffset();
          g.nativeFabricUIManager.measureInWindow(shadowNode, function (x, y, w, h) {
            result = {
              x: x,
              y: y,
              width: w,
              height: h,
              pageX: x + _screenOffsetX,
              pageY: y + _screenOffsetY,
            };
          });
          return result; // Fabric에서는 콜백이 동기 실행
        }
      }

      return null; // Bridge → measureView() 사용 필요
    } catch (e) {
      return null;
    }
  },
};
if (typeof global !== 'undefined') global.__REACT_NATIVE_MCP__ = MCP;
if (typeof globalThis !== 'undefined') globalThis.__REACT_NATIVE_MCP__ = MCP;

// ─── nativeLoggingHook 체이닝 — 콘솔 로그 캡처 ─────────────────
var _origNativeLoggingHook = typeof global !== 'undefined' ? global.nativeLoggingHook : undefined;
if (typeof global !== 'undefined') {
  global.nativeLoggingHook = function (msg, level) {
    _consoleLogId++;
    _consoleLogs.push({
      id: _consoleLogId,
      message: msg,
      level: level,
      timestamp: Date.now(),
    });
    if (_consoleLogs.length > _CONSOLE_BUFFER_SIZE) _consoleLogs.shift();
    if (typeof _origNativeLoggingHook === 'function') _origNativeLoggingHook(msg, level);
  };
}

// ─── 네트워크 캡처 공통 헬퍼 ─────────────────────────────────────
function _pushNetworkEntry(entry) {
  _networkRequestId++;
  entry.id = _networkRequestId;
  _networkRequests.push(entry);
  if (_networkRequests.length > _NETWORK_BUFFER_SIZE) _networkRequests.shift();
}

function _truncateBody(body) {
  if (body == null) return null;
  var s = typeof body === 'string' ? body : String(body);
  return s.length > _NETWORK_BODY_LIMIT ? s.substring(0, _NETWORK_BODY_LIMIT) : s;
}

// ─── XHR monkey-patch — 네트워크 요청 캡처 ──────────────────────
// DEV/Release 무관하게 항상 설치. MCP.enable() 없이도 네트워크 캡처 동작.
(function () {
  if (typeof XMLHttpRequest === 'undefined') return;
  var XHR = XMLHttpRequest.prototype;
  var _origOpen = XHR.open;
  var _origSend = XHR.send;
  var _origSetRequestHeader = XHR.setRequestHeader;

  XHR.open = function (method, url) {
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

  XHR.setRequestHeader = function (name, value) {
    if (this.__mcpNetworkEntry) {
      this.__mcpNetworkEntry.requestHeaders[name] = value;
    }
    return _origSetRequestHeader.apply(this, arguments);
  };

  XHR.send = function (body) {
    var entry = this.__mcpNetworkEntry;
    if (entry) {
      entry.requestBody = _truncateBody(body);
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
          entry.responseBody = _truncateBody(xhr.responseText);
        } catch (_e) {
          entry.responseBody = null;
        }
        entry.duration = Date.now() - entry.startTime;
        entry.state = 'done';
        _pushNetworkEntry(entry);
      });

      xhr.addEventListener('error', function () {
        entry.duration = Date.now() - entry.startTime;
        entry.error = 'Network error';
        entry.state = 'error';
        _pushNetworkEntry(entry);
      });

      xhr.addEventListener('timeout', function () {
        entry.duration = Date.now() - entry.startTime;
        entry.error = 'Timeout';
        entry.state = 'error';
        _pushNetworkEntry(entry);
      });
    }
    return _origSend.apply(this, arguments);
  };
})();

// ─── fetch monkey-patch — 네이티브 fetch 요청 캡처 ──────────────
(function () {
  var g =
    typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : null;
  if (!g || typeof g.fetch !== 'function') return;
  var _origFetch = g.fetch;

  g.fetch = function (input, init) {
    var url = '';
    var method = 'GET';
    var requestHeaders = {};
    var requestBody = null;

    if (typeof input === 'string') {
      url = input;
    } else if (input && typeof input === 'object' && typeof input.url === 'string') {
      url = input.url;
      if (input.method) method = input.method.toUpperCase();
      if (input.headers) {
        try {
          if (typeof input.headers.forEach === 'function') {
            input.headers.forEach(function (v, k) {
              requestHeaders[k] = v;
            });
          } else if (typeof input.headers === 'object') {
            var hk = Object.keys(input.headers);
            for (var i = 0; i < hk.length; i++) requestHeaders[hk[i]] = input.headers[hk[i]];
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
            init.headers.forEach(function (v, k) {
              requestHeaders[k] = v;
            });
          } else if (typeof init.headers === 'object') {
            var hk2 = Object.keys(init.headers);
            for (var j = 0; j < hk2.length; j++) requestHeaders[hk2[j]] = init.headers[hk2[j]];
          }
        } catch (_e) {}
      }
      if (init.body != null) requestBody = init.body;
    }

    var bodyStr = null;
    if (requestBody != null) {
      bodyStr =
        typeof requestBody === 'string'
          ? requestBody
          : typeof requestBody.toString === 'function'
            ? requestBody.toString()
            : String(requestBody);
      if (bodyStr.length > _NETWORK_BODY_LIMIT) bodyStr = bodyStr.substring(0, _NETWORK_BODY_LIMIT);
    }

    var entry = {
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
      function (response) {
        entry.status = response.status;
        entry.statusText = response.statusText || null;
        try {
          var headerObj = {};
          if (response.headers && typeof response.headers.forEach === 'function') {
            response.headers.forEach(function (v, k) {
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
            .then(function (text) {
              entry.responseBody =
                text && text.length > _NETWORK_BODY_LIMIT
                  ? text.substring(0, _NETWORK_BODY_LIMIT)
                  : text || null;
              _pushNetworkEntry(entry);
            })
            .catch(function () {
              _pushNetworkEntry(entry);
            });
        } catch (_e) {
          _pushNetworkEntry(entry);
        }

        return response;
      },
      function (err) {
        entry.duration = Date.now() - entry.startTime;
        entry.error = err && err.message ? err.message : 'Network error';
        entry.state = 'error';
        _pushNetworkEntry(entry);
        throw err;
      }
    );
  };
})();

var _isDevMode =
  (typeof __DEV__ !== 'undefined' && __DEV__) ||
  (typeof process !== 'undefined' &&
    process.env &&
    process.env.REACT_NATIVE_MCP_ENABLED === 'true');

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
    // 메타데이터 수집 실패가 init 전송을 막지 않도록 분리
    var platform = null;
    var deviceName = null;
    var origin = null;
    var pixelRatio = null;
    try {
      var rn = require('react-native');
      platform = rn.Platform && rn.Platform.OS;
      deviceName = (rn.Platform && rn.Platform.constants && rn.Platform.constants.Model) || null;
      if (rn.PixelRatio) pixelRatio = rn.PixelRatio.get();
    } catch (_e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[MCP] Failed to read platform info:', _e && _e.message);
      }
    }
    try {
      var _rn = require('react-native');
      var scriptURL =
        _rn.NativeModules && _rn.NativeModules.SourceCode && _rn.NativeModules.SourceCode.scriptURL;
      if (scriptURL && typeof scriptURL === 'string') {
        // Hermes(RN 0.74 이하)에서 URL.origin 미구현 → protocol+host 수동 파싱
        try {
          origin = new URL(scriptURL).origin;
        } catch (_ue) {
          var match = scriptURL.match(/^(https?:\/\/[^/?#]+)/);
          if (match) origin = match[1];
        }
      }
    } catch (_e2) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[MCP] Failed to read metro URL:', _e2 && _e2.message);
      }
    }
    try {
      ws.send(
        JSON.stringify({
          type: 'init',
          platform: platform,
          deviceId: platform ? platform + '-1' : undefined,
          deviceName: deviceName,
          metroBaseUrl: origin,
          pixelRatio: pixelRatio,
        })
      );
    } catch (_e3) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[MCP] Failed to send init:', _e3 && _e3.message);
      }
    }
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
        function sendEvalResponse(res, err) {
          if (ws && ws.readyState === 1) {
            ws.send(
              JSON.stringify(err != null ? { id: msg.id, error: err } : { id: msg.id, result: res })
            );
          }
        }
        if (errMsg != null) {
          sendEvalResponse(null, errMsg);
        } else if (result != null && typeof result.then === 'function') {
          result.then(
            function (r) {
              sendEvalResponse(r, null);
            },
            function (e) {
              sendEvalResponse(null, e && e.message != null ? e.message : String(e));
            }
          );
        } else {
          sendEvalResponse(result, null);
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
