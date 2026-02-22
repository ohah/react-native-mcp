/**
 * Render overlay: react-scan 스타일 시각적 리렌더 하이라이트.
 *
 * react-scan 기준 (https://github.com/aidenybai/react-scan, bippy):
 * - composite fiber만 대상 (tag 0,1,9,11,14,15 — bippy didFiberRender와 동일 집합)
 * - PerformedWork flag (bit 0x1) 로 실제 렌더 여부 판별
 * - getNearestHostFibers DFS로 모든 최근접 host fiber 수집 → rect 병합
 * - 색상: rgb(72,160,195), fill 10%
 * - 페이드: 500ms (react-scan native withTiming duration 동일)
 * - 배지: "ComponentName xN" (rect 위에, 11px 모노스페이스)
 *
 * RN 차이점:
 * - Canvas 불가 → React 컴포넌트 오버레이 (RenderOverlay/MCPRoot ignore 처리)
 * - RN 빌트인(Text, View 등)이 composite fiber → 이름 기반 필터 추가
 * - measureInWindow/UIManager.measure 사용 (IntersectionObserver 불가)
 */

import type { Fiber } from './types';
import { getFiberTypeName } from './fiber-helpers';
import {
  renderHighlight,
  renderHighlightStyle,
  overlayActive,
  overlayComponentFilter,
  overlayIgnoreFilter,
  overlayShowLabels,
  overlayFadeTimeout,
  overlayMaxHighlights,
  overlaySetHighlights,
  setOverlayActive,
  setOverlayComponentFilter,
  setOverlayIgnoreFilter,
  setOverlayShowLabels,
  setOverlayFadeTimeout,
  setOverlayMaxHighlights,
  setOverlaySetHighlights as setOverlaySetHighlightsFn,
  resetOverlay,
  overlayTopInsetDp,
  overlayTopInsetConfirmed,
} from './shared';
import { resolveScreenOffset, screenOffsetX, screenOffsetY } from './screen-offset';

// ─── Composite fiber tags (react-scan/bippy 기준) ─────────────────
// bippy ReactWorkTags: https://github.com/facebook/react/blob/main/packages/react-reconciler/src/ReactWorkTags.js
var FunctionComponentTag = 0;
var ClassComponentTag = 1;
var ForwardRefTag = 11;
var ContextConsumerTag = 9;
var MemoComponentTag = 14;
var SimpleMemoComponentTag = 15;

/**
 * 하이라이트 후보 fiber: bippy isCompositeFiber(0,1,11,14,15) + ContextConsumerTag(9).
 * bippy didFiberRender는 9를 포함하므로, 리렌더 보고 집합을 맞추기 위해 9 포함.
 */
function isCompositeFiber(fiber: Fiber): boolean {
  var tag = fiber.tag;
  return (
    tag === FunctionComponentTag ||
    tag === ClassComponentTag ||
    tag === ForwardRefTag ||
    tag === ContextConsumerTag ||
    tag === MemoComponentTag ||
    tag === SimpleMemoComponentTag
  );
}

/**
 * didFiberRender: PerformedWork flag(bit 0x1)로 실제 렌더 여부 판별.
 * bippy didFiberRender와 동일하게 composite에서 (flags & PerformedWork) 사용.
 * 차이: mount(alternate === null)는 false — 초기 마운트는 하이라이트하지 않고 리렌더만 표시.
 */
function didFiberRender(fiber: Fiber): boolean {
  var alt = fiber.alternate;
  if (alt === null) return false; // mount — 리렌더 하이라이트만 목적
  var flags = (fiber as any).flags;
  if (flags === undefined) flags = (fiber as any).effectTag;
  return typeof flags === 'number' && (flags & 1) !== 0;
}

// ─── 필터링 ───────────────────────────────────────────────────────

/** RN 내부/오버레이 컴포넌트 — 접두사 매칭 */
var OVERLAY_IGNORED_PREFIXES = [
  'RenderOverlay',
  'MCPRoot',
  'LogBox',
  'Pressability',
  'YellowBox',
  'RCT',
  'Debugging',
  'AppContainer',
  'TextAncestor',
  'CellRenderer',
];

function matchesPrefixList(name: string, prefixes: string[]): boolean {
  var target = name;
  if (target.length > 1 && target.charAt(0) === '_') target = target.substring(1);
  for (var i = 0; i < prefixes.length; i++) {
    if (target.indexOf(prefixes[i]!) === 0) return true;
  }
  return false;
}

