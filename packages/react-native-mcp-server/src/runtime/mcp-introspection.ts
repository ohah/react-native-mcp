import type { Fiber } from './types';
import {
  getFiberRoot,
  getRNComponents,
  collectText,
  getLabel,
  getAncestorTestID,
  getTextNodeContent,
  getFiberTypeName,
} from './fiber-helpers';
import { getFiberByPath, isPathUid } from './query-selector';
import { pressHandlers } from './shared';

/**
 * _debugStack.stack 문자열에서 모든 (url:line:column) 프레임 추출.
 * 예: " at fn (http://...:25822:77)\n at App (http://...:7284:69)" → [{ bundleUrl, line, column }, ...]
 * 첫 프레임이 React 내부인 경우가 많으므로 서버에서 순서대로 심볼리케이트해 앱 소스 프레임을 고름.
 */
export function getSourceRefFromStack(
  stack: string
): Array<{ bundleUrl: string; line: number; column: number }> {
  if (typeof stack !== 'string' || !stack) return [];
  var out: Array<{ bundleUrl: string; line: number; column: number }> = [];
  var re = /\(([^)]+):(\d+):(\d+)\)/g;
  var m: RegExpExecArray | null;
  while ((m = re.exec(stack)) !== null) {
    var url = m[1];
    var lineStr = m[2];
    var colStr = m[3];
    // == null 은 null·undefined 둘 다 걸러냄 (null == undefined)
    if (url == null || lineStr == null || colStr == null) continue;
    var line = parseInt(lineStr, 10);
    var column = parseInt(colStr, 10);
    if (!isNaN(line)) out.push({ bundleUrl: url, line, column });
  }
  return out;
}

/**
 * uid(경로 "0.1.2" 또는 testID)로 Fiber 찾기.
 */
function findFiberByUid(root: Fiber | null, uid: string): Fiber | null {
  if (!root || typeof uid !== 'string') return null;
  var u = uid.trim();
  if (isPathUid(u)) return getFiberByPath(root, u);
  var found: Fiber | null = null;
  (function visit(f: Fiber | null) {
    if (!f || found) return;
    var props = f.memoizedProps;
    if (props && typeof props.testID === 'string' && props.testID.trim() === u) {
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
export function getSourceRefForUid(
  uid: string
): Array<{ bundleUrl: string; line: number; column: number }> {
  try {
    var root = getFiberRoot();
    if (!root) return [];
    var fiber = findFiberByUid(root, uid);
    var debugStack = fiber && (fiber as any)._debugStack;
    if (!debugStack || typeof debugStack.stack !== 'string') return [];
    return getSourceRefFromStack(debugStack.stack);
  } catch (e) {
    return [];
  }
}

/**
 * 클릭 가능 요소 목록 (uid + label). Fiber 트리에서 onPress 있는 모든 노드 수집.
 * _pressHandlers 레지스트리가 있으면 우선 사용, 없으면 Fiber 순회.
 */
export function getClickables(): Array<{ uid: string; label: string }> {
  var ids = Object.keys(pressHandlers);
  // 레지스트리에 항목이 있으면 기존 방식 (INJECT_PRESS_HANDLER=true 시)
  if (ids.length > 0) {
    var root0 = getFiberRoot();
    var c0 = root0 ? getRNComponents() : null;
    return ids.map(function (id) {
      var label = '';
      if (root0 && c0) {
        (function visit(fiber: Fiber | null) {
          if (!fiber || label) return;
          if (fiber.memoizedProps && fiber.memoizedProps.testID === id) {
            label = collectText(fiber, c0!.Text).replace(/\s+/g, ' ').trim();
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
    var out: Array<{ uid: string; label: string }> = [];
    function visit(fiber: Fiber | null) {
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
}

/**
 * Fiber 트리 전체에서 Text 노드 내용 수집. 버튼 여부와 무관하게 모든 보이는 텍스트.
 * 반환: [{ text, testID? }] — testID는 해당 Text의 조상 중 가장 가까운 testID.
 */
export function getTextNodes(): Array<{ text: string; testID?: string }> {
  try {
    var root = getFiberRoot();
    if (!root) return [];
    var c = getRNComponents();
    var TextComponent = c && c.Text;
    if (!TextComponent) return [];
    var out: Array<{ text: string; testID?: string }> = [];
    function visit(fiber: Fiber | null) {
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
}

/** 내부용 컴포넌트 — 트리/상태 변경에서 숨김 (접두사 매칭) */
const HIDDEN_COMPONENT_PREFIXES = ['RenderOverlay', 'MCPRoot', 'LogBox'];

/** 컴포넌트 이름이 숨김 대상인지 판별 (_접두사 변형 포함) */
export function isHiddenComponent(name: string): boolean {
  var target = name;
  if (target.length > 1 && target.charAt(0) === '_') target = target.substring(1);
  for (var i = 0; i < HIDDEN_COMPONENT_PREFIXES.length; i++) {
    if (target.indexOf(HIDDEN_COMPONENT_PREFIXES[i]!) === 0) return true;
  }
  return false;
}

/**
 * Fiber 트리 전체를 컴포넌트 트리로 직렬화. querySelector 대체용 스냅샷.
 * 노드: { uid, type, testID?, accessibilityLabel?, text?, children? }
 * uid: testID 있으면 testID, 없으면 경로 "0.1.2". click(uid)는 testID일 때만 동작.
 * options: { maxDepth } (기본 무제한, 권장 20~30)
 */
export function getComponentTree(options: any): any {
  try {
    var root = getFiberRoot();
    if (!root) return null;
    var c = getRNComponents();
    var TextComponent = c && c.Text;
    var maxDepth = options && typeof options.maxDepth === 'number' ? options.maxDepth : 999;
    function buildNode(fiber: Fiber, path: string, depth: number): any | any[] {
      if (!fiber || depth > maxDepth) return null;
      var props = fiber.memoizedProps || {};
      var testID =
        typeof props.testID === 'string' && props.testID.trim() ? props.testID.trim() : undefined;
      var typeName = getFiberTypeName(fiber);
      var displayName =
        typeof fiber.type === 'object' &&
        fiber.type != null &&
        typeof (fiber.type as any).displayName === 'string'
          ? (fiber.type as any).displayName
          : '';
      var isHidden = isHiddenComponent(typeName) || isHiddenComponent(displayName);
      if (isHidden) {
        var out: any[] = [];
        var child = fiber.child;
        var idx = 0;
        while (child) {
          var childPath = path + '.' + idx;
          var childResult = buildNode(child, childPath, depth + 1);
          if (Array.isArray(childResult)) out.push(...childResult);
          else if (childResult) out.push(childResult);
          child = child.sibling;
          idx += 1;
        }
        return out.length ? out : null;
      }
      var uid = testID || path;
      var node: any = {
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
      var children: any[] = [];
      var child = fiber.child;
      var idx = 0;
      while (child) {
        var childPath = path + '.' + idx;
        var childResult = buildNode(child, childPath, depth + 1);
        if (Array.isArray(childResult)) children.push(...childResult);
        else if (childResult) children.push(childResult);
        child = child.sibling;
        idx += 1;
      }
      if (children.length) node.children = children;
      return node;
    }
    var result = buildNode(root, '0', 0);
    return Array.isArray(result)
      ? result.length === 1
        ? result[0]
        : { uid: '0', type: 'Root', children: result }
      : result;
  } catch (e) {
    return null;
  }
}
