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
import { pressHandlers } from './shared';

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
    function buildNode(fiber: Fiber, path: string, depth: number): any {
      if (!fiber || depth > maxDepth) return null;
      var props = fiber.memoizedProps || {};
      var testID =
        typeof props.testID === 'string' && props.testID.trim() ? props.testID.trim() : undefined;
      var typeName = getFiberTypeName(fiber);
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
}