function shouldSkipOverlay(name: string): boolean {
  // whitelist 모드
  if (overlayComponentFilter !== null) {
    return overlayComponentFilter.indexOf(name) === -1;
  }
  // 사용자 blacklist
  if (overlayIgnoreFilter !== null && overlayIgnoreFilter.indexOf(name) !== -1) {
    return true;
  }
  // RN 내부 + 오버레이 자체
  return matchesPrefixList(name, OVERLAY_IGNORED_PREFIXES);
}

// ─── Highlight data ───────────────────────────────────────────────

/** 스타일별 RGB (쉼표 구분). react-scan: purple, react-mcp: 시안 명도 낮춤(눈 덜 피로) */
var PRIMARY_COLOR = renderHighlightStyle === 'react-mcp' ? '72,160,195' : '115,97,230';

export interface HighlightData {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  count: number;
  alpha: number; // 현재 alpha (fade 중)
  timestamp: number;
  _posKey: string; // react-scan 스타일 위치 기반 키
  _fadeTimerId?: ReturnType<typeof setInterval>; // 머지 시 재페이드용
}

// ─── getNearestHostFibers (bippy getNearestHostFibers와 동일) ─────────────
// bippy isHostFiber: tag 5(HostComponent), 26(HostHoistable), 27(HostSingleton) 또는 type==='string'.

function isHostFiber(fiber: Fiber): boolean {
  var tag = fiber.tag;
  if (tag === 5 || tag === 26 || tag === 27) return true;
  return typeof fiber.type === 'string';
}

/** DFS로 composite fiber 아래의 모든 최근접 host fiber 수집 */
function getNearestHostFibers(fiber: Fiber): Fiber[] {
  var hostFibers: Fiber[] = [];
  var stack: Fiber[] = [];

  if (isHostFiber(fiber) && fiber.stateNode) {
    hostFibers.push(fiber);
  } else if (fiber.child) {
    stack.push(fiber.child);
  }

  while (stack.length > 0) {
    var current = stack.pop()!;
    if (isHostFiber(current) && current.stateNode) {
      hostFibers.push(current);
    } else if (current.child) {
      stack.push(current.child);
    }
    if (current.sibling) {
      stack.push(current.sibling);
    }
  }

  return hostFibers;
}

// ─── Pending measurements (배치 처리) ─────────────────────────────

interface PendingMeasurement {
  hostFibers: Fiber[];
  name: string;
}

var _pendingMeasurements: PendingMeasurement[] = [];
var _flushScheduled = false;

// 현재 활성 하이라이트
var _activeHighlights: HighlightData[] = [];
var _fadeTimers: any[] = [];

// ─── TOTAL_FRAMES / 소멸 시점 (react-scan 스타일) ─────────────────
// 45프레임으로 나눠 선형 페이드. 소멸 = 페이드 시작 후 정확히 overlayFadeTimeout(기본 500ms).
// merge 시 기존 타이머 clear 후 재시작 → 소멸 시점이 "마지막 갱신 + 500ms"로 연기 (react-scan 동일).
var TOTAL_FRAMES = 45;

/**
 * A) react-scan updateFiber 패턴: 변경된 subtree만 순회.
 *
 * 핵심: nextFiber.child !== prevFiber.child 일 때만 자식 순회.
 * 이렇게 하면 overlay setState로 인한 커밋에서 앱 컴포넌트의
 * 이전 PerformedWork flag를 재감지하지 않음.
 */
export function collectOverlayHighlights(rootFiber: Fiber | null): void {
  if (!rootFiber || !overlayActive) return;
  var alt = rootFiber.alternate;
  if (!alt) return; // mount — skip

  _updateFiber(rootFiber, alt);
}

function _updateFiber(nextFiber: Fiber, prevFiber: Fiber): void {
  // composite 판별 + 하이라이트 수집
  if (isCompositeFiber(nextFiber)) {
    var name = getFiberTypeName(nextFiber);

    // 오버레이 자체 subtree 완전 스킵 (cascade 방지)
    if (name === 'RenderOverlay') return;

    if (!shouldSkipOverlay(name) && didFiberRender(nextFiber)) {
      var hostFibers = getNearestHostFibers(nextFiber);
      if (hostFibers.length > 0) {
        _pendingMeasurements.push({ hostFibers: hostFibers, name: name });
      }
    }
  }

  // react-scan 핵심: child 포인터가 변경된 경우에만 자식 순회
  if (nextFiber.child !== prevFiber.child) {
    var child: Fiber | null = nextFiber.child;
    while (child) {
      var childAlt = child.alternate;
      if (childAlt) {
        _updateFiber(child, childAlt);
      }
      // mount (alternate 없음) — 초기 마운트는 하이라이트 대상 아님
      child = child.sibling;
    }
  }
}

