'use strict';

(function() {

//#region \0rolldown/runtime.js
	var __esmMin = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

//#endregion

//#region src/runtime/devtools-hook.ts
	var init_devtools_hook = __esmMin(() => {
		(function() {
			var g = typeof globalThis !== "undefined" ? globalThis : typeof global !== "undefined" ? global : null;
			if (!g || g.__REACT_DEVTOOLS_GLOBAL_HOOK__) return;
			var _renderers = /* @__PURE__ */ new Map();
			var _roots = /* @__PURE__ */ new Map();
			g.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
				supportsFiber: true,
				renderers: _renderers,
				inject: function(internals) {
					var id = _renderers.size + 1;
					_renderers.set(id, internals);
					return id;
				},
				onCommitFiberRoot: function(rendererID, root) {
					if (!_roots.has(rendererID)) _roots.set(rendererID, /* @__PURE__ */ new Set());
					_roots.get(rendererID).add(root);
				},
				onCommitFiberUnmount: function() {},
				getFiberRoots: function(rendererID) {
					return _roots.get(rendererID) || /* @__PURE__ */ new Set();
				}
			};
		})();
	});

//#endregion
//#region src/runtime/shared.ts
	function pushConsoleLog(entry) {
		consoleLogs.push(entry);
		if (consoleLogs.length > CONSOLE_BUFFER_SIZE) consoleLogs.shift();
	}
	function nextConsoleLogId() {
		return ++consoleLogId;
	}
	function resetConsoleLogs() {
		consoleLogs = [];
		consoleLogId = 0;
	}
	function nextNetworkRequestId() {
		return ++networkRequestId;
	}
	function resetNetworkRequests() {
		networkRequests = [];
		networkRequestId = 0;
	}
	function pushStateChange(entry) {
		stateChanges.push(entry);
		if (stateChanges.length > STATE_CHANGE_BUFFER) stateChanges.shift();
	}
	function nextStateChangeId() {
		return ++stateChangeId;
	}
	function resetStateChanges() {
		stateChanges = [];
		stateChangeId = 0;
	}
	function setRenderProfileActive(active) {
		renderProfileActive = active;
	}
	function setRenderProfileStartTime(t) {
		renderProfileStartTime = t;
	}
	function setRenderComponentFilter(components) {
		renderComponentFilter = components;
	}
	function setRenderIgnoreFilter(ignore) {
		renderIgnoreFilter = ignore;
	}
	function incrementRenderCommitCount() {
		return ++renderCommitCount;
	}
	function pushRenderEntry(entry) {
		renderEntries.push(entry);
		if (renderEntries.length > RENDER_BUFFER_SIZE) renderEntries.shift();
	}
	function resetRenderProfile() {
		renderProfileActive = false;
		renderProfileStartTime = 0;
		renderCommitCount = 0;
		renderEntries = [];
		renderComponentFilter = null;
		renderIgnoreFilter = null;
	}
	function setOverlayTopInsetDp(dp) {
		overlayTopInsetDp = dp;
		overlayTopInsetConfirmed = true;
	}
	function setOverlayActive(active) {
		overlayActive = active;
	}
	function setOverlayComponentFilter(components) {
		overlayComponentFilter = components;
	}
	function setOverlayIgnoreFilter(ignore) {
		overlayIgnoreFilter = ignore;
	}
	function setOverlayShowLabels(show) {
		overlayShowLabels = show;
	}
	function setOverlayFadeTimeout(ms) {
		overlayFadeTimeout = ms;
	}
	function setOverlayMaxHighlights(max) {
		overlayMaxHighlights = max;
	}
	function setOverlaySetHighlights(fn) {
		overlaySetHighlights = fn;
	}
	function resetOverlay() {
		overlayActive = false;
		overlayComponentFilter = null;
		overlayIgnoreFilter = null;
		overlayShowLabels = false;
		overlayFadeTimeout = 500;
		overlayMaxHighlights = 100;
		overlayRenderCounts = {};
	}
	var pressHandlers, consoleLogs, consoleLogId, CONSOLE_BUFFER_SIZE, networkRequests, networkRequestId, NETWORK_BUFFER_SIZE, NETWORK_BODY_LIMIT, networkMockRules, stateChanges, stateChangeId, STATE_CHANGE_BUFFER, renderProfileActive, renderProfileStartTime, renderCommitCount, renderEntries, renderComponentFilter, renderIgnoreFilter, RENDER_BUFFER_SIZE, renderHighlight, renderHighlightStyle, overlayTopInsetDp, overlayTopInsetConfirmed, overlayActive, overlayComponentFilter, overlayIgnoreFilter, overlayShowLabels, overlayFadeTimeout, overlayMaxHighlights, overlaySetHighlights, overlayRenderCounts;
	var init_shared = __esmMin(() => {
		pressHandlers = {};
		consoleLogs = [];
		consoleLogId = 0;
		CONSOLE_BUFFER_SIZE = 500;
		networkRequests = [];
		networkRequestId = 0;
		NETWORK_BUFFER_SIZE = 200;
		NETWORK_BODY_LIMIT = 1e4;
		networkMockRules = [];
		stateChanges = [];
		stateChangeId = 0;
		STATE_CHANGE_BUFFER = 300;
		renderProfileActive = false;
		renderProfileStartTime = 0;
		renderCommitCount = 0;
		renderEntries = [];
		renderComponentFilter = null;
		renderIgnoreFilter = null;
		RENDER_BUFFER_SIZE = 5e3;
		renderHighlight = typeof global !== "undefined" && global.__REACT_NATIVE_MCP_RENDER_HIGHLIGHT__ === true;
		renderHighlightStyle = typeof global !== "undefined" && global.__REACT_NATIVE_MCP_RENDER_HIGHLIGHT_STYLE__ === "react-scan" ? "react-scan" : "react-mcp";
		overlayTopInsetDp = 0;
		overlayTopInsetConfirmed = false;
		overlayActive = false;
		overlayComponentFilter = null;
		overlayIgnoreFilter = null;
		overlayShowLabels = false;
		overlayFadeTimeout = 500;
		overlayMaxHighlights = 100;
		overlaySetHighlights = null;
		overlayRenderCounts = {};
	});

//#endregion
//#region src/runtime/fiber-helpers.ts
/** DevTools hook에서 root Fiber를 얻는다. hook.getFiberRoots 우선, fallback으로 getCurrentFiber 사용. */
	function getFiberRootFromHook(hook, rendererID) {
		if (!hook) return null;
		function toRootFiber(r) {
			return r && r.current ? r.current : r;
		}
		if (typeof hook.getFiberRoots === "function") try {
			var roots = hook.getFiberRoots(rendererID);
			if (roots && roots.size > 0) {
				var first = roots.values().next().value;
				if (first) return toRootFiber(first);
			}
		} catch (_unused) {}
		var renderer = hook.renderers && hook.renderers.get(rendererID);
		if (renderer && typeof renderer.getCurrentFiber === "function") {
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
		return typeof global !== "undefined" && global.__REACT_DEVTOOLS_GLOBAL_HOOK__ || typeof globalThis !== "undefined" && globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ || null;
	}
	/** DevTools hook → fiber root. 없으면 null. */
	function getFiberRoot() {
		var hook = getDevToolsHook();
		if (!hook || !hook.renderers) return null;
		return getFiberRootFromHook(hook, 1);
	}
	/** fiber 하위 Text 노드의 문자열 수집 */
	function collectText(fiber, TextComponent) {
		if (!fiber) return "";
		if (fiber.type === TextComponent && fiber.memoizedProps) {
			var c = fiber.memoizedProps.children;
			if (typeof c === "string") return c.trim();
			if (typeof c === "number" || typeof c === "boolean") return String(c);
			if (Array.isArray(c)) return c.map(function(x) {
				if (typeof x === "string") return x;
				if (typeof x === "number" || typeof x === "boolean") return String(x);
				return "";
			}).join("").trim();
		}
		var s = "";
		var ch = fiber.child;
		while (ch) {
			s += collectText(ch, TextComponent);
			ch = ch.sibling;
		}
		return s;
	}
	/** fiber의 accessibilityLabel 또는 자식 Image의 accessibilityLabel 수집 */
	function collectAccessibilityLabel(fiber, ImageComponent) {
		if (!fiber || !fiber.memoizedProps) return "";
		var p = fiber.memoizedProps;
		if (typeof p.accessibilityLabel === "string" && p.accessibilityLabel.trim()) return p.accessibilityLabel.trim();
		var ch = fiber.child;
		while (ch) {
			if (ch.type === ImageComponent && ch.memoizedProps && typeof ch.memoizedProps.accessibilityLabel === "string") return ch.memoizedProps.accessibilityLabel.trim();
			ch = ch.sibling;
		}
		return "";
	}
	/** fiber에서 사용자에게 보이는 라벨 추출 (text 우선, a11y fallback) */
	function getLabel(fiber, TextComponent, ImageComponent) {
		var text = collectText(fiber, TextComponent).replace(/\s+/g, " ").trim();
		var a11y = collectAccessibilityLabel(fiber, ImageComponent);
		return text || a11y || "";
	}
	/** require('react-native')에서 Text, Image 컴포넌트 추출 */
	function getRNComponents() {
		var rn = typeof require !== "undefined" && require("react-native");
		return {
			Text: rn && rn.Text,
			Image: rn && rn.Image
		};
	}
	/** fiber 자신(또는 조상)에서 처음 나오는 testID */
	function getAncestorTestID(fiber) {
		var f = fiber;
		while (f && f.memoizedProps) {
			if (typeof f.memoizedProps.testID === "string" && f.memoizedProps.testID.trim()) return f.memoizedProps.testID.trim();
			f = f.return;
		}
	}
	/** Text fiber 한 노드의 직접 children 문자열만 (자식 Text 노드 제외) */
	function getTextNodeContent(fiber, TextComponent) {
		if (!fiber || fiber.type !== TextComponent || !fiber.memoizedProps) return "";
		var c = fiber.memoizedProps.children;
		if (typeof c === "string") return c.trim();
		if (Array.isArray(c)) return c.map(function(x) {
			return typeof x === "string" ? x : "";
		}).join("").trim();
		return "";
	}
	/** Fiber의 컴포넌트 타입 이름 (displayName/name/문자열) */
	function getFiberTypeName(fiber) {
		if (!fiber || !fiber.type) return "Unknown";
		var t = fiber.type;
		if (typeof t === "string") return t;
		if (t.displayName && typeof t.displayName === "string") return t.displayName;
		if (t.name && typeof t.name === "string") return t.name;
		return "Component";
	}
	var init_fiber_helpers = __esmMin(() => {});

//#endregion
//#region src/runtime/query-selector.ts
/**
	* 셀렉터 문자열을 AST로 파싱한다 (재귀 하강 파서).
	* 지원 문법:
	*   Type#testID[attr="val"]:text("..."):display-name("..."):nth-of-type(N):has-press:has-scroll
	*   A > B (직접 자식), A B (후손), A, B (OR)
	*/
	function parseSelector(input) {
		var pos = 0;
		var len = input.length;
		function isIdentChar(ch) {
			return /[A-Za-z0-9_.-]/.test(ch);
		}
		function skipSpaces() {
			while (pos < len && (input.charAt(pos) === " " || input.charAt(pos) === "	")) pos++;
		}
		function readIdentifier() {
			var start = pos;
			while (pos < len && isIdentChar(input.charAt(pos))) pos++;
			return input.substring(start, pos);
		}
		function readQuotedString() {
			var quote = input.charAt(pos);
			if (quote !== "\"" && quote !== "'") return "";
			pos++;
			var start = pos;
			while (pos < len && input.charAt(pos) !== quote) {
				if (input.charAt(pos) === "\\") pos++;
				pos++;
			}
			if (pos >= len) return null;
			var str = input.substring(start, pos);
			pos++;
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
				displayName: null,
				nth: -1,
				hasPress: false,
				hasScroll: false
			};
			var ch = pos < len ? input.charAt(pos) : "";
			if (/[A-Za-z_]/.test(ch)) sel.type = readIdentifier();
			if (pos < len && input.charAt(pos) === "#") {
				pos++;
				sel.testID = readIdentifier();
			}
			while (pos < len && input.charAt(pos) === "[") {
				pos++;
				skipSpaces();
				var attrName = readIdentifier();
				skipSpaces();
				if (pos < len && input.charAt(pos) === "=") {
					pos++;
					skipSpaces();
					var attrVal = readQuotedString();
					if (attrVal === null) throw new Error("Unclosed quote in selector [attr=\"...\"]");
					sel.attrs.push({
						name: attrName,
						value: attrVal
					});
				}
				skipSpaces();
				if (pos < len && input.charAt(pos) === "]") pos++;
			}
			while (pos < len && input.charAt(pos) === ":") {
				pos++;
				var pseudo = readIdentifier();
				if (pseudo === "text") {
					if (pos < len && input.charAt(pos) === "(") {
						pos++;
						skipSpaces();
						var textVal = readQuotedString();
						if (textVal === null) throw new Error("Unclosed quote in selector :text(...)");
						sel.text = textVal;
						skipSpaces();
						if (pos < len && input.charAt(pos) === ")") pos++;
					}
				} else if (pseudo === "nth-of-type") {
					if (pos < len && input.charAt(pos) === "(") {
						pos++;
						skipSpaces();
						sel.nth = readNumber() - 1;
						skipSpaces();
						if (pos < len && input.charAt(pos) === ")") pos++;
					}
				} else if (pseudo === "first-of-type") sel.nth = 0;
				else if (pseudo === "last-of-type") sel.nth = -2;
				else if (pseudo === "display-name") {
					if (pos < len && input.charAt(pos) === "(") {
						pos++;
						skipSpaces();
						var dn = readQuotedString();
						if (dn === null) throw new Error("Unclosed quote in selector :display-name(\"...\")");
						skipSpaces();
						if (pos < len && input.charAt(pos) === ")") pos++;
						sel.displayName = dn;
					}
				} else if (pseudo === "has-press") sel.hasPress = true;
				else if (pseudo === "has-scroll") sel.hasScroll = true;
			}
			return sel;
		}
		function parseComplex() {
			skipSpaces();
			var segments = [];
			segments.push({
				selector: parseCompound(),
				combinator: null
			});
			while (pos < len) {
				var beforeSkip = pos;
				skipSpaces();
				if (pos >= len || input.charAt(pos) === ",") break;
				var combinator = " ";
				if (input.charAt(pos) === ">") {
					combinator = ">";
					pos++;
					skipSpaces();
				} else if (pos === beforeSkip) break;
				var nextCh = pos < len ? input.charAt(pos) : "";
				if (!/[A-Za-z_#[:]/.test(nextCh)) break;
				segments.push({
					selector: parseCompound(),
					combinator
				});
			}
			return { segments };
		}
		var selectors = [];
		selectors.push(parseComplex());
		while (pos < len) {
			skipSpaces();
			if (pos >= len || input.charAt(pos) !== ",") break;
			pos++;
			selectors.push(parseComplex());
		}
		return { selectors };
	}
	/** compound 셀렉터가 단일 fiber 노드에 매칭되는지 검사 */
	function matchesCompound(fiber, compound, TextComp, _ImgComp) {
		if (!fiber) return false;
		var props = fiber.memoizedProps || {};
		if (compound.type !== null) {
			if (getFiberTypeName(fiber) !== compound.type) return false;
		}
		if (compound.displayName !== null) {
			var t = fiber.type;
			if (!t || typeof t.displayName !== "string" || t.displayName !== compound.displayName) return false;
		}
		if (compound.testID !== null && props.testID !== compound.testID) return false;
		for (var i = 0; i < compound.attrs.length; i++) {
			var attr = compound.attrs[i];
			if (String(props[attr.name] || "") !== attr.value) return false;
		}
		if (compound.text !== null) {
			if (collectText(fiber, TextComp).replace(/\s+/g, " ").trim().indexOf(compound.text) === -1) return false;
		}
		if (compound.hasPress && typeof props.onPress !== "function") return false;
		if (compound.hasScroll) {
			var sn = fiber.stateNode;
			if (!sn || typeof sn.scrollTo !== "function" && typeof sn.scrollToOffset !== "function") return false;
		}
		return true;
	}
	/** 계층 셀렉터(A > B, A B) 매칭 — fiber.return을 상향 탐색 */
	function matchesComplexSelector(fiber, complex, TextComp, _ImgComp) {
		var segs = complex.segments;
		var last = segs.length - 1;
		if (!matchesCompound(fiber, segs[last].selector, TextComp, _ImgComp)) return false;
		var current = fiber;
		for (var i = last - 1; i >= 0; i--) {
			var combinator = segs[i + 1].combinator;
			var targetSel = segs[i].selector;
			if (combinator === ">") {
				current = current.return;
				if (!current || !matchesCompound(current, targetSel, TextComp, _ImgComp)) return false;
			} else {
				current = current.return;
				while (current) {
					if (matchesCompound(current, targetSel, TextComp, _ImgComp)) break;
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
		parts.unshift(0);
		return parts.join(".");
	}
	/** path("0.1.2")로 Fiber 트리에서 노드 찾기. getComponentTree와 동일한 인덱스 규칙. */
	function getFiberByPath(root, pathStr) {
		if (!root || typeof pathStr !== "string") return null;
		var parts = pathStr.trim().split(".");
		var fiber = root;
		for (var i = 0; i < parts.length; i++) {
			if (!fiber) return null;
			var part = parts[i];
			if (part === void 0) return null;
			var idx = parseInt(part, 10);
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
		return typeof uid === "string" && /^\d+(\.\d+)*$/.test(uid.trim());
	}
	var init_query_selector = __esmMin(() => {
		init_fiber_helpers();
	});

//#endregion
//#region src/runtime/mcp-introspection.ts
/**
	* _debugStack.stack 문자열에서 모든 (url:line:column) 프레임 추출.
	* 예: " at fn (http://...:25822:77)\n at App (http://...:7284:69)" → [{ bundleUrl, line, column }, ...]
	* 첫 프레임이 React 내부인 경우가 많으므로 서버에서 순서대로 심볼리케이트해 앱 소스 프레임을 고름.
	*/
	function getSourceRefFromStack(stack) {
		if (typeof stack !== "string" || !stack) return [];
		var out = [];
		var re = /\(([^)]+):(\d+):(\d+)\)/g;
		var m;
		while ((m = re.exec(stack)) !== null) {
			var url = m[1];
			var lineStr = m[2];
			var colStr = m[3];
			if (url == null || lineStr == null || colStr == null) continue;
			var line = parseInt(lineStr, 10);
			var column = parseInt(colStr, 10);
			if (!isNaN(line)) out.push({
				bundleUrl: url,
				line,
				column
			});
		}
		return out;
	}
	/**
	* uid(경로 "0.1.2" 또는 testID)로 Fiber 찾기.
	*/
	function findFiberByUid(root, uid) {
		if (!root || typeof uid !== "string") return null;
		var u = uid.trim();
		if (isPathUid(u)) return getFiberByPath(root, u);
		var found = null;
		(function visit(f) {
			if (!f || found) return;
			var props = f.memoizedProps;
			if (props && typeof props.testID === "string" && props.testID.trim() === u) {
				found = f;
				return;
			}
			visit(f.child);
			visit(f.sibling);
		})(root);
		return found;
	}
	/**
	* uid에 해당하는 컴포넌트의 소스 위치 ref 목록 (번들 URL + 라인/컬럼). 서버에서 소스맵으로 원본 파일 추론용.
	* _debugStack이 없으면 빈 배열. 여러 프레임을 반환하므로 서버에서 앱 소스에 해당하는 첫 프레임을 선택할 수 있음.
	*/
	function getSourceRefForUid(uid) {
		try {
			var root = getFiberRoot();
			if (!root) return [];
			var fiber = findFiberByUid(root, uid);
			var debugStack = fiber && fiber._debugStack;
			if (!debugStack || typeof debugStack.stack !== "string") return [];
			return getSourceRefFromStack(debugStack.stack);
		} catch (_unused) {
			return [];
		}
	}
	/**
	* 클릭 가능 요소 목록 (uid + label). Fiber 트리에서 onPress 있는 모든 노드 수집.
	* _pressHandlers 레지스트리가 있으면 우선 사용, 없으면 Fiber 순회.
	*/
	function getClickables() {
		var ids = Object.keys(pressHandlers);
		if (ids.length > 0) {
			var root0 = getFiberRoot();
			var c0 = root0 ? getRNComponents() : null;
			return ids.map(function(id) {
				var label = "";
				if (root0 && c0) (function visit(fiber) {
					if (!fiber || label) return;
					if (fiber.memoizedProps && fiber.memoizedProps.testID === id) {
						label = collectText(fiber, c0.Text).replace(/\s+/g, " ").trim();
						return;
					}
					visit(fiber.child);
					visit(fiber.sibling);
				})(root0);
				return {
					uid: id,
					label
				};
			});
		}
		try {
			var root = getFiberRoot();
			if (!root) return [];
			var c = getRNComponents();
			var out = [];
			function visit(fiber) {
				if (!fiber) return;
				var props = fiber.memoizedProps;
				if (typeof (props && props.onPress) === "function") {
					var testID = props && props.testID || void 0;
					var label = getLabel(fiber, c.Text, c.Image);
					out.push({
						uid: testID || "",
						label
					});
					visit(fiber.sibling);
					return;
				}
				visit(fiber.child);
				visit(fiber.sibling);
			}
			visit(root);
			return out;
		} catch (_unused2) {
			return [];
		}
	}
	/**
	* Fiber 트리 전체에서 Text 노드 내용 수집. 버튼 여부와 무관하게 모든 보이는 텍스트.
	* 반환: [{ text, testID? }] — testID는 해당 Text의 조상 중 가장 가까운 testID.
	*/
	function getTextNodes() {
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
					if (text) out.push({
						text: text.replace(/\s+/g, " "),
						testID: getAncestorTestID(fiber)
					});
				}
				visit(fiber.child);
				visit(fiber.sibling);
			}
			visit(root);
			return out;
		} catch (_unused3) {
			return [];
		}
	}
	/** 컴포넌트 이름이 숨김 대상인지 판별 (_접두사 변형 포함) */
	function isHiddenComponent(name) {
		var target = name;
		if (target.length > 1 && target.charAt(0) === "_") target = target.substring(1);
		for (var i = 0; i < HIDDEN_COMPONENT_PREFIXES.length; i++) if (target.indexOf(HIDDEN_COMPONENT_PREFIXES[i]) === 0) return true;
		return false;
	}
	/**
	* Fiber 트리 전체를 컴포넌트 트리로 직렬화. querySelector 대체용 스냅샷.
	* 노드: { uid, type, testID?, accessibilityLabel?, text?, children? }
	* uid: testID 있으면 testID, 없으면 경로 "0.1.2". click(uid)는 testID일 때만 동작.
	* options: { maxDepth } (기본 무제한, 권장 20~30)
	*/
	function getComponentTree(options) {
		try {
			var root = getFiberRoot();
			if (!root) return null;
			var c = getRNComponents();
			var TextComponent = c && c.Text;
			var maxDepth = options && typeof options.maxDepth === "number" ? options.maxDepth : 999;
			function buildNode(fiber, path, depth) {
				if (!fiber || depth > maxDepth) return null;
				var props = fiber.memoizedProps || {};
				var testID = typeof props.testID === "string" && props.testID.trim() ? props.testID.trim() : void 0;
				var typeName = getFiberTypeName(fiber);
				var displayName = typeof fiber.type === "object" && fiber.type != null && typeof fiber.type.displayName === "string" ? fiber.type.displayName : "";
				if (isHiddenComponent(typeName) || isHiddenComponent(displayName)) {
					var out = [];
					var child = fiber.child;
					var idx = 0;
					while (child) {
						var childPath = path + "." + idx;
						var childResult = buildNode(child, childPath, depth + 1);
						if (Array.isArray(childResult)) out.push(...childResult);
						else if (childResult) out.push(childResult);
						child = child.sibling;
						idx += 1;
					}
					return out.length ? out : null;
				}
				var node = {
					uid: testID || path,
					type: typeName
				};
				if (testID) node.testID = testID;
				if (typeof props.accessibilityLabel === "string" && props.accessibilityLabel.trim()) node.accessibilityLabel = props.accessibilityLabel.trim();
				if (fiber.type === TextComponent) {
					var text = getTextNodeContent(fiber, TextComponent);
					if (text) node.text = text.replace(/\s+/g, " ");
				}
				var children = [];
				var child = fiber.child;
				var idx = 0;
				while (child) {
					var childPath = path + "." + idx;
					var childResult = buildNode(child, childPath, depth + 1);
					if (Array.isArray(childResult)) children.push(...childResult);
					else if (childResult) children.push(childResult);
					child = child.sibling;
					idx += 1;
				}
				if (children.length) node.children = children;
				return node;
			}
			var result = buildNode(root, "0", 0);
			return Array.isArray(result) ? result.length === 1 ? result[0] : {
				uid: "0",
				type: "Root",
				children: result
			} : result;
		} catch (_unused4) {
			return null;
		}
	}
	var HIDDEN_COMPONENT_PREFIXES;
	var init_mcp_introspection = __esmMin(() => {
		init_fiber_helpers();
		init_query_selector();
		init_shared();
		HIDDEN_COMPONENT_PREFIXES = [
			"RenderOverlay",
			"MCPRoot",
			"LogBox"
		];
	});

//#endregion
//#region src/runtime/state-hooks.ts
/** fiber의 memoizedState 체인에서 state Hook(queue 존재)만 추출 */
	function parseHooks(fiber) {
		var hooks = [];
		var hook = fiber ? fiber.memoizedState : null;
		var i = 0;
		while (hook && typeof hook === "object") {
			if (hook.queue) hooks.push({
				index: i,
				type: "state",
				value: hook.memoizedState
			});
			hook = hook.next;
			i++;
		}
		return hooks;
	}
	/** 얕은 비교. 참조 동일 → true, 타입 불일치/키 다름 → false */
	function shallowEqual(a, b) {
		if (a === b) return true;
		if (a == null || b == null) return false;
		if (typeof a !== typeof b) return false;
		if (typeof a !== "object") return false;
		if (Array.isArray(a)) {
			if (!Array.isArray(b) || a.length !== b.length) return false;
			for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
			return true;
		}
		var ka = Object.keys(a);
		var kb = Object.keys(b);
		if (ka.length !== kb.length) return false;
		for (var j = 0; j < ka.length; j++) {
			var key = ka[j];
			if (key === void 0) continue;
			if (a[key] !== b[key]) return false;
		}
		return true;
	}
	/** JSON.stringify 안전 래퍼 (depth 제한 + 순환 참조 방지) */
	function safeClone(val, maxDepth) {
		if (maxDepth === void 0) maxDepth = 4;
		var seen = [];
		function clone(v, depth) {
			if (v === null || v === void 0) return v;
			if (typeof v !== "object" && typeof v !== "function") return v;
			if (typeof v === "function") return "[Function]";
			if (depth > maxDepth) return "[depth limit]";
			if (seen.indexOf(v) !== -1) return "[Circular]";
			seen.push(v);
			if (Array.isArray(v)) {
				var arr = [];
				for (var i = 0; i < Math.min(v.length, 100); i++) arr.push(clone(v[i], depth + 1));
				if (v.length > 100) arr.push("..." + (v.length - 100) + " more");
				return arr;
			}
			var obj = {};
			var keys = Object.keys(v);
			for (var j = 0; j < Math.min(keys.length, 50); j++) {
				var key = keys[j];
				if (key === void 0) continue;
				obj[key] = clone(v[key], depth + 1);
			}
			if (keys.length > 50) obj["..."] = keys.length - 50 + " more keys";
			return obj;
		}
		return clone(val, 0);
	}
	/**
	* onCommitFiberRoot에서 호출: 변경된 state Hook을 _stateChanges에 수집.
	* fiber.alternate(이전 버전)와 비교해 memoizedState가 달라진 Hook만 기록.
	*/
	function collectStateChanges(fiber) {
		if (!fiber) return;
		if (fiber.tag === 0 || fiber.tag === 1) {
			var name = getFiberTypeName(fiber);
			if (isHiddenComponent(name)) {
				collectStateChanges(fiber.child);
				collectStateChanges(fiber.sibling);
				return;
			}
			var prev = fiber.alternate;
			if (prev) {
				var prevHook = prev.memoizedState;
				var nextHook = fiber.memoizedState;
				var hookIdx = 0;
				while (prevHook && nextHook && typeof prevHook === "object" && typeof nextHook === "object") {
					if (nextHook.queue && !shallowEqual(prevHook.memoizedState, nextHook.memoizedState)) {
						var debugStack = fiber._debugStack;
						var stackStr = debugStack && typeof debugStack.stack === "string" ? debugStack.stack : "";
						var sourceRef = stackStr ? getSourceRefFromStack(stackStr) : void 0;
						pushStateChange({
							id: nextStateChangeId(),
							timestamp: Date.now(),
							component: name,
							hookIndex: hookIdx,
							prev: safeClone(prevHook.memoizedState),
							next: safeClone(nextHook.memoizedState),
							sourceRef: sourceRef && sourceRef.length > 0 ? sourceRef : void 0
						});
					}
					prevHook = prevHook.next;
					nextHook = nextHook.next;
					hookIdx++;
				}
			}
		}
		collectStateChanges(fiber.child);
		collectStateChanges(fiber.sibling);
	}
	var init_state_hooks = __esmMin(() => {
		init_fiber_helpers();
		init_mcp_introspection();
		init_shared();
	});

//#endregion
//#region src/runtime/render-tracking.ts
/** 접두사 목록에 해당하는 이름인지 (_접두사 변형 포함) */
	function matchesPrefixList$1(name, prefixes) {
		var target = name;
		if (target.length > 1 && target.charAt(0) === "_") target = target.substring(1);
		for (var i = 0; i < prefixes.length; i++) if (target.indexOf(prefixes[i]) === 0) return true;
		return false;
	}
	/** 컴포넌트 필터링: whitelist > blacklist > default ignore 순으로 판별 */
	function shouldSkipComponent(name) {
		if (renderComponentFilter !== null) return renderComponentFilter.indexOf(name) === -1;
		if (renderIgnoreFilter !== null && renderIgnoreFilter.indexOf(name) !== -1) return true;
		return matchesPrefixList$1(name, DEFAULT_IGNORED_PREFIXES);
	}
	/** 빌트인 컴포넌트인지 판별 */
	function isBuiltinComponent(name) {
		return BUILTIN_COMPONENTS.indexOf(name) !== -1;
	}
	/** fiber.return을 올라가며 빌트인이 아닌 첫 사용자 컴포넌트 이름 */
	function getNearestUserParent(fiber) {
		var p = fiber.return;
		while (p) {
			if (p.tag === 0 || p.tag === 1) {
				var pName = getFiberTypeName(p);
				if (!isBuiltinComponent(pName) && !matchesPrefixList$1(pName, DEFAULT_IGNORED_PREFIXES)) return pName;
			}
			p = p.return;
		}
		return "Root";
	}
	/** fiber.return을 올라가며 첫 FunctionComponent/ClassComponent 이름 */
	function getParentComponentName(fiber) {
		var p = fiber.return;
		while (p) {
			if (p.tag === 0 || p.tag === 1) return getFiberTypeName(p);
			p = p.return;
		}
		return "Root";
	}
	/** fiber가 React.memo로 감싸져 있는지 (MemoComponent=14, SimpleMemoComponent=15) */
	function isMemoWrapped(fiber) {
		var parent = fiber.return;
		return parent != null && (parent.tag === 14 || parent.tag === 15);
	}
	/** child를 탐색하여 첫 HostComponent(tag=5)의 type 이름 반환 (View, Text, Pressable 등) */
	function getFirstHostType(fiber) {
		var child = fiber.child;
		return _findHostType(child, 5);
	}
	function _findHostType(fiber, depth) {
		if (!fiber || depth <= 0) return void 0;
		if (fiber.tag === 5 && typeof fiber.type === "string") return fiber.type;
		var found = _findHostType(fiber.child, depth - 1);
		if (found) return found;
		return _findHostType(fiber.sibling, depth - 1);
	}
	/** props에서 변경된 key들 추출 */
	function diffProps(prevProps, nextProps) {
		if (!prevProps || !nextProps) return void 0;
		var changes = [];
		var keys = Object.keys(nextProps);
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			if (key === "children") continue;
			if (prevProps[key] !== nextProps[key]) changes.push({
				key,
				prev: safeClone(prevProps[key], 3),
				next: safeClone(nextProps[key], 3)
			});
		}
		var prevKeys = Object.keys(prevProps);
		for (var j = 0; j < prevKeys.length; j++) {
			var pk = prevKeys[j];
			if (pk === "children") continue;
			if (!(pk in nextProps)) changes.push({
				key: pk,
				prev: safeClone(prevProps[pk], 3),
				next: void 0
			});
		}
		return changes.length > 0 ? changes : void 0;
	}
	/** state hooks에서 변경된 것들 추출 */
	function diffStateHooks(prevFiber, nextFiber) {
		var changes = [];
		var prevHook = prevFiber.memoizedState;
		var nextHook = nextFiber.memoizedState;
		var idx = 0;
		while (prevHook && nextHook && typeof prevHook === "object" && typeof nextHook === "object") {
			if (nextHook.queue && !shallowEqual(prevHook.memoizedState, nextHook.memoizedState)) changes.push({
				hookIndex: idx,
				prev: safeClone(prevHook.memoizedState, 3),
				next: safeClone(nextHook.memoizedState, 3)
			});
			prevHook = prevHook.next;
			nextHook = nextHook.next;
			idx++;
		}
		return changes.length > 0 ? changes : void 0;
	}
	/** context dependencies에서 변경된 것 추출 */
	function diffContext(fiber) {
		var alt = fiber.alternate;
		if (!alt) return void 0;
		var deps = fiber.dependencies;
		if (!deps || !deps.firstContext) return void 0;
		var changes = [];
		var ctx = deps.firstContext;
		var altDeps = alt.dependencies;
		var altCtx = altDeps ? altDeps.firstContext : null;
		while (ctx) {
			var ctxName = "Context";
			if (ctx.context) {
				var c = ctx.context;
				if (c.displayName) ctxName = c.displayName;
				else if (c._context && c._context.displayName) ctxName = c._context.displayName;
				else if (c.Provider && c.Provider._context && c.Provider._context.displayName) ctxName = c.Provider._context.displayName;
			}
			if (altCtx && ctx.memoizedValue !== altCtx.memoizedValue) changes.push({
				name: ctxName,
				prev: safeClone(altCtx.memoizedValue, 3),
				next: safeClone(ctx.memoizedValue, 3)
			});
			ctx = ctx.next;
			if (altCtx) altCtx = altCtx.next;
		}
		return changes.length > 0 ? changes : void 0;
	}
	/**
	* fiber 트리를 순회하며 RenderEntry를 수집.
	* onCommitFiberRoot에서 호출. commitId는 현재 renderCommitCount.
	*/
	function collectRenderEntries(fiber) {
		if (!fiber || !renderProfileActive) return;
		if (fiber.tag === 0 || fiber.tag === 1) {
			var name = getFiberTypeName(fiber);
			if (shouldSkipComponent(name)) {
				collectRenderEntries(fiber.child);
				collectRenderEntries(fiber.sibling);
				return;
			}
			var isBuiltin = isBuiltinComponent(name);
			var componentKey = isBuiltin ? getNearestUserParent(fiber) + " > " + name : name;
			var alt = fiber.alternate;
			var parentName = getParentComponentName(fiber);
			var hostType = isBuiltin ? void 0 : getFirstHostType(fiber);
			if (alt === null) {
				var entry = {
					component: componentKey,
					type: "mount",
					trigger: "parent",
					timestamp: Date.now(),
					commitId: renderCommitCount,
					parent: parentName,
					isMemoized: isMemoWrapped(fiber)
				};
				if (hostType) entry.nativeType = hostType;
				pushRenderEntry(entry);
			} else {
				var flags = fiber.flags;
				if (flags === void 0) flags = fiber.effectTag;
				if (typeof flags === "number" && (flags & 1) === 0) {} else {
					var stateChanges = diffStateHooks(alt, fiber);
					var propChanges = diffProps(alt.memoizedProps, fiber.memoizedProps);
					var contextChanges = diffContext(fiber);
					var trigger;
					if (stateChanges) trigger = "state";
					else if (propChanges) trigger = "props";
					else if (contextChanges) trigger = "context";
					else trigger = "parent";
					var changes = {};
					if (stateChanges) changes.state = stateChanges;
					if (propChanges) changes.props = propChanges;
					if (contextChanges) changes.context = contextChanges;
					var hasChanges = stateChanges || propChanges || contextChanges;
					var updateEntry = {
						component: componentKey,
						type: "update",
						trigger,
						timestamp: Date.now(),
						commitId: renderCommitCount,
						parent: parentName,
						isMemoized: isMemoWrapped(fiber)
					};
					if (hostType) updateEntry.nativeType = hostType;
					if (hasChanges) updateEntry.changes = changes;
					pushRenderEntry(updateEntry);
				}
			}
		}
		collectRenderEntries(fiber.child);
		collectRenderEntries(fiber.sibling);
	}
	var DEFAULT_IGNORED_PREFIXES, BUILTIN_COMPONENTS;
	var init_render_tracking = __esmMin(() => {
		init_fiber_helpers();
		init_state_hooks();
		init_shared();
		DEFAULT_IGNORED_PREFIXES = [
			"LogBox",
			"Pressability",
			"YellowBox",
			"RCT",
			"Debugging",
			"AppContainer",
			"TextAncestor",
			"VirtualizedList",
			"CellRenderer",
			"RenderOverlay",
			"MCPRoot"
		];
		BUILTIN_COMPONENTS = [
			"Text",
			"View",
			"Image",
			"Pressable",
			"TouchableOpacity",
			"TouchableHighlight",
			"TouchableWithoutFeedback",
			"TouchableNativeFeedback",
			"ScrollView",
			"FlatList",
			"SectionList",
			"TextInput",
			"ActivityIndicator",
			"Switch",
			"SafeAreaView",
			"KeyboardAvoidingView",
			"StatusBar",
			"Modal",
			"RefreshControl"
		];
	});

//#endregion
//#region src/runtime/screen-offset.ts
	function resolveScreenOffset() {}
	var screenOffsetX, screenOffsetY;
	var init_screen_offset = __esmMin(() => {
		screenOffsetX = 0;
		screenOffsetY = 0;
	});

//#endregion
//#region src/runtime/render-overlay.ts
/**
	* 하이라이트 후보 fiber: bippy isCompositeFiber(0,1,11,14,15) + ContextConsumerTag(9).
	* bippy didFiberRender는 9를 포함하므로, 리렌더 보고 집합을 맞추기 위해 9 포함.
	*/
	function isCompositeFiber(fiber) {
		var tag = fiber.tag;
		return tag === FunctionComponentTag || tag === ClassComponentTag || tag === ForwardRefTag || tag === ContextConsumerTag || tag === MemoComponentTag || tag === SimpleMemoComponentTag;
	}
	/**
	* didFiberRender: PerformedWork flag(bit 0x1)로 실제 렌더 여부 판별.
	* bippy didFiberRender와 동일하게 composite에서 (flags & PerformedWork) 사용.
	* 차이: mount(alternate === null)는 false — 초기 마운트는 하이라이트하지 않고 리렌더만 표시.
	*/
	function didFiberRender(fiber) {
		if (fiber.alternate === null) return false;
		var flags = fiber.flags;
		if (flags === void 0) flags = fiber.effectTag;
		return typeof flags === "number" && (flags & 1) !== 0;
	}
	function matchesPrefixList(name, prefixes) {
		var target = name;
		if (target.length > 1 && target.charAt(0) === "_") target = target.substring(1);
		for (var i = 0; i < prefixes.length; i++) if (target.indexOf(prefixes[i]) === 0) return true;
		return false;
	}
	function shouldSkipOverlay(name) {
		if (overlayComponentFilter !== null) return overlayComponentFilter.indexOf(name) === -1;
		if (overlayIgnoreFilter !== null && overlayIgnoreFilter.indexOf(name) !== -1) return true;
		return matchesPrefixList(name, OVERLAY_IGNORED_PREFIXES);
	}
	function isHostFiber(fiber) {
		var tag = fiber.tag;
		if (tag === 5 || tag === 26 || tag === 27) return true;
		return typeof fiber.type === "string";
	}
	/** DFS로 composite fiber 아래의 모든 최근접 host fiber 수집 */
	function getNearestHostFibers(fiber) {
		var hostFibers = [];
		var stack = [];
		if (isHostFiber(fiber) && fiber.stateNode) hostFibers.push(fiber);
		else if (fiber.child) stack.push(fiber.child);
		while (stack.length > 0) {
			var current = stack.pop();
			if (isHostFiber(current) && current.stateNode) hostFibers.push(current);
			else if (current.child) stack.push(current.child);
			if (current.sibling) stack.push(current.sibling);
		}
		return hostFibers;
	}
	/**
	* A) react-scan updateFiber 패턴: 변경된 subtree만 순회.
	*
	* 핵심: nextFiber.child !== prevFiber.child 일 때만 자식 순회.
	* 이렇게 하면 overlay setState로 인한 커밋에서 앱 컴포넌트의
	* 이전 PerformedWork flag를 재감지하지 않음.
	*/
	function collectOverlayHighlights(rootFiber) {
		if (!rootFiber || !overlayActive) return;
		var alt = rootFiber.alternate;
		if (!alt) return;
		_updateFiber(rootFiber, alt);
	}
	function _updateFiber(nextFiber, prevFiber) {
		if (isCompositeFiber(nextFiber)) {
			var name = getFiberTypeName(nextFiber);
			if (name === "RenderOverlay") return;
			if (!shouldSkipOverlay(name) && didFiberRender(nextFiber)) {
				var hostFibers = getNearestHostFibers(nextFiber);
				if (hostFibers.length > 0) _pendingMeasurements.push({
					hostFibers,
					name
				});
			}
		}
		if (nextFiber.child !== prevFiber.child) {
			var child = nextFiber.child;
			while (child) {
				var childAlt = child.alternate;
				if (childAlt) _updateFiber(child, childAlt);
				child = child.sibling;
			}
		}
	}
	/**
	* B) 측정 + 하이라이트 전달 (requestAnimationFrame 배치)
	*/
	function flushOverlayMeasurements() {
		if (_flushScheduled || _pendingMeasurements.length === 0) return;
		_flushScheduled = true;
		var measurements = _pendingMeasurements.slice();
		_pendingMeasurements.length = 0;
		if (measurements.length > overlayMaxHighlights) measurements = measurements.slice(0, overlayMaxHighlights);
		(typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : setTimeout)(function() {
			_flushScheduled = false;
			_processMeasurements(measurements);
		});
	}
	/** 단일 host fiber의 stateNode 측정 → callback(x, y, w, h) */
	function _measureHostFiber(fiber, g, rn, cb) {
		var node = fiber.stateNode;
		if (!node) return false;
		if (g.nativeFabricUIManager) {
			var shadowNode = node.node || node._internalInstanceHandle && node._internalInstanceHandle.stateNode && node._internalInstanceHandle.stateNode.node;
			if (!shadowNode && node._viewInfo && node._viewInfo.shadowNodeWrapper) shadowNode = node._viewInfo.shadowNodeWrapper;
			if (shadowNode) {
				/* @__PURE__ */ resolveScreenOffset();
				g.nativeFabricUIManager.measureInWindow(shadowNode, function(x, y, w, h) {
					cb(x + screenOffsetX, y + screenOffsetY, w, h);
				});
				return true;
			}
		}
		if (rn && rn.UIManager && rn.findNodeHandle) {
			var handle = rn.findNodeHandle(node);
			if (handle) {
				rn.UIManager.measure(handle, function(_x, _y, w, h, pageX, pageY) {
					cb(pageX, pageY, w, h);
				});
				return true;
			}
		}
		return false;
	}
	function _processMeasurements(measurements) {
		var remaining = measurements.length;
		if (remaining === 0) return;
		var newHighlights = [];
		var done = 0;
		function onAllRectsReady(name, rects) {
			if (rects.length === 0) {
				done++;
				if (done >= remaining) _commitHighlights(newHighlights);
				return;
			}
			var minX = rects[0].x;
			var minY = rects[0].y;
			var maxX = rects[0].x + rects[0].w;
			var maxY = rects[0].y + rects[0].h;
			for (var i = 1; i < rects.length; i++) {
				var r = rects[i];
				if (r.x < minX) minX = r.x;
				if (r.y < minY) minY = r.y;
				if (r.x + r.w > maxX) maxX = r.x + r.w;
				if (r.y + r.h > maxY) maxY = r.y + r.h;
			}
			var bx = minX;
			var by = minY;
			var bw = maxX - minX;
			var bh = maxY - minY;
			if (bw > 0 && bh > 0) {
				var posKey = Math.round(bx) + "-" + Math.round(by) + "-" + Math.round(bw) + "-" + Math.round(bh);
				var merged = false;
				for (var j = 0; j < _activeHighlights.length; j++) {
					var existing = _activeHighlights[j];
					if (existing._posKey === posKey) {
						if (existing._fadeTimerId != null) {
							clearInterval(existing._fadeTimerId);
							existing._fadeTimerId = void 0;
						}
						existing.count++;
						existing.alpha = 1;
						existing.timestamp = Date.now();
						merged = true;
						_scheduleFade(existing);
						break;
					}
				}
				if (!merged) for (var k = 0; k < newHighlights.length; k++) {
					var nh = newHighlights[k];
					if (nh._posKey === posKey) {
						nh.count++;
						merged = true;
						break;
					}
				}
				if (!merged) newHighlights.push({
					x: bx,
					y: by,
					width: bw,
					height: bh,
					name,
					count: 1,
					alpha: 1,
					timestamp: Date.now(),
					_posKey: posKey
				});
			}
			done++;
			if (done >= remaining) _commitHighlights(newHighlights);
		}
		var g = typeof globalThis !== "undefined" ? globalThis : global;
		var rn = typeof require !== "undefined" && require("react-native");
		for (var i = 0; i < measurements.length; i++) {
			var m = measurements[i];
			var hostCount = m.hostFibers.length;
			var measuredRects = [];
			var hostDone = 0;
			(function(name, total) {
				for (var j = 0; j < m.hostFibers.length; j++) if (!_measureHostFiber(m.hostFibers[j], g, rn, function(x, y, w, h) {
					if (w > 0 && h > 0) measuredRects.push({
						x,
						y,
						w,
						h
					});
					hostDone++;
					if (hostDone >= total) onAllRectsReady(name, measuredRects);
				})) {
					hostDone++;
					if (hostDone >= total) onAllRectsReady(name, measuredRects);
				}
			})(m.name, hostCount);
		}
	}
	function _commitHighlights(newHighlights) {
		for (var i = 0; i < newHighlights.length; i++) _activeHighlights.push(newHighlights[i]);
		while (_activeHighlights.length > overlayMaxHighlights) _activeHighlights.shift();
		if (overlaySetHighlights) overlaySetHighlights(_activeHighlights.slice());
		for (var j = 0; j < newHighlights.length; j++) _scheduleFade(newHighlights[j]);
	}
	function _scheduleFade(highlight) {
		var frame = 0;
		var frameInterval = overlayFadeTimeout / TOTAL_FRAMES;
		var interval = setInterval(function() {
			frame++;
			highlight.alpha = 1 - frame / TOTAL_FRAMES;
			if (frame >= TOTAL_FRAMES) {
				clearInterval(interval);
				highlight._fadeTimerId = void 0;
				var idx = _activeHighlights.indexOf(highlight);
				if (idx !== -1) _activeHighlights.splice(idx, 1);
				var tIdx = _fadeTimers.indexOf(interval);
				if (tIdx !== -1) _fadeTimers.splice(tIdx, 1);
			}
			if (overlaySetHighlights) overlaySetHighlights(_activeHighlights.slice());
		}, frameInterval);
		highlight._fadeTimerId = interval;
		_fadeTimers.push(interval);
	}
	function getOverlayComponent() {
		if (_OverlayComponent) return _OverlayComponent;
		var React = require("react");
		var RN = require("react-native");
		function RenderOverlay() {
			var stateRef = React.useState([]);
			var highlights = stateRef[0];
			var setHighlights = stateRef[1];
			var activeRef = React.useRef(false);
			React.useEffect(function() {
				setOverlaySetHighlights(function(h) {
					if (activeRef.current) setHighlights(h);
				});
				activeRef.current = true;
				if (renderHighlight) startRenderHighlight();
				return function() {
					activeRef.current = false;
					setOverlaySetHighlights(null);
				};
			}, []);
			if (!overlayActive || highlights.length === 0) return null;
			var topInsetDp = 0;
			if (RN.Platform.OS === "android") {
				if (overlayTopInsetConfirmed) topInsetDp = overlayTopInsetDp;
				else if (RN.StatusBar && typeof RN.StatusBar.currentHeight === "number") {
					var ratio = RN.PixelRatio && RN.PixelRatio.get ? RN.PixelRatio.get() : 1;
					topInsetDp = RN.StatusBar.currentHeight / ratio;
				}
			}
			var children = [];
			for (var i = 0; i < highlights.length; i++) {
				var h = highlights[i];
				var alpha = h.alpha > 0 ? h.alpha : 0;
				var drawY = h.y + topInsetDp;
				var rectStyle = {
					position: "absolute",
					left: h.x,
					top: drawY,
					width: h.width,
					height: h.height,
					borderWidth: 1,
					borderColor: "rgba(" + PRIMARY_COLOR + "," + alpha.toFixed(2) + ")",
					backgroundColor: "rgba(" + PRIMARY_COLOR + "," + (alpha * .1).toFixed(3) + ")"
				};
				children.push(React.createElement(RN.View, {
					key: "rect-" + i,
					style: rectStyle
				}));
				var labelText = h.name;
				if (h.count > 1) labelText += " ×" + h.count;
				if (overlayShowLabels || h.count >= 2) {
					var labelContainerStyle = {
						position: "absolute",
						left: h.x,
						top: drawY - 16,
						backgroundColor: "rgba(" + PRIMARY_COLOR + "," + alpha.toFixed(2) + ")",
						paddingHorizontal: 3,
						paddingVertical: 1,
						borderRadius: 2
					};
					var labelTextStyle = {
						color: "rgba(255,255,255," + alpha.toFixed(2) + ")",
						fontSize: 10,
						fontFamily: "Menlo",
						fontWeight: "600"
					};
					children.push(React.createElement(RN.View, {
						key: "label-" + i,
						style: labelContainerStyle
					}, React.createElement(RN.Text, { style: labelTextStyle }, labelText)));
				}
			}
			return React.createElement(RN.View, {
				style: {
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0
				},
				pointerEvents: "none"
			}, children);
		}
		RenderOverlay.displayName = "RenderOverlay";
		_OverlayComponent = RenderOverlay;
		return _OverlayComponent;
	}
	function startRenderHighlight(options) {
		var opts = typeof options === "object" && options !== null ? options : {};
		stopRenderHighlight();
		setOverlayActive(true);
		if (Array.isArray(opts.components) && opts.components.length > 0) setOverlayComponentFilter(opts.components);
		if (Array.isArray(opts.ignore) && opts.ignore.length > 0) setOverlayIgnoreFilter(opts.ignore);
		if (typeof opts.showLabels === "boolean") setOverlayShowLabels(opts.showLabels);
		if (typeof opts.fadeTimeout === "number" && opts.fadeTimeout > 0) setOverlayFadeTimeout(opts.fadeTimeout);
		if (typeof opts.maxHighlights === "number" && opts.maxHighlights > 0) setOverlayMaxHighlights(opts.maxHighlights);
		return { started: true };
	}
	function stopRenderHighlight() {
		for (var i = 0; i < _fadeTimers.length; i++) clearInterval(_fadeTimers[i]);
		_fadeTimers.length = 0;
		_activeHighlights.length = 0;
		_pendingMeasurements.length = 0;
		_flushScheduled = false;
		if (overlaySetHighlights) overlaySetHighlights([]);
		resetOverlay();
		return { stopped: true };
	}
	var FunctionComponentTag, ClassComponentTag, ForwardRefTag, ContextConsumerTag, MemoComponentTag, SimpleMemoComponentTag, OVERLAY_IGNORED_PREFIXES, PRIMARY_COLOR, _pendingMeasurements, _flushScheduled, _activeHighlights, _fadeTimers, TOTAL_FRAMES, _OverlayComponent;
	var init_render_overlay = __esmMin(() => {
		init_fiber_helpers();
		init_shared();
		init_screen_offset();
		FunctionComponentTag = 0;
		ClassComponentTag = 1;
		ForwardRefTag = 11;
		ContextConsumerTag = 9;
		MemoComponentTag = 14;
		SimpleMemoComponentTag = 15;
		OVERLAY_IGNORED_PREFIXES = [
			"RenderOverlay",
			"MCPRoot",
			"LogBox",
			"Pressability",
			"YellowBox",
			"RCT",
			"Debugging",
			"AppContainer",
			"TextAncestor",
			"CellRenderer"
		];
		PRIMARY_COLOR = renderHighlightStyle === "react-mcp" ? "72,160,195" : "115,97,230";
		_pendingMeasurements = [];
		_flushScheduled = false;
		_activeHighlights = [];
		_fadeTimers = [];
		TOTAL_FRAMES = 45;
		_OverlayComponent = null;
	});

//#endregion
//#region src/runtime/state-change-tracking.ts
	var init_state_change_tracking = __esmMin(() => {
		init_state_hooks();
		init_render_tracking();
		init_render_overlay();
		init_shared();
		(function() {
			var g = typeof globalThis !== "undefined" ? globalThis : typeof global !== "undefined" ? global : null;
			if (!g || !g.__REACT_DEVTOOLS_GLOBAL_HOOK__) return;
			var hook = g.__REACT_DEVTOOLS_GLOBAL_HOOK__;
			var orig = hook.onCommitFiberRoot;
			hook.onCommitFiberRoot = function(rendererID, root) {
				if (typeof orig === "function") orig.call(hook, rendererID, root);
				try {
					if (root && root.current) collectStateChanges(root.current);
				} catch (_unused) {}
				try {
					if (renderProfileActive && root && root.current) {
						incrementRenderCommitCount();
						collectRenderEntries(root.current);
					}
				} catch (_unused2) {}
				try {
					if (overlayActive && root && root.current) {
						collectOverlayHighlights(root.current);
						flushOverlayMeasurements();
					}
				} catch (_unused3) {}
			};
		})();
	});

//#endregion
//#region src/runtime/mcp-measure.ts
/**
	* getScreenInfo() → { screen, window, scale, fontScale, orientation }
	*/
	function getScreenInfo() {
		try {
			var rn = typeof require !== "undefined" && require("react-native");
			if (!rn) return { error: "react-native not available" };
			var screen = rn.Dimensions.get("screen");
			var win = rn.Dimensions.get("window");
			var pixelRatio = rn.PixelRatio ? rn.PixelRatio.get() : 1;
			var fontScale = rn.PixelRatio ? rn.PixelRatio.getFontScale() : 1;
			var out = {
				screen: {
					width: screen.width,
					height: screen.height
				},
				window: {
					width: win.width,
					height: win.height
				},
				scale: pixelRatio,
				fontScale,
				orientation: win.width > win.height ? "landscape" : "portrait"
			};
			if (rn.Platform && rn.Platform.OS === "android" && rn.StatusBar && typeof rn.StatusBar.currentHeight === "number") out.statusBarHeightDp = rn.StatusBar.currentHeight / pixelRatio;
			if (overlayTopInsetDp > 0) out.overlayTopInsetDp = overlayTopInsetDp;
			return out;
		} catch (e) {
			return { error: String(e) };
		}
	}
	/** fiber.child부터 DFS로 첫 번째 host fiber(type=string, stateNode 있음) 탐색 */
	function findNearestHost(fiber) {
		if (!fiber) return null;
		if (typeof fiber.type === "string" && fiber.stateNode) return fiber;
		var c = fiber.child;
		while (c) {
			var h = findNearestHost(c);
			if (h) return h;
			c = c.sibling;
		}
		return null;
	}
	/** stateNode에서 Fabric shadow node 추출 */
	function getShadowNode(stateNode) {
		if (!stateNode) return null;
		var sn = stateNode.node || stateNode._internalInstanceHandle && stateNode._internalInstanceHandle.stateNode && stateNode._internalInstanceHandle.stateNode.node;
		if (!sn && stateNode._viewInfo && stateNode._viewInfo.shadowNodeWrapper) sn = stateNode._viewInfo.shadowNodeWrapper;
		return sn || null;
	}
	/**
	* measureView(uid) → Promise<{ x, y, width, height, pageX, pageY }>
	* uid: testID 또는 경로("0.1.2"). query_selector로 얻은 uid 그대로 사용 가능.
	* Fiber에서 native node를 찾아 measureInWindow (Fabric) 또는 measure (Bridge)로 절대 좌표 반환.
	* pageX/pageY: 화면 왼쪽 상단 기준 절대 좌표 (points).
	*/
	function measureView(uid) {
		return new Promise(function(resolve, reject) {
			try {
				var root = getFiberRoot();
				if (!root) return reject(/* @__PURE__ */ new Error("no fiber root"));
				var found = null;
				if (isPathUid(uid)) {
					found = getFiberByPath(root, uid);
					if (found && !found.stateNode) found = null;
				}
				if (!found) (function find(fiber) {
					if (!fiber || found) return;
					if (fiber.memoizedProps && fiber.memoizedProps.testID === uid && fiber.stateNode) {
						found = fiber;
						return;
					}
					find(fiber.child);
					if (!found) find(fiber.sibling);
				})(root);
				if (!found) return reject(/* @__PURE__ */ new Error("uid \"" + uid + "\" not found or has no native view"));
				if (found && typeof found.type !== "string") {
					var host = findNearestHost(found.child);
					if (host) found = host;
				}
				var g = typeof globalThis !== "undefined" ? globalThis : global;
				var rn = typeof require !== "undefined" && require("react-native");
				while (found) {
					var node = found.stateNode;
					if (g.nativeFabricUIManager && node) {
						var shadowNode = getShadowNode(node);
						if (shadowNode) {
							/* @__PURE__ */ resolveScreenOffset();
							g.nativeFabricUIManager.measureInWindow(shadowNode, function(x, y, w, h) {
								resolve({
									x,
									y,
									width: w,
									height: h,
									pageX: x + screenOffsetX,
									pageY: y + screenOffsetY
								});
							});
							return;
						}
					}
					if (rn && rn.UIManager && rn.findNodeHandle && node) {
						var handle = rn.findNodeHandle(node);
						if (handle) {
							rn.UIManager.measure(handle, function(x, y, w, h, pageX, pageY) {
								resolve({
									x,
									y,
									width: w,
									height: h,
									pageX,
									pageY
								});
							});
							return;
						}
					}
					found = found.return;
				}
				reject(/* @__PURE__ */ new Error("cannot measure: no native node"));
			} catch (e) {
				reject(e);
			}
		});
	}
	/**
	* measureViewSync(uid) → { x, y, width, height, pageX, pageY } | null
	* Fabric에서는 동기 호출 가능. Bridge에서는 null → measureView() 사용 권장.
	*/
	function measureViewSync(uid) {
		try {
			var root = getFiberRoot();
			if (!root) return null;
			var found = null;
			if (isPathUid(uid)) found = getFiberByPath(root, uid);
			if (!found) (function find(fiber) {
				if (!fiber || found) return;
				if (fiber.memoizedProps && fiber.memoizedProps.testID === uid && fiber.stateNode) {
					found = fiber;
					return;
				}
				find(fiber.child);
				if (!found) find(fiber.sibling);
			})(root);
			if (!found) return null;
			var g = typeof globalThis !== "undefined" ? globalThis : global;
			if (g.nativeFabricUIManager) {
				var sn = getShadowNode(found.stateNode);
				if (!sn) {
					var host = findNearestHost(found.child);
					if (host) sn = getShadowNode(host.stateNode);
				}
				if (sn) {
					var result = null;
					/* @__PURE__ */ resolveScreenOffset();
					g.nativeFabricUIManager.measureInWindow(sn, function(x, y, w, h) {
						result = {
							x,
							y,
							width: w,
							height: h,
							pageX: x + screenOffsetX,
							pageY: y + screenOffsetY
						};
					});
					return result;
				}
			}
			return null;
		} catch (_unused) {
			return null;
		}
	}
	/**
	* measureByNativeTag(nativeTag) → Promise<MeasureResult>
	* Bridge 전용: Fiber 재탐색 없이 nativeTag로 직접 UIManager.measure 호출.
	* testID 유무와 무관하게 동작.
	*/
	function measureByNativeTag(nativeTag) {
		return new Promise(function(resolve, reject) {
			try {
				var rn = typeof require !== "undefined" && require("react-native");
				if (rn && rn.UIManager && typeof rn.UIManager.measure === "function") rn.UIManager.measure(nativeTag, function(x, y, w, h, pageX, pageY) {
					if (w === 0 && h === 0 && pageX === 0 && pageY === 0) reject(/* @__PURE__ */ new Error("nativeTag " + nativeTag + " returned zero measure"));
					else resolve({
						x,
						y,
						width: w,
						height: h,
						pageX,
						pageY
					});
				});
				else reject(/* @__PURE__ */ new Error("UIManager.measure not available"));
			} catch (e) {
				reject(e);
			}
		});
	}
	var init_mcp_measure = __esmMin(() => {
		init_fiber_helpers();
		init_query_selector();
		init_shared();
		init_screen_offset();
	});

//#endregion
//#region src/runtime/mcp-webview.ts
	function registerWebView(ref, id) {
		if (ref && typeof id === "string") {
			_webViews[id] = ref;
			if (_webViewRefToId) try {
				_webViewRefToId.set(ref, id);
			} catch (_unused) {}
		}
	}
	function unregisterWebView(id) {
		if (typeof id === "string") {
			var ref = _webViews[id];
			if (ref && _webViewRefToId) _webViewRefToId.delete(ref);
			delete _webViews[id];
		}
	}
	/** ref에 해당하는 등록된 webViewId 반환 (query_selector로 찾은 WebView → webViewId용) */
	function getWebViewIdForRef(ref) {
		return _webViewRefToId && ref ? _webViewRefToId.get(ref) || null : null;
	}
	function clickInWebView(id, selector) {
		var ref = _webViews[id];
		if (!ref || typeof ref.injectJavaScript !== "function") return {
			ok: false,
			error: "WebView not found or injectJavaScript not available"
		};
		var script = "(function(){ var el = document.querySelector(" + JSON.stringify(selector) + "); if (el) el.click(); })();";
		ref.injectJavaScript(script);
		return { ok: true };
	}
	/** 등록된 WebView 내부에서 임의의 JavaScript를 실행 (동기, 반환값 없음) */
	function evaluateInWebView(id, script) {
		var ref = _webViews[id];
		if (!ref || typeof ref.injectJavaScript !== "function") return {
			ok: false,
			error: "WebView not found or injectJavaScript not available"
		};
		ref.injectJavaScript(script);
		return { ok: true };
	}
	/**
	* WebView에서 스크립트 실행 후 postMessage로 결과 수신.
	* @returns Promise<{ ok: true, value: string } | { ok: false, error: string }>
	*/
	function evaluateInWebViewAsync(id, script) {
		var ref = _webViews[id];
		if (!ref || typeof ref.injectJavaScript !== "function") return Promise.resolve({
			ok: false,
			error: "WebView not found or injectJavaScript not available"
		});
		var requestId = "wv_" + ++_webViewEvalRequestId + "_" + Date.now();
		var wrapped = "(function(){ var __reqId=" + JSON.stringify(requestId) + "; var __script=" + JSON.stringify(script) + "; try { var __r=(function(){ return eval(__script); })(); var __v=typeof __r===\"string\" ? __r : (function(){ try { return JSON.stringify(__r); } catch(e){ return String(__r); } })(); window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({__mcpEvalResult:true,requestId:__reqId,value:__v})); } catch(e) { window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({__mcpEvalResult:true,requestId:__reqId,error:(e&&e.message)||String(e)})); } })();";
		return new Promise(function(resolve) {
			_webViewEvalPending[requestId] = {
				resolve,
				timeout: setTimeout(function() {
					if (_webViewEvalPending[requestId]) {
						delete _webViewEvalPending[requestId];
						resolve({
							ok: false,
							error: "WebView eval timeout (10s)"
						});
					}
				}, 1e4)
			};
			ref.injectJavaScript(wrapped);
		});
	}
	/**
	* WebView onMessage에서 호출. postMessage로 온 __mcpEvalResult 수신 시 evaluateInWebViewAsync Promise resolve.
	* @returns true if the message was __mcpEvalResult (consumed), false otherwise.
	*/
	function handleWebViewMessage(data) {
		if (!data || typeof data !== "string") return false;
		try {
			var payload = JSON.parse(data);
			if (!payload || payload.__mcpEvalResult !== true || !payload.requestId) return false;
			var reqId = payload.requestId;
			var pending = _webViewEvalPending[reqId];
			if (!pending) return false;
			delete _webViewEvalPending[reqId];
			if (pending.timeout) clearTimeout(pending.timeout);
			if (payload.error != null) pending.resolve({
				ok: false,
				error: payload.error
			});
			else pending.resolve({
				ok: true,
				value: payload.value
			});
			return true;
		} catch (_unused2) {
			return false;
		}
	}
	/**
	* WebView onMessage와 사용자 핸들러를 함께 쓰기 위한 래퍼.
	*/
	function createWebViewOnMessage(userHandler) {
		if (typeof userHandler !== "function") return function(e) {
			globalThis.__REACT_NATIVE_MCP__.handleWebViewMessage(e.nativeEvent.data);
		};
		return function(e) {
			var data = e && e.nativeEvent && e.nativeEvent.data;
			if (!globalThis.__REACT_NATIVE_MCP__.handleWebViewMessage(data)) userHandler(e);
		};
	}
	function getRegisteredWebViewIds() {
		return Object.keys(_webViews);
	}
	var _webViews, _webViewRefToId, _webViewEvalPending, _webViewEvalRequestId;
	var init_mcp_webview = __esmMin(() => {
		_webViews = {};
		_webViewRefToId = typeof WeakMap !== "undefined" ? /* @__PURE__ */ new WeakMap() : null;
		_webViewEvalPending = {};
		_webViewEvalRequestId = 0;
	});

//#endregion
//#region src/runtime/fiber-serialization.ts
/** fiber 노드를 결과 객체로 직렬화 */
	function fiberToResult(fiber, TextComp, _ImgComp) {
		var props = fiber.memoizedProps || {};
		var typeName = getFiberTypeName(fiber);
		var testID = typeof props.testID === "string" && props.testID.trim() ? props.testID.trim() : void 0;
		var text = collectText(fiber, TextComp).replace(/\s+/g, " ").trim() || void 0;
		var a11y = typeof props.accessibilityLabel === "string" && props.accessibilityLabel.trim() ? props.accessibilityLabel.trim() : void 0;
		var hasOnPress = typeof props.onPress === "function";
		var hasOnLongPress = typeof props.onLongPress === "function";
		var sn = fiber.stateNode;
		var hasScrollTo = !!(sn && (typeof sn.scrollTo === "function" || typeof sn.scrollToOffset === "function"));
		var uid = testID || getPathUid(fiber);
		var result = {
			uid,
			type: typeName
		};
		if (testID) result.testID = testID;
		if (text) result.text = text;
		if (a11y) result.accessibilityLabel = a11y;
		result.hasOnPress = hasOnPress;
		result.hasOnLongPress = hasOnLongPress;
		result.hasScrollTo = hasScrollTo;
		if (props.value !== void 0) result.value = props.value;
		if (props.disabled != null) result.disabled = !!props.disabled;
		if (props.editable !== void 0) result.editable = props.editable;
		var measure = null;
		try {
			measure = measureViewSync(uid);
		} catch (_unused) {}
		if (!measure && typeof fiber.type !== "string") {
			var hostChild = (function findHost(f) {
				if (!f) return null;
				if (typeof f.type === "string" && f.stateNode) return f;
				var c = f.child;
				while (c) {
					var h = findHost(c);
					if (h) return h;
					c = c.sibling;
				}
				return null;
			})(fiber.child);
			if (hostChild) {
				var hostUid = getPathUid(hostChild);
				try {
					measure = measureViewSync(hostUid);
				} catch (_unused2) {}
				if (!measure) {
					var hostTag = hostChild.stateNode && typeof hostChild.stateNode._nativeTag === "number" ? hostChild.stateNode._nativeTag : null;
					if (hostTag) result._nativeTag = hostTag;
					result._measureUid = hostUid;
				}
			}
		}
		result.measure = measure;
		if (typeName === "WebView" && sn && typeof sn.injectJavaScript === "function") {
			var wvId = getWebViewIdForRef(sn);
			if (wvId) result.webViewId = wvId;
		}
		return result;
	}
	var init_fiber_serialization = __esmMin(() => {
		init_fiber_helpers();
		init_query_selector();
		init_mcp_measure();
		init_mcp_webview();
	});

//#endregion
//#region src/runtime/mcp-registration.ts
	function registerComponent(name, component) {
		var wrappedFactory = function() {
			var Orig = component();
			var React = require("react");
			var RN = require("react-native");
			var Overlay = getOverlayComponent();
			function MCPRoot(props) {
				return React.createElement(RN.View, { style: { flex: 1 } }, React.createElement(Orig, props), React.createElement(Overlay, null));
			}
			MCPRoot.displayName = "MCPRoot";
			return MCPRoot;
		};
		return require("react-native").AppRegistry.registerComponent(name, wrappedFactory);
	}
	function registerPressHandler(testID, handler) {
		if (typeof testID === "string" && typeof handler === "function") pressHandlers[testID] = handler;
	}
	function triggerPress(testID) {
		var h = pressHandlers[testID];
		if (typeof h === "function") {
			h();
			return true;
		}
		var root = getFiberRoot();
		if (root) {
			var found = (function findByTestID(fiber) {
				if (!fiber) return null;
				if (fiber.memoizedProps && fiber.memoizedProps.testID === testID && typeof fiber.memoizedProps.onPress === "function") return fiber;
				return findByTestID(fiber.child) || findByTestID(fiber.sibling);
			})(root);
			if (found) {
				found.memoizedProps.onPress();
				return true;
			}
		}
		return false;
	}
	function triggerLongPress(testID) {
		var root = getFiberRoot();
		if (!root) return false;
		var found = (function find(fiber) {
			if (!fiber) return null;
			if (fiber.memoizedProps && fiber.memoizedProps.testID === testID && typeof fiber.memoizedProps.onLongPress === "function") return fiber;
			return find(fiber.child) || find(fiber.sibling);
		})(root);
		if (found) {
			found.memoizedProps.onLongPress();
			return true;
		}
		return false;
	}
	function getRegisteredPressTestIDs() {
		return Object.keys(pressHandlers);
	}
	var init_mcp_registration = __esmMin(() => {
		init_fiber_helpers();
		init_shared();
		init_render_overlay();
	});

//#endregion
//#region src/runtime/mcp-actions.ts
/**
	* Fiber 트리에서 라벨(텍스트)에 해당하는 onPress 노드들을 순서대로 수집한 뒤, index번째(0-based) 호출.
	* index 생략 시 0 (첫 번째). querySelectorAll()[index]와 유사.
	*/
	function pressByLabel(labelSubstring, index) {
		if (typeof labelSubstring !== "string" || !labelSubstring.trim()) return false;
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
				if (typeof onPress === "function") {
					if (getLabel(fiber, c.Text, c.Image).indexOf(search) !== -1) matches.push(onPress);
					visit(fiber.sibling);
					return;
				}
				visit(fiber.child);
				visit(fiber.sibling);
			}
			visit(root);
			var fn = matches[typeof index === "number" && index >= 0 ? index : 0];
			if (typeof fn === "function") {
				try {
					fn();
				} catch (_unused) {}
				return true;
			}
			return false;
		} catch (_unused2) {
			return false;
		}
	}
	/**
	* Fiber 트리에서 라벨(텍스트)에 해당하는 onLongPress 노드들을 순서대로 수집한 뒤, index번째(0-based) 호출.
	*/
	function longPressByLabel(labelSubstring, index) {
		if (typeof labelSubstring !== "string" || !labelSubstring.trim()) return false;
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
				if (typeof onLP === "function") {
					if (getLabel(fiber, c.Text, c.Image).indexOf(search) !== -1) matches.push(onLP);
					visitLP(fiber.sibling);
					return;
				}
				visitLP(fiber.child);
				visitLP(fiber.sibling);
			}
			visitLP(root);
			var fn = matches[typeof index === "number" && index >= 0 ? index : 0];
			if (typeof fn === "function") {
				try {
					fn();
				} catch (_unused3) {}
				return true;
			}
			return false;
		} catch (_unused4) {
			return false;
		}
	}
	/**
	* TextInput에 텍스트 입력. Fiber에서 testID 매칭 → onChangeText(text) 호출 + setNativeProps 동기화.
	*/
	function typeText(testID, text) {
		try {
			var root = getFiberRoot();
			if (!root) return {
				ok: false,
				error: "No Fiber root"
			};
			var found = (function find(fiber) {
				if (!fiber) return null;
				if (fiber.memoizedProps && fiber.memoizedProps.testID === testID && typeof fiber.memoizedProps.onChangeText === "function") return fiber;
				return find(fiber.child) || find(fiber.sibling);
			})(root);
			if (!found) return {
				ok: false,
				error: "TextInput not found: " + testID
			};
			found.memoizedProps.onChangeText(text);
			if (found.stateNode && typeof found.stateNode.setNativeProps === "function") found.stateNode.setNativeProps({ text });
			return { ok: true };
		} catch (e) {
			return {
				ok: false,
				error: String(e)
			};
		}
	}
	var init_mcp_actions = __esmMin(() => {
		init_fiber_helpers();
	});

