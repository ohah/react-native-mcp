/**
 * 렌더 프로파일링 수집 로직.
 * onCommitFiberRoot에서 호출되어 fiber 트리를 순회하며
 * mount/update/bail-out을 판별하고 RenderEntry를 기록한다.
 */

import type { Fiber, RenderEntry } from './types';
import { getFiberTypeName } from './fiber-helpers';
import { shallowEqual, safeClone } from './state-hooks';
import {
  renderProfileActive,
  renderComponentFilter,
  renderIgnoreFilter,
  renderCommitCount,
  pushRenderEntry,
} from './shared';

/** RN 내부 컴포넌트 — 기본 무시 대상 (접두사 매칭) */
var DEFAULT_IGNORED_PREFIXES = [
  'LogBox', // LogBoxNotification, LogBoxButton, LogBoxMessage …
  'Pressability', // PressabilityDebugView
  'YellowBox', // legacy (RN < 0.63)
  'RCT', // RCTView 등 native bridge wrapper
  'Debugging', // DebuggingOverlay
  'AppContainer', // RN root wrapper
  'TextAncestor', // RN Text context provider
  'VirtualizedList', // internal list component
  'CellRenderer', // FlatList internal
];

/** RN 빌트인 컴포넌트 — 무시하지 않고, 가장 가까운 사용자 컴포넌트 이름을 붙여서 구분 */
var BUILTIN_COMPONENTS = [
  'Text',
  'View',
  'Image',
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
  'ScrollView',
  'FlatList',
  'SectionList',
  'TextInput',
  'ActivityIndicator',
  'Switch',
  'SafeAreaView',
  'KeyboardAvoidingView',
  'StatusBar',
  'Modal',
  'RefreshControl',
];

/** 접두사 목록에 해당하는 이름인지 (_접두사 변형 포함) */
function matchesPrefixList(name: string, prefixes: string[]): boolean {
  var target = name;
  // _LogBoxNotificationContainer → LogBoxNotificationContainer
  if (target.length > 1 && target.charAt(0) === '_') target = target.substring(1);
  for (var i = 0; i < prefixes.length; i++) {
    if (target.indexOf(prefixes[i]!) === 0) return true;
  }
  return false;
}

/** 컴포넌트 필터링: whitelist > blacklist > default ignore 순으로 판별 */
function shouldSkipComponent(name: string): boolean {
  // whitelist가 있으면 whitelist에 없는 것만 스킵
  if (renderComponentFilter !== null) {
    return renderComponentFilter.indexOf(name) === -1;
  }
  // 사용자 blacklist 체크
  if (renderIgnoreFilter !== null && renderIgnoreFilter.indexOf(name) !== -1) {
    return true;
  }
  // 기본 ignore 접두사 체크 (RN 내부 전용 — 빌트인은 무시하지 않고 부모로 구분)
  return matchesPrefixList(name, DEFAULT_IGNORED_PREFIXES);
}

/** 빌트인 컴포넌트인지 판별 */
function isBuiltinComponent(name: string): boolean {
  return BUILTIN_COMPONENTS.indexOf(name) !== -1;
}

/** fiber.return을 올라가며 빌트인이 아닌 첫 사용자 컴포넌트 이름 */
function getNearestUserParent(fiber: Fiber): string {
  var p = fiber.return;
  while (p) {
    if (p.tag === 0 || p.tag === 1) {
      var pName = getFiberTypeName(p);
      if (!isBuiltinComponent(pName) && !matchesPrefixList(pName, DEFAULT_IGNORED_PREFIXES)) {
        return pName;
      }
    }
    p = p.return;
  }
  return 'Root';
}

/** fiber.return을 올라가며 첫 FunctionComponent/ClassComponent 이름 */
function getParentComponentName(fiber: Fiber): string {
  var p = fiber.return;
  while (p) {
    if (p.tag === 0 || p.tag === 1) return getFiberTypeName(p);
    p = p.return;
  }
  return 'Root';
}

/** fiber가 React.memo로 감싸져 있는지 (MemoComponent=14, SimpleMemoComponent=15) */
function isMemoWrapped(fiber: Fiber): boolean {
  var parent = fiber.return;
  return parent != null && (parent.tag === 14 || parent.tag === 15);
}

/** child를 탐색하여 첫 HostComponent(tag=5)의 type 이름 반환 (View, Text, Pressable 등) */
function getFirstHostType(fiber: Fiber): string | undefined {
  var child = fiber.child;
  // 최대 깊이 5까지만 탐색 (성능)
  return _findHostType(child, 5);
}

function _findHostType(fiber: Fiber | null, depth: number): string | undefined {
  if (!fiber || depth <= 0) return undefined;
  if (fiber.tag === 5 && typeof fiber.type === 'string') return fiber.type;
  var found = _findHostType(fiber.child, depth - 1);
  if (found) return found;
  return _findHostType(fiber.sibling, depth - 1);
}

/** props에서 변경된 key들 추출 */
function diffProps(
  prevProps: Record<string, any> | null,
  nextProps: Record<string, any> | null
): { key: string; prev: any; next: any }[] | undefined {
  if (!prevProps || !nextProps) return undefined;
  var changes: { key: string; prev: any; next: any }[] = [];
  var keys = Object.keys(nextProps);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]!;
    if (key === 'children') continue;
    if (prevProps[key] !== nextProps[key]) {
      changes.push({
        key: key,
        prev: safeClone(prevProps[key], 3),
        next: safeClone(nextProps[key], 3),
      });
    }
  }
  // prev에만 있는 key
  var prevKeys = Object.keys(prevProps);
  for (var j = 0; j < prevKeys.length; j++) {
    var pk = prevKeys[j]!;
    if (pk === 'children') continue;
    if (!(pk in nextProps)) {
      changes.push({ key: pk, prev: safeClone(prevProps[pk], 3), next: undefined as any });
    }
  }
  return changes.length > 0 ? changes : undefined;
}