/**
 * B) 측정 + 하이라이트 전달 (requestAnimationFrame 배치)
 */
export function flushOverlayMeasurements(): void {
  if (_flushScheduled || _pendingMeasurements.length === 0) return;
  _flushScheduled = true;

  var measurements = _pendingMeasurements.slice();
  _pendingMeasurements.length = 0;

  if (measurements.length > overlayMaxHighlights) {
    measurements = measurements.slice(0, overlayMaxHighlights);
  }

  var raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : setTimeout;
  raf(function () {
    _flushScheduled = false;
    _processMeasurements(measurements);
  });
}

/** 단일 host fiber의 stateNode 측정 → callback(x, y, w, h) */
function _measureHostFiber(
  fiber: Fiber,
  g: any,
  rn: any,
  cb: (x: number, y: number, w: number, h: number) => void
): boolean {
  var node = fiber.stateNode;
  if (!node) return false;

  // Fabric
  if (g.nativeFabricUIManager) {
    var shadowNode =
      node.node ||
      (node._internalInstanceHandle &&
        node._internalInstanceHandle.stateNode &&
        node._internalInstanceHandle.stateNode.node);
    if (!shadowNode && node._viewInfo && node._viewInfo.shadowNodeWrapper) {
      shadowNode = node._viewInfo.shadowNodeWrapper;
    }
    if (shadowNode) {
      resolveScreenOffset();
      g.nativeFabricUIManager.measureInWindow(
        shadowNode,
        function (x: number, y: number, w: number, h: number) {
          cb(x + screenOffsetX, y + screenOffsetY, w, h);
        }
      );
      return true;
    }
  }

  // Bridge
  if (rn && rn.UIManager && rn.findNodeHandle) {
    var handle = rn.findNodeHandle(node);
    if (handle) {
      rn.UIManager.measure(
        handle,
        function (_x: number, _y: number, w: number, h: number, pageX: number, pageY: number) {
          cb(pageX, pageY, w, h);
        }
      );
      return true;
    }
  }

  return false;
}

function _processMeasurements(measurements: PendingMeasurement[]): void {
  var remaining = measurements.length;
  if (remaining === 0) return;

  var newHighlights: HighlightData[] = [];
  var done = 0;

  function onAllRectsReady(
    name: string,
    rects: { x: number; y: number; w: number; h: number }[]
  ): void {
    if (rects.length === 0) {
      done++;
      if (done >= remaining) _commitHighlights(newHighlights);
      return;
    }

    // react-scan: 여러 host rect → 하나의 bounding box로 병합
    var minX = rects[0]!.x;
    var minY = rects[0]!.y;
    var maxX = rects[0]!.x + rects[0]!.w;
    var maxY = rects[0]!.y + rects[0]!.h;
    for (var i = 1; i < rects.length; i++) {
      var r = rects[i]!;
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
      // react-scan: 위치 기반 키로 merge (같은 위치면 같은 하이라이트)
      var posKey =
        Math.round(bx) + '-' + Math.round(by) + '-' + Math.round(bw) + '-' + Math.round(bh);

      // 1) 기존 활성 하이라이트에서 merge (react-scan: 같은 위치면 count만 증가, 페이드 재시작)
      // 한 번 탭에 ×2: 탭 → setState 등으로 인해 같은 컴포넌트가 두 번 리렌더(두 커밋) → 같은 posKey로 두 번 수집되어 merge 시 count++
      var merged = false;
      for (var j = 0; j < _activeHighlights.length; j++) {
        var existing = _activeHighlights[j]!;
        if (existing._posKey === posKey) {
          if (existing._fadeTimerId != null) {
            clearInterval(existing._fadeTimerId);
            existing._fadeTimerId = undefined;
          }
          existing.count++;
          existing.alpha = 1;
          existing.timestamp = Date.now();
          merged = true;
          _scheduleFade(existing);
          break;
        }
      }

      // 2) 같은 배치의 newHighlights에서도 merge
      if (!merged) {
        for (var k = 0; k < newHighlights.length; k++) {
          var nh = newHighlights[k]!;
          if (nh._posKey === posKey) {
            nh.count++;
            merged = true;
            break;
          }
        }
      }

      if (!merged) {
        newHighlights.push({
          x: bx,
          y: by,
          width: bw,
          height: bh,
          name: name,
          count: 1,
          alpha: 1,
          timestamp: Date.now(),
          _posKey: posKey,
        });
      }
    }

    done++;
    if (done >= remaining) _commitHighlights(newHighlights);
  }

  var g: any = typeof globalThis !== 'undefined' ? globalThis : global;
  var rn = typeof require !== 'undefined' && require('react-native');

  for (var i = 0; i < measurements.length; i++) {
    var m = measurements[i]!;
    var hostCount = m.hostFibers.length;
    var measuredRects: { x: number; y: number; w: number; h: number }[] = [];
    var hostDone = 0;

    (function (name: string, total: number) {
      for (var j = 0; j < m.hostFibers.length; j++) {
        var ok = _measureHostFiber(
          m.hostFibers[j]!,
          g,
          rn,
          function (x: number, y: number, w: number, h: number) {
            if (w > 0 && h > 0) measuredRects.push({ x: x, y: y, w: w, h: h });
            hostDone++;
            if (hostDone >= total) onAllRectsReady(name, measuredRects);
          }
        );
        if (!ok) {
          hostDone++;
          if (hostDone >= total) onAllRectsReady(name, measuredRects);
        }
      }
    })(m.name, hostCount);
  }
}