//#endregion
//#region src/runtime/mcp-scroll.ts
	function registerScrollRef(testID, ref) {
		if (typeof testID === "string" && ref != null) _scrollRefs[testID] = ref;
	}
	function unregisterScrollRef(testID) {
		if (typeof testID === "string") delete _scrollRefs[testID];
	}
	function scrollTo(testID, options) {
		var ref = _scrollRefs[testID];
		if (!ref) {
			var root = getFiberRoot();
			if (root) ref = (function findScrollable(fiber) {
				if (!fiber) return null;
				if (fiber.memoizedProps && fiber.memoizedProps.testID === testID && fiber.stateNode) {
					var si = fiber.stateNode;
					if (typeof si.scrollTo === "function" || typeof si.scrollToOffset === "function") return si;
				}
				return findScrollable(fiber.child) || findScrollable(fiber.sibling);
			})(root);
		}
		if (!ref) return {
			ok: false,
			error: "ScrollView not found for testID: " + testID
		};
		var opts = typeof options === "object" && options !== null ? options : {};
		var x = opts.x || 0;
		var y = opts.y || 0;
		var animated = opts.animated !== false;
		try {
			if (typeof ref.scrollTo === "function") {
				ref.scrollTo({
					x,
					y,
					animated
				});
				return { ok: true };
			}
			if (typeof ref.scrollToOffset === "function") {
				ref.scrollToOffset({
					offset: y,
					animated
				});
				return { ok: true };
			}
			return {
				ok: false,
				error: "scrollTo/scrollToOffset not available on stateNode"
			};
		} catch (e) {
			return {
				ok: false,
				error: e && e.message ? e.message : String(e)
			};
		}
	}
	function getRegisteredScrollTestIDs() {
		return Object.keys(_scrollRefs);
	}
	var _scrollRefs;
	var init_mcp_scroll = __esmMin(() => {
		init_fiber_helpers();
		_scrollRefs = {};
	});

