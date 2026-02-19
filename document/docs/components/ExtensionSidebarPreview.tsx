/**
 * 문서용: 실제 확장 사이드바처럼 DevTools / Component Tree를 세로로 쌓고
 * 아코디언(펼침/접힘)으로 표시.
 */

import React, { useState } from 'react';
import DevToolsPreview from './DevToolsPreview';
import ComponentTreePreview from './ComponentTreePreview';

const PANELS = [
  { id: 'devtools' as const, title: 'DevTools' },
  { id: 'tree' as const, title: 'Component Tree' },
] as const;

export function ExtensionSidebarPreview() {
  const [open, setOpen] = useState<Record<string, boolean>>({ devtools: true, tree: true });

  const toggle = (id: string) => {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="doc-sidebar-preview">
      {PANELS.map(({ id, title }) => {
        const isOpen = open[id] ?? true;
        return (
          <div key={id} className="doc-sidebar-panel">
            <button
              type="button"
              className="doc-sidebar-panel-header"
              onClick={() => toggle(id)}
              aria-expanded={isOpen}
            >
              <span className="doc-sidebar-panel-expand">{isOpen ? '▾' : '▸'}</span>
              <span className="doc-sidebar-panel-title">{title}</span>
            </button>
            {isOpen && (
              <div className="doc-sidebar-panel-body">
                {id === 'devtools' && <DevToolsPreview />}
                {id === 'tree' && <ComponentTreePreview />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ExtensionSidebarPreview;