/** state hooks에서 변경된 것들 추출 */
function diffStateHooks(
  prevFiber: Fiber,
  nextFiber: Fiber
): { hookIndex: number; prev: any; next: any }[] | undefined {
  var changes: { hookIndex: number; prev: any; next: any }[] = [];
  var prevHook = prevFiber.memoizedState;
  var nextHook = nextFiber.memoizedState;
  var idx = 0;
  while (prevHook && nextHook && typeof prevHook === 'object' && typeof nextHook === 'object') {
    if (nextHook.queue && !shallowEqual(prevHook.memoizedState, nextHook.memoizedState)) {
      changes.push({
        hookIndex: idx,
        prev: safeClone(prevHook.memoizedState, 3),
        next: safeClone(nextHook.memoizedState, 3),
      });
    }
    prevHook = prevHook.next;
    nextHook = nextHook.next;
    idx++;
  }
  return changes.length > 0 ? changes : undefined;
}

/** context dependencies에서 변경된 것 추출 */
function diffContext(fiber: Fiber): { name: string; prev: any; next: any }[] | undefined {
  var alt = fiber.alternate;
  if (!alt) return undefined;
  var deps = (fiber as any).dependencies;
  if (!deps || !deps.firstContext) return undefined;
  var changes: { name: string; prev: any; next: any }[] = [];
  var ctx = deps.firstContext;
  // alternate의 dependencies
  var altDeps = (alt as any).dependencies;
  var altCtx = altDeps ? altDeps.firstContext : null;
  while (ctx) {
    var ctxName = 'Context';
    if (ctx.context) {
      var c = ctx.context;
      if (c.displayName) ctxName = c.displayName;
      else if (c._context && c._context.displayName) ctxName = c._context.displayName;
      else if (c.Provider && c.Provider._context && c.Provider._context.displayName)
        ctxName = c.Provider._context.displayName;
    }
    // compare memoizedValue between alt and current
    if (altCtx && ctx.memoizedValue !== altCtx.memoizedValue) {
      changes.push({
        name: ctxName,
        prev: safeClone(altCtx.memoizedValue, 3),
        next: safeClone(ctx.memoizedValue, 3),
      });
    }
    ctx = ctx.next;
    if (altCtx) altCtx = altCtx.next;
  }
  return changes.length > 0 ? changes : undefined;
}

/**
 * fiber 트리를 순회하며 RenderEntry를 수집.
 * onCommitFiberRoot에서 호출. commitId는 현재 renderCommitCount.
 */
export function collectRenderEntries(fiber: Fiber | null): void {
  if (!fiber || !renderProfileActive) return;

  if (fiber.tag === 0 || fiber.tag === 1) {
    var name = getFiberTypeName(fiber);

    if (shouldSkipComponent(name)) {
      collectRenderEntries(fiber.child);
      collectRenderEntries(fiber.sibling);
      return;
    }

    // 빌트인 컴포넌트는 가장 가까운 사용자 컴포넌트로 구분: "MyHeader > Text"
    var isBuiltin = isBuiltinComponent(name);
    var componentKey = isBuiltin ? getNearestUserParent(fiber) + ' > ' + name : name;

    var alt = fiber.alternate;
    var parentName = getParentComponentName(fiber);

    // nativeType은 커스텀 컴포넌트에만 (빌트인은 자기 자신이 네이티브 타입이라 중복)
    var hostType = isBuiltin ? undefined : getFirstHostType(fiber);

    if (alt === null) {
      // Mount
      var entry: RenderEntry = {
        component: componentKey,
        type: 'mount',
        trigger: 'parent',
        timestamp: Date.now(),
        commitId: renderCommitCount,
        parent: parentName,
        isMemoized: isMemoWrapped(fiber),
      };
      if (hostType) entry.nativeType = hostType;
      pushRenderEntry(entry);
    } else {
      // bail-out 체크: PerformedWork flag (=1) 로 실제 렌더 여부 판별.
      // flags (React 17+) 또는 effectTag (React 16) 확인.
      var flags = (fiber as any).flags;
      if (flags === undefined) flags = (fiber as any).effectTag;
      if (typeof flags === 'number' && (flags & 1) === 0) {
        // PerformedWork 없음 — bail-out, 무시
      } else {
        // Re-render — trigger 판정
        var stateChanges = diffStateHooks(alt, fiber);
        var propChanges = diffProps(alt.memoizedProps, fiber.memoizedProps);
        var contextChanges = diffContext(fiber);

        var trigger: 'state' | 'props' | 'context' | 'parent';
        if (stateChanges) {
          trigger = 'state';
        } else if (propChanges) {
          trigger = 'props';
        } else if (contextChanges) {
          trigger = 'context';
        } else {
          trigger = 'parent';
        }

        var changes: RenderEntry['changes'] = {};
        if (stateChanges) changes.state = stateChanges;
        if (propChanges) changes.props = propChanges;
        if (contextChanges) changes.context = contextChanges;
        var hasChanges = stateChanges || propChanges || contextChanges;

        var updateEntry: RenderEntry = {
          component: componentKey,
          type: 'update',
          trigger: trigger,
          timestamp: Date.now(),
          commitId: renderCommitCount,
          parent: parentName,
          isMemoized: isMemoWrapped(fiber),
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