//#endregion
//#region src/runtime/mcp-console.ts
/**
	* 콘솔 로그 조회. options: { level?, since?, limit? }
	* level 맵핑: 0=log, 1=info, 2=warn, 3=error
	*/
	function getConsoleLogs(options) {
		var opts = typeof options === "object" && options !== null ? options : {};
		var levelMap = {
			log: 0,
			info: 1,
			warn: 2,
			error: 3
		};
		var out = consoleLogs;
		if (opts.level != null) {
			var targetLevel = typeof opts.level === "string" ? levelMap[opts.level] : opts.level;
			if (targetLevel != null) out = out.filter(function(entry) {
				return entry.level === targetLevel;
			});
		}
		if (typeof opts.since === "number") {
			var since = opts.since;
			out = out.filter(function(entry) {
				return entry.timestamp > since;
			});
		}
		var limit = typeof opts.limit === "number" && opts.limit > 0 ? opts.limit : 100;
		if (out.length > limit) out = out.slice(out.length - limit);
		return out;
	}
	/** 콘솔 로그 버퍼 초기화 */
	function clearConsoleLogs() {
		resetConsoleLogs();
	}
	var init_mcp_console = __esmMin(() => {
		init_shared();
	});

//#endregion
//#region src/runtime/mcp-network.ts
/**
	* 네트워크 요청 조회. options: { url?, method?, status?, since?, limit? }
	* url: substring 매칭, method: 정확 매칭, status: 정확 매칭
	*/
	function getNetworkRequests(options) {
		var opts = typeof options === "object" && options !== null ? options : {};
		var out = networkRequests;
		if (typeof opts.url === "string" && opts.url) {
			var urlFilter = opts.url;
			out = out.filter(function(entry) {
				return entry.url.indexOf(urlFilter) !== -1;
			});
		}
		if (typeof opts.method === "string" && opts.method) {
			var methodFilter = opts.method.toUpperCase();
			out = out.filter(function(entry) {
				return entry.method === methodFilter;
			});
		}
		if (typeof opts.status === "number") {
			var statusFilter = opts.status;
			out = out.filter(function(entry) {
				return entry.status === statusFilter;
			});
		}
		if (typeof opts.since === "number") {
			var since = opts.since;
			out = out.filter(function(entry) {
				return entry.startTime > since;
			});
		}
		var limit = typeof opts.limit === "number" && opts.limit > 0 ? opts.limit : 50;
		if (out.length > limit) out = out.slice(out.length - limit);
		return out;
	}
	/** 네트워크 요청 버퍼 초기화 */
	function clearNetworkRequests() {
		resetNetworkRequests();
	}
	var init_mcp_network = __esmMin(() => {
		init_shared();
	});

