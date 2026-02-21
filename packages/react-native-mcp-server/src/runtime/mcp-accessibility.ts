import type { Fiber } from './types';
import {
  getFiberRoot,
  getRNComponents,
  getFiberTypeName,
  collectText,
  collectAccessibilityLabel,
} from './fiber-helpers';
import { measureViewSync } from './mcp-measure';
import { getPathUid } from './query-selector';

/**
 * 접근성(a11y) 자동 감사. Fiber 트리 순회 후 규칙 위반 목록 반환.
 * 반환: [{ rule, selector, severity, message }]
 */
export function getAccessibilityAudit(options?: any): any[] {
  try {
    var root = getFiberRoot();
    if (!root) return [];
    var c = getRNComponents();
    var TextComp = c && c.Text;
    var ImageComp = c && c.Image;
    var maxDepth = options && typeof options.maxDepth === 'number' ? options.maxDepth : 999;
    var minTouchTarget = 44;
    var violations: any[] = [];

    function selectorFor(
      _fiber: Fiber,
      typeName: string,
      testID: string | undefined,
      pathUid: string
    ) {
      if (testID) return '#' + testID;
      return typeName + (pathUid ? '@' + pathUid : '');
    }

    function visit(fiber: Fiber | null, path: string, depth: number) {
      if (!fiber || depth > maxDepth) return;
      var props = fiber.memoizedProps || {};
      var typeName = getFiberTypeName(fiber);
      var testID =
        typeof props.testID === 'string' && props.testID.trim() ? props.testID.trim() : undefined;
      var pathUid = getPathUid(fiber);
      var hasOnPress = typeof props.onPress === 'function';
      var hasOnLongPress = typeof props.onLongPress === 'function';
      var accessibilityLabel =
        typeof props.accessibilityLabel === 'string' && props.accessibilityLabel.trim()
          ? props.accessibilityLabel.trim()
          : '';
      var accessibilityRole =
        typeof props.accessibilityRole === 'string' && props.accessibilityRole.trim()
          ? props.accessibilityRole.trim()
          : '';

      // pressable-needs-label: onPress 있는데 accessibilityLabel 또는 접근 가능한 텍스트 없음
      if (hasOnPress || hasOnLongPress) {
        var hasAccessibleText =
          accessibilityLabel ||
          collectText(fiber, TextComp).replace(/\s+/g, ' ').trim() ||
          collectAccessibilityLabel(fiber, ImageComp);
        if (!hasAccessibleText) {
          violations.push({
            rule: 'pressable-needs-label',
            selector: selectorFor(fiber, typeName, testID, pathUid),
            severity: 'error',
            message:
              typeName +
              '에 onPress/onLongPress가 있으나 accessibilityLabel 또는 접근 가능한 텍스트가 없습니다.',
          });
        }
        // missing-role: 인터랙티브 요소에 accessibilityRole 없음
        if (!accessibilityRole) {
          violations.push({
            rule: 'missing-role',
            selector: selectorFor(fiber, typeName, testID, pathUid),
            severity: 'warning',
            message: '인터랙티브 요소에 accessibilityRole이 없습니다.',
          });
        }
      }

      // image-needs-alt: Image에 accessibilityLabel 없음
      if (fiber.type === ImageComp) {
        if (!accessibilityLabel) {
          violations.push({
            rule: 'image-needs-alt',
            selector: selectorFor(fiber, typeName, testID, pathUid),
            severity: 'error',
            message: 'Image에 accessibilityLabel(또는 alt)이 없습니다.',
          });
        }
      }

      var child = fiber.child;
      var idx = 0;
      while (child) {
        visit(child, path + '.' + idx, depth + 1);
        child = child.sibling;
        idx += 1;
      }
    }

    visit(root, '0', 0);

    // touch-target-size: onPress/onLongPress 있는 노드 중 measure로 44x44pt 미만인 것
    var touchables: Array<{
      fiber: Fiber;
      typeName: string;
      testID: string | undefined;
      pathUid: string;
    }> = [];
    (function collectTouchables(fiber: Fiber | null, path: string, depth: number) {
      if (!fiber || depth > maxDepth) return;
      var props = fiber.memoizedProps || {};
      var hasOnPress = typeof props.onPress === 'function';
      var hasOnLongPress = typeof props.onLongPress === 'function';
      if (hasOnPress || hasOnLongPress) {
        var testID =
          typeof props.testID === 'string' && props.testID.trim() ? props.testID.trim() : undefined;
        touchables.push({
          fiber: fiber,
          typeName: getFiberTypeName(fiber),
          testID: testID,
          pathUid: getPathUid(fiber),
        });
      }
      var child = fiber.child;
      var idx = 0;
      while (child) {
        collectTouchables(child, path + '.' + idx, depth + 1);
        child = child.sibling;
        idx += 1;
      }
    })(root, '0', 0);

    for (var i = 0; i < touchables.length; i++) {
      var t = touchables[i];
      if (t === undefined) continue;
      var item = t;
      var uid = item.testID || item.pathUid;
      var measure: any = null;
      try {
        measure = (globalThis as any).__REACT_NATIVE_MCP__.measureViewSync(uid);
      } catch {}
      if (!measure && typeof item.fiber.type !== 'string') {
        var hostChild = (function findHost(f: Fiber | null): Fiber | null {
          if (!f) return null;
          if (typeof f.type === 'string' && f.stateNode) return f;
          var ch = f.child;
          while (ch) {
            var h = findHost(ch);
            if (h) return h;
            ch = ch.sibling;
          }
          return null;
        })(item.fiber.child);
        if (hostChild) {
          var hostUid =
            (hostChild.memoizedProps && hostChild.memoizedProps.testID) || getPathUid(hostChild);
          try {
            measure = measureViewSync(hostUid);
          } catch {}
        }
      }
      if (measure && (measure.width < minTouchTarget || measure.height < minTouchTarget)) {
        violations.push({
          rule: 'touch-target-size',
          selector: item.testID ? '#' + item.testID : item.typeName + '@' + item.pathUid,
          severity: 'warning',
          message:
            '터치 영역이 ' +
            minTouchTarget +
            'x' +
            minTouchTarget +
            'pt 미만입니다 (' +
            Math.round(measure.width) +
            'x' +
            Math.round(measure.height) +
            'pt)',
        });
      }
    }

    return violations;
  } catch {
    return [];
  }
}
