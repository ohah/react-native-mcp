/**
 * 문서용 Component Tree 더미. 확장 사이드바의 Component Tree와 동일한 트리 구조를 보여주며,
 * 데이터만 더미. 스타일은 document/styles/global.css 의 .doc-component-tree-preview 참고.
 */

import React, { useState } from 'react';

interface TreeNode {
  type: string;
  text?: string;
  testID?: string;
  children?: TreeNode[];
}

const DUMMY_TREE: TreeNode[] = [
  {
    type: 'App',
    children: [
      {
        type: 'View',
        testID: 'screen',
        children: [
          {
            type: 'MyHeader',
            children: [
              { type: 'Text', text: 'My App' },
              { type: 'Pressable', children: [{ type: 'Text', text: 'Settings' }] },
            ],
          },
          {
            type: 'ScrollView',
            children: [
              {
                type: 'CartItem',
                children: [
                  { type: 'View', children: [{ type: 'Text', text: 'Product A' }] },
                  { type: 'Text', text: '$9.99' },
                ],
              },
              {
                type: 'CartItem',
                children: [
                  { type: 'View', children: [{ type: 'Text', text: 'Product B' }] },
                  { type: 'Text', text: '$14.99' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

/** 간단한 더미: 루트만 펼친 상태, defaultExpandedDepth까지 펼침으로 높이 관리 */
function DummyTree({
  nodes,
  defaultExpandedDepth = 1,
}: {
  nodes: TreeNode[];
  defaultExpandedDepth?: number;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ '0': true });

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderNode = (node: TreeNode, depth: number, path: string): React.ReactNode => {
    const hasChildren = !!(node.children && node.children.length > 0);
    const isExpanded = expanded[path] ?? depth < defaultExpandedDepth;
    const label = node.text
      ? `${node.type} "${node.text.length > 20 ? node.text.slice(0, 20) + '…' : node.text}"`
      : node.type;

    return (
      <div key={path} className="doc-tree-node">
        <div
          className="doc-tree-row"
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={hasChildren ? () => toggle(path) : undefined}
        >
          <span className="doc-tree-expand">{hasChildren ? (isExpanded ? '▾' : '▸') : ' '}</span>
          <span className="doc-tree-type">{label}</span>
          {node.testID && <span className="doc-tree-testid">#{node.testID}</span>}
        </div>
        {hasChildren &&
          isExpanded &&
          node.children!.map((child, i) => renderNode(child, depth + 1, `${path}-${i}`))}
      </div>
    );
  };

  return (
    <div className="doc-component-tree-preview">
      <div className="doc-tree-toolbar">
        <span className="doc-tree-title">Component Tree</span>
        <button type="button" className="doc-tree-refresh">
          Refresh
        </button>
      </div>
      <div className="doc-tree-list">{nodes.map((node, i) => renderNode(node, 0, String(i)))}</div>
    </div>
  );
}

export function ComponentTreePreview() {
  return <DummyTree nodes={DUMMY_TREE} defaultExpandedDepth={2} />;
}

export default ComponentTreePreview;