//#endregion
//#region src/runtime/mcp-state.ts
/**
	* inspectState(selector) → 셀렉터로 찾은 컴포넌트의 state Hook 목록.
	* 반환: { component, hooks: [{ index, type, value }] } 또는 null.
	* FunctionComponent가 아닌 host fiber가 매칭되면 가장 가까운 조상 FunctionComponent로 이동.
	*/
	function inspectState(selector) {
		if (typeof selector !== "string" || !selector.trim()) return null;
		try {
			var root = getFiberRoot();
			if (!root) return null;
			var c = getRNComponents();
			var parsed;
			try {
				parsed = parseSelector(selector.trim());
			} catch (_unused) {
				return null;
			}
			var foundFiber = null;
			for (var si = 0; si < parsed.selectors.length && !foundFiber; si++) {
				var complex = parsed.selectors[si];
				(function visit(fiber) {
					if (!fiber || foundFiber) return;
					if (matchesComplexSelector(fiber, complex, c.Text, c.Image)) {
						foundFiber = fiber;
						return;
					}
					visit(fiber.child);
					visit(fiber.sibling);
				})(root);
			}
			if (!foundFiber) return null;
			var target = foundFiber;
			if (target.tag !== 0 && target.tag !== 1) {
				var p = target.return;
				while (p) {
					if (p.tag === 0 || p.tag === 1) {
						target = p;
						break;
					}
					p = p.return;
				}
				if (target.tag !== 0 && target.tag !== 1) return null;
			}
			var hooks = parseHooks(target);
			return {
				component: getFiberTypeName(target),
				hooks: hooks.map(function(h) {
					return {
						index: h.index,
						type: h.type,
						value: safeClone(h.value)
					};
				})
			};
		} catch (_unused2) {
			return null;
		}
	}
	/**
	* getStateChanges(options) → 상태 변경 이력 조회.
	* options: { component?, since?, limit? }
	*/
	function getStateChanges(options) {
		var opts = typeof options === "object" && options !== null ? options : {};
		var out = stateChanges;
		if (typeof opts.component === "string" && opts.component) {
			var componentFilter = opts.component;
			out = out.filter(function(entry) {
				return entry.component === componentFilter;
			});
		}
		if (typeof opts.since === "number") {
			var since = opts.since;
			out = out.filter(function(entry) {
				return entry.timestamp > since;
			});
		}
		var limit = typeof opts.limit === "number" && opts.limit > 0 ? opts.limit : 100;
		if (out.length > limit) out = out.slice(out.length - limit);
		return out;
	}
	/** 상태 변경 버퍼 초기화 */
	function clearStateChanges() {
		resetStateChanges();
	}
	var init_mcp_state = __esmMin(() => {
		init_fiber_helpers();
		init_query_selector();
		init_state_hooks();
		init_shared();
	});

