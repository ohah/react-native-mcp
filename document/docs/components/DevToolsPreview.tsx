/**
 * 문서용 더미 UI. 확장 웹뷰(App + Console/Network/State/RenderPanel)와 동일한 구조·클래스명 사용,
 * 데이터만 더미. 스타일은 document/styles/global.css 의 .doc-devtools-preview 스코프 참고.
 */

import React, { useState } from 'react';

const TABS = ['Console', 'Network', 'State', 'Renders'] as const;
const LEVELS = ['all', 'log', 'info', 'warn', 'error'] as const;

const LEVEL_NAMES: Record<number, string> = { 0: 'log', 1: 'info', 2: 'warn', 3: 'error' };

const DUMMY_LOGS = [
  { id: 1, level: 0, message: 'Hello from app', timestamp: Date.now() - 5000 },
  { id: 2, level: 1, message: 'MCP connected', timestamp: Date.now() - 3000 },
  { id: 3, level: 2, message: 'Deprecation notice', timestamp: Date.now() - 1000 },
];

const DUMMY_NETWORK = [
  {
    id: 1,
    method: 'GET',
    url: 'https://api.example.com/users',
    status: 200,
    duration: 42,
    mocked: false,
  },
  {
    id: 2,
    method: 'POST',
    url: 'https://api.example.com/login',
    status: 201,
    duration: 128,
    mocked: false,
  },
  {
    id: 3,
    method: 'GET',
    url: 'https://api.example.com/config',
    status: 404,
    duration: 12,
    mocked: false,
  },
  {
    id: 4,
    method: 'GET',
    url: 'https://api.example.com/feature',
    status: 200,
    duration: 8,
    mocked: true,
  },
];

const DUMMY_STATE_GROUPS = [
  {
    name: 'Counter',
    count: 2,
    entries: [
      { id: 1, timestamp: Date.now() - 2000, hookIndex: 0, prev: 0, next: 1 },
      { id: 2, timestamp: Date.now() - 500, hookIndex: 0, prev: 1, next: 2 },
    ],
  },
  {
    name: 'Auth',
    count: 1,
    entries: [
      {
        id: 3,
        timestamp: Date.now() - 4000,
        hookIndex: 0,
        prev: null,
        next: { name: 'Jane', id: 1 },
      },
    ],
  },
];

/** Timeline 뷰용 플랫 리스트 (시간순, component 포함) */
const DUMMY_STATE_ENTRIES = [
  {
    id: 3,
    timestamp: Date.now() - 4000,
    component: 'Auth',
    hookIndex: 0,
    prev: null,
    next: { name: 'Jane', id: 1 },
  },
  { id: 1, timestamp: Date.now() - 2000, component: 'Counter', hookIndex: 0, prev: 0, next: 1 },
  { id: 2, timestamp: Date.now() - 500, component: 'Counter', hookIndex: 0, prev: 1, next: 2 },
];

const DUMMY_HOT_COMPONENTS = [
  {
    name: 'CartItem',
    nativeType: 'View',
    renders: 5,
    mounts: 1,
    unnecessaryRenders: 2,
    isMemoized: false,
    triggers: 'state(3), parent(2)',
  },
  {
    name: 'MyHeader',
    nativeType: 'View',
    renders: 3,
    mounts: 1,
    unnecessaryRenders: 0,
    isMemoized: true,
    triggers: 'props(2), parent(1)',
  },
  {
    name: 'ProductList',
    nativeType: 'ScrollView',
    renders: 8,
    mounts: 1,
    unnecessaryRenders: 4,
    isMemoized: false,
    triggers: 'state(4), parent(4)',
  },
];

function formatTime(ts: number): string {
  const d = new Date(ts);
  return (
    d.toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) +
    '.' +
    String(d.getMilliseconds()).padStart(3, '0')
  );
}

function getStatusColor(status: number): string {
  if (status >= 400) return '#f44747';
  if (status >= 300) return '#e9a700';
  return '#3c3';
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search || url;
  } catch {
    return url;
  }
}

const TRIGGER_COLORS: Record<string, string> = {
  state: '#4ec9b0',
  props: '#dcdcaa',
  context: '#c586c0',
  parent: '#808080',
};