function _commitHighlights(newHighlights: HighlightData[]): void {
  for (var i = 0; i < newHighlights.length; i++) {
    _activeHighlights.push(newHighlights[i]!);
  }

  while (_activeHighlights.length > overlayMaxHighlights) {
    _activeHighlights.shift();
  }

  if (overlaySetHighlights) {
    overlaySetHighlights(_activeHighlights.slice());
  }

  // 새 하이라이트에 fade 시작
  for (var j = 0; j < newHighlights.length; j++) {
    _scheduleFade(newHighlights[j]!);
  }
}

function _scheduleFade(highlight: HighlightData): void {
  // 페이드: overlayFadeTimeout(기본 500ms) 동안 alpha 1→0, 45프레임 선형. react-scan native withTiming(0, { duration: 500 })과 동일.
  // 소멸 시점: frame >= TOTAL_FRAMES 일 때 _activeHighlights에서 제거 → "페이드 시작 후 정확히 fadeTimeout"에 소멸.
  var frame = 0;
  var frameInterval = overlayFadeTimeout / TOTAL_FRAMES;
  var interval = setInterval(function () {
    frame++;
    highlight.alpha = 1 - frame / TOTAL_FRAMES;
    if (frame >= TOTAL_FRAMES) {
      clearInterval(interval);
      highlight._fadeTimerId = undefined;
      var idx = _activeHighlights.indexOf(highlight);
      if (idx !== -1) {
        _activeHighlights.splice(idx, 1);
      }
      var tIdx = _fadeTimers.indexOf(interval);
      if (tIdx !== -1) _fadeTimers.splice(tIdx, 1);
    }
    if (overlaySetHighlights) {
      overlaySetHighlights(_activeHighlights.slice());
    }
  }, frameInterval);
  highlight._fadeTimerId = interval;
  _fadeTimers.push(interval);
}

// ─── C) React 컴포넌트 팩토리 (lazy) ─────────────────────────────

var _OverlayComponent: any = null;