//#endregion
//#region src/runtime/mcp-render.ts
/** 프로파일링 시작 */
	function startRenderProfile(options) {
		var opts = typeof options === "object" && options !== null ? options : {};
		resetRenderProfile();
		setRenderProfileActive(true);
		setRenderProfileStartTime(Date.now());
		if (Array.isArray(opts.components) && opts.components.length > 0) setRenderComponentFilter(opts.components);
		if (Array.isArray(opts.ignore) && opts.ignore.length > 0) setRenderIgnoreFilter(opts.ignore);
		return { started: true };
	}
	/** 수집된 데이터 집계 리포트 반환 */
	function getRenderReport() {
		var now = Date.now();
		var durationStr = ((renderProfileStartTime > 0 ? now - renderProfileStartTime : 0) / 1e3).toFixed(1) + "s";
		var commitIds = {};
		for (var i = 0; i < renderEntries.length; i++) commitIds[renderEntries[i].commitId] = true;
		var totalCommits = Object.keys(commitIds).length;
		var componentMap = {};
		for (var j = 0; j < renderEntries.length; j++) {
			var entry = renderEntries[j];
			var comp = componentMap[entry.component];
			if (!comp) {
				comp = {
					name: entry.component,
					renders: 0,
					mounts: 0,
					unnecessaryRenders: 0,
					triggers: {},
					isMemoized: entry.isMemoized,
					recentRenders: []
				};
				if (entry.nativeType) comp.nativeType = entry.nativeType;
				componentMap[entry.component] = comp;
			}
			comp.renders++;
			if (entry.type === "mount") comp.mounts++;
			else {
				comp.triggers[entry.trigger] = (comp.triggers[entry.trigger] || 0) + 1;
				if (entry.trigger === "parent") comp.unnecessaryRenders++;
			}
			if (entry.isMemoized) comp.isMemoized = true;
			comp.recentRenders.push(entry);
			if (comp.recentRenders.length > 5) comp.recentRenders.shift();
		}
		var components = [];
		for (var key in componentMap) if (componentMap.hasOwnProperty(key)) components.push(componentMap[key]);
		components.sort(function(a, b) {
			return b.renders - a.renders;
		});
		if (components.length > 20) components = components.slice(0, 20);
		var hotComponents = components.map(function(c) {
			var result = {
				name: c.name,
				renders: c.renders,
				mounts: c.mounts,
				unnecessaryRenders: c.unnecessaryRenders,
				triggers: c.triggers,
				isMemoized: c.isMemoized
			};
			if (c.nativeType) result.nativeType = c.nativeType;
			result.recentRenders = c.recentRenders.map(function(r) {
				var recent = {
					timestamp: r.timestamp,
					trigger: r.trigger,
					commitId: r.commitId,
					parent: r.parent
				};
				if (r.changes) recent.changes = r.changes;
				return recent;
			});
			return result;
		});
		return {
			profiling: renderProfileActive,
			startTime: renderProfileStartTime,
			endTime: now,
			duration: durationStr,
			totalCommits,
			totalRenders: renderEntries.length,
			hotComponents
		};
	}
	/** 프로파일링 중지 + 데이터 초기화 */
	function clearRenderProfile() {
		resetRenderProfile();
		return { cleared: true };
	}
	var init_mcp_render = __esmMin(() => {
		init_shared();
	});