export function DevToolsPreview() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Console');
  const [level, setLevel] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedNetId, setSelectedNetId] = useState<number | null>(DUMMY_NETWORK[0]!.id);
  const [netDetailTab, setNetDetailTab] = useState<'headers' | 'request' | 'response'>('headers');
  const [stateViewMode, setStateViewMode] = useState<'timeline' | 'grouped'>('grouped');
  const [expandedStateGroup, setExpandedStateGroup] = useState<string>('Counter');
  const [expandedStateId, setExpandedStateId] = useState<number | null>(1);
  const [selectedRenderIdx, setSelectedRenderIdx] = useState<number | null>(0);

  const filteredLogs =
    level === 'all' ? DUMMY_LOGS : DUMMY_LOGS.filter((e) => LEVEL_NAMES[e.level] === level);
  const listLogs = search
    ? filteredLogs.filter((e) => e.message.toLowerCase().includes(search.toLowerCase()))
    : filteredLogs;

  const selectedNet = DUMMY_NETWORK.find((r) => r.id === selectedNetId);
  const selectedComp =
    selectedRenderIdx !== null ? (DUMMY_HOT_COMPONENTS[selectedRenderIdx] ?? null) : null;

  return (
    <div className="doc-devtools-preview">
      <div className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={tab === t ? 'active' : ''}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
        <div
          style={{ marginLeft: 'auto', padding: '6px 8px', display: 'flex', alignItems: 'center' }}
        >
          <span style={{ fontSize: 11, opacity: 0.7 }}>ios:iPhone 16</span>
        </div>
      </div>
      <div className="panel-content">
        {/* Console */}
        {tab === 'Console' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="toolbar">
              <div className="filter-bar">
                {(LEVELS as unknown as string[]).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={`filter-chip ${level === opt ? 'active' : ''}`}
                    onClick={() => setLevel(opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Filter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Filter logs"
              />
              <button type="button">Clear</button>
              <button type="button">Pause</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {listLogs.map((entry) => (
                <div
                  key={entry.id}
                  className={`log-entry level-${LEVEL_NAMES[entry.level] ?? 'log'}`}
                >
                  <span className="log-level">[{LEVEL_NAMES[entry.level] ?? 'log'}]</span>
                  {entry.message}
                  <span className="log-ts">
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Network */}
        {tab === 'Network' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="toolbar">
              <input type="text" placeholder="Filter URL..." style={{ maxWidth: 200 }} readOnly />
              <select>
                <option>All methods</option>
              </select>
              <button type="button">Clear</button>
              <button type="button">Pause</button>
              <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.5 }}>
                {DUMMY_NETWORK.length} requests
              </span>
            </div>
            <div className="net-split">
              <div className="net-list">
                <div className="network-row network-header">
                  <span className="net-col-status">Status</span>
                  <span className="net-col-method">Method</span>
                  <span className="net-col-url">URL</span>
                  <span className="net-col-duration">Time</span>
                </div>
                {DUMMY_NETWORK.map((entry) => (
                  <div
                    key={entry.id}
                    className={`network-row ${selectedNetId === entry.id ? 'selected' : ''} ${entry.mocked ? 'mocked' : ''}`}
                    onClick={() => setSelectedNetId(selectedNetId === entry.id ? null : entry.id)}
                  >
                    <span className="net-col-status">
                      <span
                        className="status-badge"
                        style={{ color: getStatusColor(entry.status) }}
                      >
                        {entry.status}
                      </span>
                    </span>
                    <span className="net-col-method">{entry.method}</span>
                    <span className="net-col-url" title={entry.url}>
                      {shortenUrl(entry.url)}
                      {entry.mocked && <span className="mock-badge">mock</span>}
                    </span>
                    <span className="net-col-duration">{entry.duration}ms</span>
                  </div>
                ))}
              </div>
              {selectedNet && (
                <>
                  <div className="net-resize-handle" />
                  <div className="net-detail" style={{ height: 140 }}>
                    <div className="net-detail-tabs">
                      <button
                        type="button"
                        className={netDetailTab === 'headers' ? 'active' : ''}
                        onClick={() => setNetDetailTab('headers')}
                      >
                        Headers
                      </button>
                      <button
                        type="button"
                        className={netDetailTab === 'request' ? 'active' : ''}
                        onClick={() => setNetDetailTab('request')}
                      >
                        Request
                      </button>
                      <button
                        type="button"
                        className={netDetailTab === 'response' ? 'active' : ''}
                        onClick={() => setNetDetailTab('response')}
                      >
                        Response
                      </button>
                    </div>
                    <div className="net-detail-body">
                      {netDetailTab === 'headers' && (
                        <div className="net-section">
                          <div className="net-section-title">General</div>
                          <table className="headers-table">
                            <tbody>
                              <tr>
                                <td className="header-name">Request URL</td>
                                <td className="header-value">{selectedNet.url}</td>
                              </tr>
                              <tr>
                                <td className="header-name">Status</td>
                                <td className="header-value">{selectedNet.status}</td>
                              </tr>
                              <tr>
                                <td className="header-name">Request Method</td>
                                <td className="header-value">{selectedNet.method}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                      {netDetailTab === 'request' && (
                        <div className="net-section">
                          <div className="net-section-title">Request Payload</div>
                          <pre className="net-raw-body">
                            {selectedNet.method === 'POST'
                              ? '{"username":"...","password":"***"}'
                              : '(empty)'}
                          </pre>
                        </div>
                      )}
                      {netDetailTab === 'response' && (
                        <div className="net-section">
                          <div className="net-section-title">Response</div>
                          <pre className="net-raw-body">
                            {selectedNet.status === 200
                              ? '{"data":[...],"total":42}'
                              : selectedNet.status === 404
                                ? '{"error":"Not found"}'
                                : '{}'}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* State */}
        {tab === 'State' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="toolbar">
              <input
                type="text"
                placeholder="Filter component..."
                style={{ maxWidth: 180 }}
                readOnly
              />
              <div className="filter-bar">
                <button
                  type="button"
                  className={`filter-chip ${stateViewMode === 'timeline' ? 'active' : ''}`}
                  onClick={() => setStateViewMode('timeline')}
                >
                  Timeline
                </button>
                <button
                  type="button"
                  className={`filter-chip ${stateViewMode === 'grouped' ? 'active' : ''}`}
                  onClick={() => setStateViewMode('grouped')}
                >
                  Grouped
                </button>
              </div>
              <button type="button">Clear</button>
              <button type="button" className="btn-secondary">
                Pause
              </button>
              <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.5 }}>
                {DUMMY_STATE_ENTRIES.length} changes
              </span>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {stateViewMode === 'grouped'
                ? DUMMY_STATE_GROUPS.map((grp) => {
                    const isGroupOpen = expandedStateGroup === grp.name;
                    const latest = grp.entries[grp.entries.length - 1]!;
                    const lastTs = latest.timestamp;
                    const latestSummary =
                      typeof latest.prev !== 'object' && typeof latest.next !== 'object'
                        ? `${latest.prev} → ${latest.next}`
                        : typeof latest.next === 'object'
                          ? '1 key changed'
                          : 'reference changed';
                    return (
                      <div key={grp.name} className="state-group">
                        <div
                          className={`state-group-header ${isGroupOpen ? 'open' : ''}`}
                          onClick={() => setExpandedStateGroup(isGroupOpen ? '' : grp.name)}
                        >
                          <span className="state-expand-icon">{isGroupOpen ? '▾' : '▸'}</span>
                          <span className="state-comp-name">{grp.name}</span>
                          <span className="state-group-count">{grp.count}</span>
                          {!isGroupOpen && (
                            <span className="sg-latest-preview">latest: {latestSummary}</span>
                          )}
                          <span className="state-time" style={{ marginLeft: 'auto' }}>
                            {formatTime(lastTs)}
                          </span>
                        </div>
                        {expandedStateGroup === grp.name && (
                          <div className="state-group-body">
                            {grp.entries.map((entry) => (
                              <div
                                key={entry.id}
                                className={`sg-entry ${expandedStateId === entry.id ? 'expanded' : ''}`}
                              >
                                <div
                                  className="sg-entry-header"
                                  onClick={() =>
                                    setExpandedStateId(
                                      expandedStateId === entry.id ? null : entry.id
                                    )
                                  }
                                >
                                  <span className="sg-dot" />
                                  <span className="state-time">{formatTime(entry.timestamp)}</span>
                                  <span className="state-hook">hook #{entry.hookIndex}</span>
                                  <span className="sg-inline-diff">
                                    <span className="json-number">{String(entry.prev)}</span>
                                    <span className="sg-arrow"> → </span>
                                    <span className="json-number">
                                      {typeof entry.next === 'object' ? '{…}' : String(entry.next)}
                                    </span>
                                  </span>
                                  <span className="state-expand-icon">
                                    {expandedStateId === entry.id ? '▾' : '▸'}
                                  </span>
                                </div>
                                {expandedStateId === entry.id && typeof entry.next === 'object' && (
                                  <div className="sg-entry-detail">
                                    <div className="state-unified-diff">
                                      <div className="diff-line diff-removed">
                                        <span className="diff-marker">-</span> null
                                      </div>
                                      <div className="diff-line diff-added">
                                        <span className="diff-marker">+</span>{' '}
                                        {JSON.stringify(entry.next)}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                : DUMMY_STATE_ENTRIES.map((entry) => (
                    <div
                      key={entry.id}
                      className={`state-row ${expandedStateId === entry.id ? 'expanded' : ''}`}
                    >
                      <div
                        className="state-row-header"
                        onClick={() =>
                          setExpandedStateId(expandedStateId === entry.id ? null : entry.id)
                        }
                      >
                        <span className="state-time">{formatTime(entry.timestamp)}</span>
                        <span className="state-comp-name">{entry.component}</span>
                        <span className="state-hook">#{entry.hookIndex}</span>
                        <span className="state-summary">
                          {typeof entry.prev === 'object' || typeof entry.next === 'object'
                            ? entry.next && typeof entry.next === 'object'
                              ? '1 key changed'
                              : '0 → 1'
                            : `${entry.prev} → ${entry.next}`}
                        </span>
                        <span className="state-expand-icon">
                          {expandedStateId === entry.id ? '▾' : '▸'}
                        </span>
                      </div>
                      {expandedStateId === entry.id && (
                        <div className="state-row-detail">
                          <div className="state-unified-diff">
                            <div className="diff-line diff-removed">
                              <span className="diff-marker">-</span>{' '}
                              {entry.prev == null ? 'null' : JSON.stringify(entry.prev)}
                            </div>
                            <div className="diff-line diff-added">
                              <span className="diff-marker">+</span>{' '}
                              {entry.next == null ? 'null' : JSON.stringify(entry.next)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
            </div>
          </div>
        )}

        {/* Renders */}
        {tab === 'Renders' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="toolbar">
              <button type="button">Start</button>
              <button type="button" className="btn-secondary">
                Stop
              </button>
              <button type="button">Refresh</button>
              <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.5 }}>
                Profiling (dummy)
              </span>
            </div>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              <div className="render-row render-row-header">
                <span className="rcol-name">Component</span>
                <span className="rcol-num">Renders</span>
                <span className="rcol-num">Unnec.</span>
                <span className="rcol-triggers">Triggers</span>
                <span className="rcol-memo">Memo</span>
              </div>
              {DUMMY_HOT_COMPONENTS.map((comp, idx) => (
                <div
                  key={comp.name}
                  className={`render-row ${selectedRenderIdx === idx ? 'selected' : ''} ${comp.unnecessaryRenders > 0 ? 'has-unnecessary' : ''}`}
                  onClick={() => setSelectedRenderIdx(selectedRenderIdx === idx ? null : idx)}
                >
                  <span className="rcol-name">
                    {comp.name} <span className="native-type-badge">{comp.nativeType}</span>
                  </span>
                  <span className="rcol-num">{comp.renders}</span>
                  <span className={`rcol-num ${comp.unnecessaryRenders > 0 ? 'hot' : ''}`}>
                    {comp.unnecessaryRenders}
                  </span>
                  <span className="rcol-triggers">{comp.triggers}</span>
                  <span className={`rcol-memo ${comp.isMemoized ? 'memoized' : ''}`}>
                    {comp.isMemoized ? 'Yes' : 'No'}
                  </span>
                </div>
              ))}
              {selectedComp && (
                <div className="render-detail">
                  <div className="render-detail-summary">
                    <div className="render-stat">
                      <span className="render-stat-value">{selectedComp.renders}</span>
                      <span className="render-stat-label">renders</span>
                    </div>
                    <div className="render-stat">
                      <span className="render-stat-value">{selectedComp.mounts}</span>
                      <span className="render-stat-label">mounts</span>
                    </div>
                    <div className="render-stat">
                      <span
                        className="render-stat-value"
                        style={{
                          color: selectedComp.unnecessaryRenders > 0 ? '#f44747' : undefined,
                        }}
                      >
                        {selectedComp.unnecessaryRenders}
                      </span>
                      <span className="render-stat-label">unnecessary</span>
                    </div>
                    <div className="render-stat">
                      <span
                        className="render-stat-value"
                        style={{ color: selectedComp.isMemoized ? '#3794ff' : '#808080' }}
                      >
                        {selectedComp.isMemoized ? 'Yes' : 'No'}
                      </span>
                      <span className="render-stat-label">memo</span>
                    </div>
                    <div className="render-stat">
                      <span className="render-stat-value native-type-badge-lg">
                        {selectedComp.nativeType}
                      </span>
                      <span className="render-stat-label">native</span>
                    </div>
                  </div>
                  <div className="render-section-title">Recent Renders (last 1)</div>
                  <div className="recent-render-item">
                    <div className="recent-render-header">
                      <span className="render-time">{formatTime(Date.now() - 1000)}</span>
                      <span
                        className="trigger-badge"
                        style={{
                          background: `${TRIGGER_COLORS.state}33`,
                          color: TRIGGER_COLORS.state,
                        }}
                      >
                        state
                      </span>
                      <span className="render-parent">parent: App</span>
                      <span className="render-commit">commit #12</span>
                    </div>
                    <div className="recent-render-changes">
                      <div className="render-change-row">
                        <span className="render-change-label">state[0]</span>
                        <div className="render-change-diff">
                          <div className="diff-prev">
                            <span className="diff-marker">-</span> 1
                          </div>
                          <div className="diff-next">
                            <span className="diff-marker">+</span> 2
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DevToolsPreview;