export function getOverlayComponent(): any {
  if (_OverlayComponent) return _OverlayComponent;

  var React = require('react');
  var RN = require('react-native');

  function RenderOverlay() {
    var stateRef = React.useState([] as HighlightData[]);
    var highlights: HighlightData[] = stateRef[0];
    var setHighlights: (h: HighlightData[]) => void = stateRef[1];

    var activeRef = React.useRef(false);

    React.useEffect(function () {
      setOverlaySetHighlightsFn(function (h: HighlightData[]) {
        if (activeRef.current) {
          setHighlights(h);
        }
      });
      activeRef.current = true;
      if (renderHighlight) {
        startRenderHighlight();
      }
      return function () {
        activeRef.current = false;
        setOverlaySetHighlightsFn(null);
      };
    }, []);

    if (!overlayActive || highlights.length === 0) return null;

    // Android: measureInWindow는 콘텐츠(윈도우) 기준 좌표를 반환하는데, 오버레이 루트는 화면 전체(0,0=상태바 위)라
    // y에 상태바 높이(dp)를 더해 정렬. RN 이슈 #19497. 서버가 setTopInsetDp로 보낸 값 우선(tap/swipe와 동일).
    // overlayTopInsetConfirmed가 true면 서버 값만 사용 (0이어도 — window가 statusBar 포함인 경우).
    var topInsetDp = 0;
    if (RN.Platform.OS === 'android') {
      if (overlayTopInsetConfirmed) {
        topInsetDp = overlayTopInsetDp;
      } else if (RN.StatusBar && typeof (RN.StatusBar as any).currentHeight === 'number') {
        var ratio = RN.PixelRatio && RN.PixelRatio.get ? RN.PixelRatio.get() : 1;
        topInsetDp = (RN.StatusBar as any).currentHeight / ratio;
      }
    }
    var children = [];
    for (var i = 0; i < highlights.length; i++) {
      var h = highlights[i]!;
      var alpha = h.alpha > 0 ? h.alpha : 0;
      var drawY = h.y + topInsetDp;

      // react-scan 스타일: purple stroke + 10% fill (라벨은 별도 노드로 아래에서 추가)
      var rectStyle = {
        position: 'absolute' as const,
        left: h.x,
        top: drawY,
        width: h.width,
        height: h.height,
        borderWidth: 1,
        borderColor: 'rgba(' + PRIMARY_COLOR + ',' + alpha.toFixed(2) + ')',
        backgroundColor: 'rgba(' + PRIMARY_COLOR + ',' + (alpha * 0.1).toFixed(3) + ')',
      };
      children.push(React.createElement(RN.View, { key: 'rect-' + i, style: rectStyle }));

      // 라벨: rect와 형제로 오버레이 직접 자식 → 부모(rect) 너비에 잘리지 않고 텍스트 크기만큼만 표시
      var labelText = h.name;
      if (h.count > 1) labelText += ' ×' + h.count;
      // 말줄임표 없이 전체 표시 (길이 제한 제거)

      var showLabel = overlayShowLabels || h.count >= 2;
      if (showLabel) {
        var labelContainerStyle = {
          position: 'absolute' as const,
          left: h.x,
          top: drawY - 16,
          backgroundColor: 'rgba(' + PRIMARY_COLOR + ',' + alpha.toFixed(2) + ')',
          paddingHorizontal: 3,
          paddingVertical: 1,
          borderRadius: 2,
        };
        var labelTextStyle = {
          color: 'rgba(255,255,255,' + alpha.toFixed(2) + ')',
          fontSize: 10,
          fontFamily: 'Menlo',
          fontWeight: '600' as const,
        };
        children.push(
          React.createElement(
            RN.View,
            { key: 'label-' + i, style: labelContainerStyle },
            React.createElement(RN.Text, { style: labelTextStyle }, labelText)
          )
        );
      }
    }

    return React.createElement(
      RN.View,
      {
        style: {
          position: 'absolute' as const,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        },
        pointerEvents: 'none',
      },
      children
    );
  }

  RenderOverlay.displayName = 'RenderOverlay';

  _OverlayComponent = RenderOverlay;
  return _OverlayComponent;
}

// ─── D) MCP API ───────────────────────────────────────────────────

export function startRenderHighlight(options?: any): { started: boolean } {
  var opts = typeof options === 'object' && options !== null ? options : {};
  stopRenderHighlight();
  setOverlayActive(true);
  if (Array.isArray(opts.components) && opts.components.length > 0) {
    setOverlayComponentFilter(opts.components);
  }
  if (Array.isArray(opts.ignore) && opts.ignore.length > 0) {
    setOverlayIgnoreFilter(opts.ignore);
  }
  if (typeof opts.showLabels === 'boolean') {
    setOverlayShowLabels(opts.showLabels);
  }
  if (typeof opts.fadeTimeout === 'number' && opts.fadeTimeout > 0) {
    setOverlayFadeTimeout(opts.fadeTimeout);
  }
  if (typeof opts.maxHighlights === 'number' && opts.maxHighlights > 0) {
    setOverlayMaxHighlights(opts.maxHighlights);
  }
  return { started: true };
}

export function stopRenderHighlight(): { stopped: boolean } {
  for (var i = 0; i < _fadeTimers.length; i++) {
    clearInterval(_fadeTimers[i]);
  }
  _fadeTimers.length = 0;
  _activeHighlights.length = 0;
  _pendingMeasurements.length = 0;
  _flushScheduled = false;

  if (overlaySetHighlights) {
    overlaySetHighlights([]);
  }

  resetOverlay();
  return { stopped: true };
}