//#endregion
//#region src/runtime/mcp-query.ts
/**
	* querySelectorAll(selector) → 매칭되는 모든 fiber 정보 배열.
	*/
	function querySelectorAll(selector) {
		if (typeof selector !== "string" || !selector.trim()) return [];
		try {
			var root = getFiberRoot();
			if (!root) return [];
			var c = getRNComponents();
			var parsed;
			try {
				parsed = parseSelector(selector.trim());
			} catch (_unused) {
				return [];
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
						if (nth === -1 || nth === -2) results.push(fiberToResult(fiber, c.Text, c.Image));
						else if (matchCount === nth) results.push(fiberToResult(fiber, c.Text, c.Image));
						matchCount++;
					}
					visit(fiber.child);
					visit(fiber.sibling);
				})(root);
			}
			if (lastSeg.selector.nth === -2 && results.length > 1) results = [results[results.length - 1]];
			var deduped = [];
			var seen = {};
			for (var di = 0; di < results.length; di++) {
				var r = results[di];
				var key = r.uid || "";
				if (!key || seen[key] === void 0) {
					seen[key] = deduped.length;
					deduped.push(r);
				} else {
					var idx = seen[key];
					if (idx !== void 0) {
						var prev = deduped[idx];
						if (r.hasScrollTo && !prev.hasScrollTo) deduped[idx] = r;
						else if (r.hasOnPress && !prev.hasOnPress) deduped[idx] = r;
					}
				}
			}
			return deduped;
		} catch (_unused2) {
			return [];
		}
	}
	/**
	* querySelector(selector) → 첫 번째 매칭 fiber 정보 또는 null.
	*/
	function querySelector(selector) {
		if (typeof selector !== "string" || !selector.trim()) return null;
		try {
			var all = querySelectorAll(selector);
			return all.length > 0 ? all[0] : null;
		} catch (_unused3) {
			return null;
		}
	}
	/**
	* querySelectorWithMeasure(selector) → Promise<결과 | null>
	* Fabric: fiberToResult의 measureViewSync로 이미 measure 포함 → 즉시 반환.
	* Bridge: measure가 null인 경우 async measureView fallback.
	*/
	function querySelectorWithMeasure(selector) {
		var el = querySelector(selector);
		if (!el) return Promise.resolve(null);
		if (el.measure) return Promise.resolve(el);
		if (typeof el._nativeTag === "number") return measureByNativeTag(el._nativeTag).then(function(m) {
			el.measure = m;
			return el;
		}).catch(function() {
			return measureView(el.uid).then(function(m) {
				el.measure = m;
				return el;
			}).catch(function() {
				return el;
			});
		});
		return measureView(el.uid).then(function(m) {
			el.measure = m;
			return el;
		}).catch(function() {
			if (el._measureUid && el._measureUid !== el.uid) return measureView(el._measureUid).then(function(m) {
				el.measure = m;
				return el;
			}).catch(function() {
				return el;
			});
			return el;
		});
	}
	/**
	* querySelectorAllWithMeasure(selector) → Promise<배열>
	* measure가 null인 요소만 비동기 보충.
	*/
	function querySelectorAllWithMeasure(selector) {
		var list = querySelectorAll(selector);
		if (!list.length) return Promise.resolve(list);
		var needsMeasure = [];
		for (var i = 0; i < list.length; i++) if (!list[i].measure) needsMeasure.push(i);
		if (!needsMeasure.length) return Promise.resolve(list);
		var chain = Promise.resolve();
		needsMeasure.forEach(function(idx) {
			chain = chain.then(function() {
				var item = list[idx];
				if (typeof item._nativeTag === "number") return measureByNativeTag(item._nativeTag).then(function(m) {
					item.measure = m;
				}).catch(function() {
					return measureView(item.uid).then(function(m) {
						item.measure = m;
					}).catch(function() {});
				});
				return measureView(item.uid).then(function(m) {
					item.measure = m;
				}).catch(function() {
					if (item._measureUid && item._measureUid !== item.uid) return measureView(item._measureUid).then(function(m) {
						item.measure = m;
					}).catch(function() {});
				});
			});
		});
		return chain.then(function() {
			return list;
		});
	}
	var init_mcp_query = __esmMin(() => {
		init_fiber_helpers();
		init_query_selector();
		init_fiber_serialization();
		init_mcp_measure();
	});

