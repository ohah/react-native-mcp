/**
 * Snapshot 트리에 @e1, @e2, ... refs 할당.
 * depth-first 순회로 순번 부여.
 */

import type { RefInfo } from './session.js';
import { INTERACTIVE_TYPES } from '../shared/interactive-types.js';

interface SnapshotNode {
  uid?: string;
  type?: string;
  testID?: string;
  text?: string;
  children?: SnapshotNode[];
}

export interface AssignResult {
  refs: Record<string, RefInfo>;
  lines: string[];
}

/**
 * Fiber 트리를 순회하며 각 요소에 @e1, @e2, ... 할당.
 * interactive=true이면 인터랙티브 요소만 포함.
 */
export function assignRefs(root: SnapshotNode, interactive: boolean): AssignResult {
  const refs: Record<string, RefInfo> = {};
  const lines: string[] = [];
  let counter = 1;

  function walk(node: SnapshotNode, depth: number): void {
    const type = node.type ?? '';
    const uid = node.uid ?? '';
    const testID = node.testID ?? '';
    const text = node.text ?? '';
    const isInteractive = INTERACTIVE_TYPES.has(type);

    // interactive 모드: 인터랙티브가 아닌 노드는 자식만 순회
    if (interactive && !isInteractive && depth > 0) {
      for (const child of node.children ?? []) {
        walk(child, depth);
      }
      return;
    }

    // 의미 없는 노드 스킵 (타입만 있고 testID/text 없는 비인터랙티브 노드)
    const hasMeaningfulInfo = testID || text || isInteractive || depth === 0;
    if (!hasMeaningfulInfo && depth > 0) {
      for (const child of node.children ?? []) {
        walk(child, depth + 1);
      }
      return;
    }

    const ref = `@e${counter++}`;
    refs[ref] = {
      uid,
      type,
      ...(testID ? { testID } : {}),
      ...(text ? { text } : {}),
    };

    const indent = '  '.repeat(depth);
    const parts: string[] = [type];
    if (testID) parts.push(`#${testID}`);
    if (text) parts.push(`"${text}"`);
    lines.push(`${ref.padEnd(6)} ${indent}${parts.join(' ')}`);

    for (const child of node.children ?? []) {
      walk(child, depth + 1);
    }
  }

  walk(root, 0);
  return { refs, lines };
}