//#endregion
//#region src/runtime/mcp-accessibility.ts
/**
	* 접근성(a11y) 자동 감사. Fiber 트리 순회 후 규칙 위반 목록 반환.
	* 반환: [{ rule, selector, severity, message }]
	*/
	function getAccessibilityAudit(options) {
		try {
			var root = getFiberRoot();
			if (!root) return [];
			var c = getRNComponents();
			var TextComp = c && c.Text;
			var ImageComp = c && c.Image;
			var maxDepth = options && typeof options.maxDepth === "number" ? options.maxDepth : 999;
			var minTouchTarget = 44;
			var violations = [];
			function selectorFor(_fiber, typeName, testID, pathUid) {
				if (testID) return "#" + testID;
				return typeName + (pathUid ? "@" + pathUid : "");
			}
			function visit(fiber, path, depth) {
				if (!fiber || depth > maxDepth) return;
				var props = fiber.memoizedProps || {};
				var typeName = getFiberTypeName(fiber);
				var testID = typeof props.testID === "string" && props.testID.trim() ? props.testID.trim() : void 0;
				var pathUid = getPathUid(fiber);
				var hasOnPress = typeof props.onPress === "function";
				var hasOnLongPress = typeof props.onLongPress === "function";
				var accessibilityLabel = typeof props.accessibilityLabel === "string" && props.accessibilityLabel.trim() ? props.accessibilityLabel.trim() : "";
				var accessibilityRole = typeof props.accessibilityRole === "string" && props.accessibilityRole.trim() ? props.accessibilityRole.trim() : "";
				if (hasOnPress || hasOnLongPress) {
					if (!(accessibilityLabel || collectText(fiber, TextComp).replace(/\s+/g, " ").trim() || collectAccessibilityLabel(fiber, ImageComp))) violations.push({
						rule: "pressable-needs-label",
						selector: selectorFor(fiber, typeName, testID, pathUid),
						severity: "error",
						message: typeName + "에 onPress/onLongPress가 있으나 accessibilityLabel 또는 접근 가능한 텍스트가 없습니다."
					});
					if (!accessibilityRole) violations.push({
						rule: "missing-role",
						selector: selectorFor(fiber, typeName, testID, pathUid),
						severity: "warning",
						message: "인터랙티브 요소에 accessibilityRole이 없습니다."
					});
				}
				if (fiber.type === ImageComp) {
					if (!accessibilityLabel) violations.push({
						rule: "image-needs-alt",
						selector: selectorFor(fiber, typeName, testID, pathUid),
						severity: "error",
						message: "Image에 accessibilityLabel(또는 alt)이 없습니다."
					});
				}
				var child = fiber.child;
				var idx = 0;
				while (child) {
					visit(child, path + "." + idx, depth + 1);
					child = child.sibling;
					idx += 1;
				}
			}
			visit(root, "0", 0);
			var touchables = [];
			(function collectTouchables(fiber, path, depth) {
				if (!fiber || depth > maxDepth) return;
				var props = fiber.memoizedProps || {};
				var hasOnPress = typeof props.onPress === "function";
				var hasOnLongPress = typeof props.onLongPress === "function";
				if (hasOnPress || hasOnLongPress) {
					var testID = typeof props.testID === "string" && props.testID.trim() ? props.testID.trim() : void 0;
					touchables.push({
						fiber,
						typeName: getFiberTypeName(fiber),
						testID,
						pathUid: getPathUid(fiber)
					});
				}
				var child = fiber.child;
				var idx = 0;
				while (child) {
					collectTouchables(child, path + "." + idx, depth + 1);
					child = child.sibling;
					idx += 1;
				}
			})(root, "0", 0);
			for (var i = 0; i < touchables.length; i++) {
				var t = touchables[i];
				if (t === void 0) continue;
				var item = t;
				var uid = item.testID || item.pathUid;
				var measure = null;
				try {
					measure = globalThis.__REACT_NATIVE_MCP__.measureViewSync(uid);
				} catch (_unused) {}
				if (!measure && typeof item.fiber.type !== "string") {
					var hostChild = (function findHost(f) {
						if (!f) return null;
						if (typeof f.type === "string" && f.stateNode) return f;
						var ch = f.child;
						while (ch) {
							var h = findHost(ch);
							if (h) return h;
							ch = ch.sibling;
						}
						return null;
					})(item.fiber.child);
					if (hostChild) {
						var hostUid = hostChild.memoizedProps && hostChild.memoizedProps.testID || getPathUid(hostChild);
						try {
							measure = measureViewSync(hostUid);
						} catch (_unused2) {}
					}
				}
				if (measure && (measure.width < minTouchTarget || measure.height < minTouchTarget)) violations.push({
					rule: "touch-target-size",
					selector: item.testID ? "#" + item.testID : item.typeName + "@" + item.pathUid,
					severity: "warning",
					message: "터치 영역이 " + minTouchTarget + "x" + minTouchTarget + "pt 미만입니다 (" + Math.round(measure.width) + "x" + Math.round(measure.height) + "pt)"
				});
			}
			return violations;
		} catch (_unused3) {
			return [];
		}
	}
	var init_mcp_accessibility = __esmMin(() => {
		init_fiber_helpers();
		init_mcp_measure();
		init_query_selector();
	});

//#endregion
//#region src/runtime/network-mock.ts
	function matchesMockRule(rule, method, url) {
		if (!rule.enabled) return false;
		if (rule.method && rule.method !== method) return false;
		if (rule.isRegex) try {
			return new RegExp(rule.urlPattern).test(url);
		} catch (_unused) {
			return false;
		}
		return url.indexOf(rule.urlPattern) !== -1;
	}
	function findMatchingMock(method, url) {
		for (var i = 0; i < networkMockRules.length; i++) if (matchesMockRule(networkMockRules[i], method, url)) {
			networkMockRules[i].hitCount++;
			return networkMockRules[i];
		}
		return null;
	}
	function addNetworkMock(opts) {
		var rule = {
			id: ++_nextMockId,
			urlPattern: opts.urlPattern,
			isRegex: !!opts.isRegex,
			method: opts.method ? opts.method.toUpperCase() : null,
			response: {
				status: opts.status != null ? opts.status : 200,
				statusText: opts.statusText || null,
				headers: opts.headers || {},
				body: opts.body != null ? String(opts.body) : "",
				delay: opts.delay != null ? opts.delay : 0
			},
			enabled: true,
			hitCount: 0
		};
		networkMockRules.push(rule);
		return rule;
	}
	function removeNetworkMock(id) {
		for (var i = 0; i < networkMockRules.length; i++) if (networkMockRules[i].id === id) {
			networkMockRules.splice(i, 1);
			return true;
		}
		return false;
	}
	function listNetworkMocks() {
		return networkMockRules.map(function(r) {
			return {
				id: r.id,
				urlPattern: r.urlPattern,
				isRegex: r.isRegex,
				method: r.method,
				status: r.response.status,
				enabled: r.enabled,
				hitCount: r.hitCount
			};
		});
	}
	function clearNetworkMocks() {
		networkMockRules.length = 0;
		return true;
	}
	var _nextMockId;
	var init_network_mock = __esmMin(() => {
		init_shared();
		_nextMockId = 0;
	});

//#endregion
//#region src/runtime/mcp-object.ts
	var MCP;
	var init_mcp_object = __esmMin(() => {
		init_mcp_registration();
		init_mcp_introspection();
		init_mcp_actions();
		init_mcp_webview();
		init_mcp_scroll();
		init_mcp_console();
		init_mcp_network();
		init_network_mock();
		init_mcp_state();
		init_mcp_render();
		init_render_overlay();
		init_mcp_query();
		init_mcp_measure();
		init_mcp_accessibility();
		MCP = {
			registerComponent,
			registerPressHandler,
			triggerPress,
			triggerLongPress,
			getRegisteredPressTestIDs,
			getClickables,
			getTextNodes,
			getComponentTree,
			getSourceRefForUid,
			pressByLabel,
			longPressByLabel,
			typeText,
			registerWebView,
			unregisterWebView,
			getWebViewIdForRef,
			clickInWebView,
			evaluateInWebView,
			evaluateInWebViewAsync,
			handleWebViewMessage,
			createWebViewOnMessage,
			getRegisteredWebViewIds,
			registerScrollRef,
			unregisterScrollRef,
			scrollTo,
			getRegisteredScrollTestIDs,
			getConsoleLogs,
			clearConsoleLogs,
			getNetworkRequests,
			clearNetworkRequests,
			addNetworkMock,
			removeNetworkMock,
			listNetworkMocks,
			clearNetworkMocks,
			inspectState,
			getStateChanges,
			clearStateChanges,
			querySelector,
			querySelectorAll,
			querySelectorWithMeasure,
			querySelectorAllWithMeasure,
			getScreenInfo,
			measureView,
			measureViewSync,
			getAccessibilityAudit,
			startRenderProfile,
			getRenderReport,
			clearRenderProfile,
			startRenderHighlight,
			stopRenderHighlight
		};
		if (typeof global !== "undefined") global.__REACT_NATIVE_MCP__ = MCP;
		if (typeof globalThis !== "undefined") globalThis.__REACT_NATIVE_MCP__ = MCP;
	});

//#endregion
//#region src/runtime/console-hook.ts
	var _origNativeLoggingHook;
	var init_console_hook = __esmMin(() => {
		init_shared();
		_origNativeLoggingHook = typeof global !== "undefined" ? global.nativeLoggingHook : void 0;
		if (typeof global !== "undefined") global.nativeLoggingHook = function(msg, level) {
			pushConsoleLog({
				id: nextConsoleLogId(),
				message: msg,
				level,
				timestamp: Date.now()
			});
			if (typeof _origNativeLoggingHook === "function") _origNativeLoggingHook(msg, level);
		};
	});

//#endregion
//#region src/runtime/network-helpers.ts
/** fetch 진입 시 호출. 이 요청용 request id를 등록해 두고, XHR이 takeCurrentFetchRequestId로 가져감 */
	function setCurrentFetchRequest(url, method, id) {
		currentFetchRequest = {
			url,
			method,
			id,
			time: Date.now()
		};
	}
	/** XHR send 시 호출. 방금 시작한 fetch와 url+method가 같으면 그 fetch의 request id를 반환하고 초기화(한 번만 사용) */
	function takeCurrentFetchRequestId(url, method) {
		if (!currentFetchRequest) return null;
		const now = Date.now();
		if (currentFetchRequest.url !== url || currentFetchRequest.method !== method || now - currentFetchRequest.time > RECENT_FETCH_MS) return null;
		const id = currentFetchRequest.id;
		currentFetchRequest = null;
		return id;
	}
	/** entry.id가 이미 있으면 기존 항목에 병합(id로 동일 요청 판단). 없으면 새 id 부여 후 push */
	function pushNetworkEntry(entry) {
		const id = entry.id;
		if (id != null && id > 0) {
			const existing = networkRequests.find((e) => e.id === id);
			if (existing) {
				if (entry.status != null) existing.status = entry.status;
				if (entry.statusText != null) existing.statusText = entry.statusText;
				if (entry.responseHeaders != null) existing.responseHeaders = entry.responseHeaders;
				if (entry.responseBody != null) existing.responseBody = entry.responseBody;
				if (entry.duration != null) existing.duration = entry.duration;
				if (entry.state != null) existing.state = entry.state;
				if (entry.error != null) existing.error = entry.error;
				if (entry.mocked != null) existing.mocked = entry.mocked;
				return;
			}
		}
		if (entry.id == null || entry.id === 0) entry.id = nextNetworkRequestId();
		networkRequests.push(entry);
		if (networkRequests.length > NETWORK_BUFFER_SIZE) networkRequests.shift();
	}
	function truncateBody(body) {
		if (body == null) return null;
		var s = typeof body === "string" ? body : String(body);
		return s.length > NETWORK_BODY_LIMIT ? s.substring(0, NETWORK_BODY_LIMIT) : s;
	}
	var RECENT_FETCH_MS, currentFetchRequest;
	var init_network_helpers = __esmMin(() => {
		init_shared();
		RECENT_FETCH_MS = 200;
		currentFetchRequest = null;
	});

//#endregion
//#region src/runtime/xhr-patch.ts
	var init_xhr_patch = __esmMin(() => {
		init_network_helpers();
		init_network_mock();
		(function() {
			if (typeof XMLHttpRequest === "undefined") return;
			var XHR = XMLHttpRequest.prototype;
			var _origOpen = XHR.open;
			var _origSend = XHR.send;
			var _origSetRequestHeader = XHR.setRequestHeader;
			XHR.open = function(method, url) {
				this.__mcpNetworkEntry = {
					id: 0,
					method: (method || "GET").toUpperCase(),
					url: String(url || ""),
					requestHeaders: {},
					requestBody: null,
					status: null,
					statusText: null,
					responseHeaders: null,
					responseBody: null,
					startTime: Date.now(),
					duration: null,
					error: null,
					state: "pending"
				};
				return _origOpen.apply(this, arguments);
			};
			XHR.setRequestHeader = function(name, value) {
				if (this.__mcpNetworkEntry) this.__mcpNetworkEntry.requestHeaders[name] = value;
				return _origSetRequestHeader.apply(this, arguments);
			};
			XHR.send = function(body) {
				var entry = this.__mcpNetworkEntry;
				if (entry) {
					entry.requestBody = truncateBody(body);
					var fetchId = takeCurrentFetchRequestId(entry.url, entry.method);
					if (fetchId != null) entry.id = fetchId;
					var mockRule = findMatchingMock(entry.method, entry.url);
					if (mockRule) {
						var xhr = this;
						var mockResp = mockRule.response;
						var deliverMock = function() {
							entry.status = mockResp.status;
							entry.statusText = mockResp.statusText || null;
							entry.responseHeaders = JSON.stringify(mockResp.headers);
							entry.responseBody = truncateBody(mockResp.body);
							entry.duration = Date.now() - entry.startTime;
							entry.state = "done";
							entry.mocked = true;
							pushNetworkEntry(entry);
							var fakeId = -1 - Date.now();
							try {
								xhr.__didCreateRequest(fakeId);
								xhr.__didReceiveResponse(fakeId, mockResp.status, mockResp.headers || {}, entry.url);
								if (mockResp.body) xhr.__didReceiveData(fakeId, mockResp.body);
								xhr.__didCompleteResponse(fakeId, "", false);
							} catch (_unused) {}
						};
						setTimeout(deliverMock, mockResp.delay > 0 ? mockResp.delay : 0);
						return;
					}
					var xhr = this;
					xhr.addEventListener("load", function() {
						entry.status = xhr.status;
						entry.statusText = xhr.statusText || null;
						try {
							entry.responseHeaders = xhr.getAllResponseHeaders() || null;
						} catch (_unused2) {
							entry.responseHeaders = null;
						}
						try {
							entry.responseBody = truncateBody(xhr.responseText);
						} catch (_unused3) {
							entry.responseBody = null;
						}
						entry.duration = Date.now() - entry.startTime;
						entry.state = "done";
						pushNetworkEntry(entry);
					});
					xhr.addEventListener("error", function() {
						entry.duration = Date.now() - entry.startTime;
						entry.error = "Network error";
						entry.state = "error";
						pushNetworkEntry(entry);
					});
					xhr.addEventListener("timeout", function() {
						entry.duration = Date.now() - entry.startTime;
						entry.error = "Timeout";
						entry.state = "error";
						pushNetworkEntry(entry);
					});
				}
				return _origSend.apply(this, arguments);
			};
		})();
	});

//#endregion
//#region src/runtime/fetch-patch.ts
	var init_fetch_patch = __esmMin(() => {
		init_shared();
		init_network_helpers();
		init_network_mock();
		(function() {
			var g = typeof globalThis !== "undefined" ? globalThis : typeof global !== "undefined" ? global : null;
			if (!g || typeof g.fetch !== "function") return;
			var _origFetch = g.fetch;
			g.fetch = function(input, init) {
				var url = "";
				var method = "GET";
				var requestHeaders = {};
				var requestBody = null;
				if (typeof input === "string") url = input;
				else if (input && typeof input === "object" && typeof input.url === "string") {
					url = input.url;
					if (input.method) method = input.method.toUpperCase();
					if (input.headers) try {
						if (typeof input.headers.forEach === "function") input.headers.forEach(function(v, k) {
							requestHeaders[k] = v;
						});
						else if (typeof input.headers === "object") {
							var hk = Object.keys(input.headers);
							for (var i = 0; i < hk.length; i++) {
								var key = hk[i];
								if (key === void 0) continue;
								requestHeaders[key] = input.headers[key];
							}
						}
					} catch (_unused) {}
					if (input.body != null) requestBody = input.body;
				}
				if (init && typeof init === "object") {
					if (init.method) method = init.method.toUpperCase();
					if (init.headers) try {
						if (typeof init.headers.forEach === "function") init.headers.forEach(function(v, k) {
							requestHeaders[k] = v;
						});
						else if (typeof init.headers === "object") {
							var hk2 = Object.keys(init.headers);
							for (var j = 0; j < hk2.length; j++) {
								var key = hk2[j];
								if (key === void 0) continue;
								requestHeaders[key] = init.headers[key];
							}
						}
					} catch (_unused2) {}
					if (init.body != null) requestBody = init.body;
				}
				var bodyStr = null;
				if (requestBody != null) {
					bodyStr = typeof requestBody === "string" ? requestBody : typeof requestBody.toString === "function" ? requestBody.toString() : String(requestBody);
					if (bodyStr != null && bodyStr.length > NETWORK_BODY_LIMIT) bodyStr = bodyStr.substring(0, NETWORK_BODY_LIMIT);
				}
				var requestId = nextNetworkRequestId();
				setCurrentFetchRequest(url, method, requestId);
				var entry = {
					id: requestId,
					method,
					url,
					requestHeaders,
					requestBody: bodyStr,
					status: null,
					statusText: null,
					responseHeaders: null,
					responseBody: null,
					startTime: Date.now(),
					duration: null,
					error: null,
					state: "pending"
				};
				var mockRule = findMatchingMock(method, url);
				if (mockRule) {
					var mockResp = mockRule.response;
					var deliverMock = function() {
						entry.status = mockResp.status;
						entry.statusText = mockResp.statusText || null;
						entry.responseHeaders = JSON.stringify(mockResp.headers);
						entry.responseBody = truncateBody(mockResp.body);
						entry.duration = Date.now() - entry.startTime;
						entry.state = "done";
						entry.mocked = true;
						pushNetworkEntry(entry);
						var fakeResponse;
						try {
							fakeResponse = new Response(mockResp.body, {
								status: mockResp.status,
								statusText: mockResp.statusText || "",
								headers: mockResp.headers
							});
						} catch (_unused3) {
							var _body = mockResp.body;
							fakeResponse = {
								ok: mockResp.status >= 200 && mockResp.status < 300,
								status: mockResp.status,
								statusText: mockResp.statusText || "",
								headers: {
									get: function(k) {
										return mockResp.headers[k] || null;
									},
									forEach: function(cb) {
										for (var hk in mockResp.headers) cb(mockResp.headers[hk], hk);
									}
								},
								text: function() {
									return Promise.resolve(_body);
								},
								json: function() {
									try {
										return Promise.resolve(JSON.parse(_body));
									} catch (e) {
										return Promise.reject(/* @__PURE__ */ new SyntaxError("Invalid JSON: " + e.message));
									}
								},
								clone: function() {
									return fakeResponse;
								},
								url,
								type: "basic",
								redirected: false,
								bodyUsed: false
							};
						}
						return fakeResponse;
					};
					if (mockResp.delay > 0) return new Promise(function(resolve) {
						setTimeout(function() {
							resolve(deliverMock());
						}, mockResp.delay);
					});
					return new Promise(function(resolve) {
						setTimeout(function() {
							resolve(deliverMock());
						}, 0);
					});
				}
				return _origFetch.apply(this, arguments).then(function(response) {
					entry.status = response.status;
					entry.statusText = response.statusText || null;
					try {
						var headerObj = {};
						if (response.headers && typeof response.headers.forEach === "function") response.headers.forEach(function(v, k) {
							headerObj[k] = v;
						});
						entry.responseHeaders = JSON.stringify(headerObj);
					} catch (_unused4) {
						entry.responseHeaders = null;
					}
					entry.duration = Date.now() - entry.startTime;
					entry.state = "done";
					try {
						response.clone().text().then(function(text) {
							entry.responseBody = text && text.length > NETWORK_BODY_LIMIT ? text.substring(0, NETWORK_BODY_LIMIT) : text || null;
							pushNetworkEntry(entry);
						}).catch(function() {
							pushNetworkEntry(entry);
						});
					} catch (_unused5) {
						pushNetworkEntry(entry);
					}
					return response;
				}, function(err) {
					entry.duration = Date.now() - entry.startTime;
					entry.error = err && err.message ? err.message : "Network error";
					entry.state = "error";
					pushNetworkEntry(entry);
					throw err;
				});
			};
		})();
	});

//#endregion
//#region src/runtime/connection.ts
	function _shouldConnect() {
		if (_mcpEnabled) return true;
		if (typeof global !== "undefined" && global.__REACT_NATIVE_MCP_ENABLED__) return true;
		if (typeof globalThis !== "undefined" && globalThis.__REACT_NATIVE_MCP_ENABLED__) return true;
		return false;
	}
	function _stopHeartbeat() {
		if (_heartbeatTimer != null) {
			clearInterval(_heartbeatTimer);
			_heartbeatTimer = null;
		}
		if (_pongTimer != null) {
			clearTimeout(_pongTimer);
			_pongTimer = null;
		}
	}
	function _startHeartbeat() {
		_stopHeartbeat();
		_heartbeatTimer = setInterval(function() {
			if (!ws || ws.readyState !== 1) {
				_stopHeartbeat();
				return;
			}
			try {
				ws.send(JSON.stringify({ type: "ping" }));
			} catch (_unused) {
				return;
			}
			_pongTimer = setTimeout(function() {
				if (ws) try {
					ws.close();
				} catch (_unused2) {}
			}, PONG_TIMEOUT_MS);
		}, HEARTBEAT_INTERVAL_MS);
	}
	function connect() {
		if (!_shouldConnect()) return;
		if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
		ws = null;
		try {
			ws = new WebSocket(wsUrl);
		} catch (_unused3) {
			ws = null;
			_reconnectTimer = setTimeout(function() {
				connect();
				if (reconnectDelay < 3e4) reconnectDelay = Math.min(reconnectDelay * 1.5, 3e4);
			}, reconnectDelay);
			return;
		}
		ws.onopen = function() {
			if (typeof console !== "undefined" && console.warn) console.warn("[MCP] Connected to server", wsUrl);
			reconnectDelay = 1e3;
			if (_reconnectTimer != null) clearTimeout(_reconnectTimer);
			_reconnectTimer = null;
			var platform = null;
			var deviceName = null;
			var origin = null;
			var pixelRatio = null;
			try {
				var rn = require("react-native");
				platform = rn.Platform && rn.Platform.OS;
				deviceName = rn.Platform && rn.Platform.constants && rn.Platform.constants.Model || null;
				if (rn.PixelRatio) pixelRatio = rn.PixelRatio.get();
			} catch (_e) {
				if (typeof console !== "undefined" && console.warn) console.warn("[MCP] Failed to read platform info:", _e instanceof Error ? _e.message : String(_e));
			}
			try {
				var _rn = require("react-native");
				var scriptURL = _rn.NativeModules && _rn.NativeModules.SourceCode && _rn.NativeModules.SourceCode.scriptURL;
				if (scriptURL && typeof scriptURL === "string") try {
					origin = new URL(scriptURL).origin;
				} catch (_unused4) {
					var _match$;
					var match = scriptURL.match(/^(https?:\/\/[^/?#]+)/);
					if (match) origin = (_match$ = match[1]) !== null && _match$ !== void 0 ? _match$ : null;
				}
			} catch (_e2) {
				if (typeof console !== "undefined" && console.warn) console.warn("[MCP] Failed to read metro URL:", _e2 instanceof Error ? _e2.message : String(_e2));
			}
			try {
				ws.send(JSON.stringify({
					type: "init",
					platform,
					deviceId: platform ? platform + "-1" : void 0,
					deviceName,
					metroBaseUrl: origin,
					pixelRatio
				}));
			} catch (_e3) {
				if (typeof console !== "undefined" && console.warn) console.warn("[MCP] Failed to send init:", _e3 instanceof Error ? _e3.message : String(_e3));
			}
			_startHeartbeat();
		};
		ws.onmessage = function(ev) {
			try {
				var msg = JSON.parse(ev.data);
				if (msg.type === "pong") {
					if (_pongTimer != null) {
						clearTimeout(_pongTimer);
						_pongTimer = null;
					}
					return;
				}
				if (msg.type === "setTopInsetDp" && typeof msg.topInsetDp === "number") {
					setOverlayTopInsetDp(msg.topInsetDp);
					return;
				}
				if (msg.method === "eval" && msg.id != null) {
					var result;
					var errMsg = null;
					try {
						result = eval(msg.params && msg.params.code != null ? msg.params.code : "undefined");
					} catch (e) {
						errMsg = e && e.message != null ? e.message : String(e);
					}
					function sendEvalResponse(res, err) {
						try {
							if (ws && ws.readyState === 1) ws.send(JSON.stringify(err != null ? {
								id: msg.id,
								error: err
							} : {
								id: msg.id,
								result: res
							}));
						} catch (_unused5) {}
					}
					if (errMsg != null) sendEvalResponse(null, errMsg);
					else if (result != null && typeof result.then === "function") result.then(function(r) {
						sendEvalResponse(r, null);
					}, function(e) {
						sendEvalResponse(null, e && e.message != null ? e.message : String(e));
					});
					else sendEvalResponse(result, null);
				}
			} catch (_unused6) {}
		};
		ws.onclose = function() {
			_stopHeartbeat();
			ws = null;
			_reconnectTimer = setTimeout(function() {
				connect();
				if (reconnectDelay < 3e4) reconnectDelay = Math.min(reconnectDelay * 1.5, 3e4);
			}, reconnectDelay);
		};
		ws.onerror = function() {
			_stopHeartbeat();
		};
	}
	var _isDevMode, wsUrl, ws, _reconnectTimer, reconnectDelay, _mcpEnabled, _heartbeatTimer, _pongTimer, HEARTBEAT_INTERVAL_MS, PONG_TIMEOUT_MS, _AppRegistry, _originalRun, PERIODIC_INTERVAL_MS;
	var init_connection = __esmMin(() => {
		init_mcp_object();
		init_shared();
		_isDevMode = typeof globalThis !== "undefined" && typeof globalThis.__DEV__ !== "undefined" && globalThis.__DEV__ || typeof process !== "undefined" && process.env && process.env.REACT_NATIVE_MCP_ENABLED === "true";
		if (_isDevMode && typeof console !== "undefined" && console.warn) console.warn("[MCP] runtime loaded, __REACT_NATIVE_MCP__ available");
		wsUrl = "ws://localhost:12300";
		ws = null;
		_reconnectTimer = null;
		reconnectDelay = 1e3;
		_mcpEnabled = _isDevMode;
		_heartbeatTimer = null;
		_pongTimer = null;
		HEARTBEAT_INTERVAL_MS = 3e4;
		PONG_TIMEOUT_MS = 1e4;
		/**
		* 릴리즈 빌드에서 MCP WebSocket 연결을 활성화한다.
		* 권장: 빌드 시 REACT_NATIVE_MCP_ENABLED 로 Metro 실행(transformer가 global 주입). 앱 코드 불필요.
		* 레거시: 앱에서 __REACT_NATIVE_MCP__.enable() 호출도 가능.
		*/
		MCP.enable = function() {
			_mcpEnabled = true;
			connect();
		};
		if (_isDevMode) connect();
		_AppRegistry = require("react-native").AppRegistry;
		_originalRun = _AppRegistry.runApplication;
		_AppRegistry.runApplication = function() {
			if (_shouldConnect() && (!ws || ws.readyState !== 1)) connect();
			return _originalRun.apply(this, arguments);
		};
		(function() {
			try {
				var rn = require("react-native");
				if (rn && rn.AppState && typeof rn.AppState.addEventListener === "function") rn.AppState.addEventListener("change", function(nextState) {
					if (nextState === "active") {
						if (ws && ws.readyState === 1) _startHeartbeat();
					} else _stopHeartbeat();
				});
			} catch (_unused7) {}
		})();
		PERIODIC_INTERVAL_MS = 5e3;
		setInterval(function() {
			if (!_shouldConnect()) return;
			if (ws && ws.readyState === 1) return;
			connect();
		}, PERIODIC_INTERVAL_MS);
	});

//#endregion
//#region src/runtime/index.ts
/**
	* React Native 앱에 주입되는 MCP 런타임
	* - __REACT_NATIVE_MCP__.registerComponent → AppRegistry.registerComponent 위임
	* - __DEV__ 시 WebSocket으로 MCP 서버(12300)에 연결, eval 요청 처리
	*
	* Metro transformer가 진입점 상단에 require('@ohah/react-native-mcp-server/runtime') 주입
	* global은 모듈 로드 직후 최상단에서 설정해 ReferenceError 방지.
	*/
	var init_runtime = __esmMin(() => {
		init_devtools_hook();
		init_shared();
		init_fiber_helpers();
		init_state_hooks();
		init_render_tracking();
		init_render_overlay();
		init_state_change_tracking();
		init_query_selector();
		init_fiber_serialization();
		init_mcp_registration();
		init_mcp_introspection();
		init_mcp_actions();
		init_mcp_scroll();
		init_mcp_console();
		init_mcp_network();
		init_mcp_state();
		init_mcp_render();
		init_mcp_query();
		init_mcp_measure();
		init_mcp_accessibility();
		init_mcp_object();
		init_console_hook();
		init_network_helpers();
		init_network_mock();
		init_xhr_patch();
		init_fetch_patch();
		init_connection();
	});

//#endregion
init_runtime();
})();