import { useState, useEffect, useCallback, useMemo } from 'react';
import { sendRequest } from '../hooks/useExtensionMessage';
import { useAppState } from '../App';
import { JsonViewer } from '../components/JsonViewer';

// ─── Data types matching runtime output ───

interface PropChange {
  key: string;
  prev: unknown;
  next: unknown;
}

interface StateChange {
  hookIndex: number;
  prev: unknown;
  next: unknown;
}

interface ContextChange {
  name: string;
  prev: unknown;
  next: unknown;
}

interface RecentRender {
  timestamp: number;
  trigger: 'state' | 'props' | 'context' | 'parent';
  commitId: number;
  parent: string;
  changes?: {
    props?: PropChange[];
    state?: StateChange[];
    context?: ContextChange[];
  };
}

interface HotComponent {
  name: string;
  nativeType?: string;
  renders: number;
  mounts: number;
  unnecessaryRenders: number;
  isMemoized: boolean;
  triggers?: Record<string, number>;
  recentRenders?: RecentRender[];
}

interface RenderReport {
  profiling: boolean;
  startTime?: number;
  endTime?: number;
  duration?: string;
  totalCommits?: number;
  totalRenders?: number;
  hotComponents?: HotComponent[];
}

// ─── Helpers ───

function formatTriggers(triggers?: Record<string, number>): string {
  if (!triggers) return '-';
  const entries = Object.entries(triggers).filter(([, v]) => v > 0);
  if (entries.length === 0) return '-';
  return entries.map(([k, v]) => `${k}(${v})`).join(', ');
}

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

const TRIGGER_COLORS: Record<string, string> = {
  state: '#4ec9b0',
  props: '#dcdcaa',
  context: '#c586c0',
  parent: '#808080',
};

function TriggerBadge({ trigger }: { trigger: string }) {
  return (
    <span
      className="trigger-badge"
      style={{
        background: `${TRIGGER_COLORS[trigger] ?? '#666'}33`,
        color: TRIGGER_COLORS[trigger] ?? '#999',
      }}
    >
      {trigger}
    </span>
  );
}

// ─── Change diff viewer ───

function ChangeDiff({ label, prev, next }: { label: string; prev: unknown; next: unknown }) {
  return (
    <div className="render-change-row">
      <span className="render-change-label">{label}</span>
      <div className="render-change-diff">
        <div className="diff-prev">
          <span className="diff-marker">-</span>
          <JsonViewer data={prev} defaultExpanded={false} />
        </div>
        <div className="diff-next">
          <span className="diff-marker">+</span>
          <JsonViewer data={next} defaultExpanded={false} />
        </div>
      </div>
    </div>
  );
}

function RecentRenderDetail({
  render,
  onNavigate,
}: {
  render: RecentRender;
  onNavigate?: (name: string) => void;
}) {
  const changes = render.changes;
  const hasChanges =
    changes && (changes.props?.length || changes.state?.length || changes.context?.length);

  return (
    <div className="recent-render-item">
      <div className="recent-render-header">
        <span className="render-time">{formatTime(render.timestamp)}</span>
        <TriggerBadge trigger={render.trigger} />
        <span className="render-parent">
          parent:{' '}
          {onNavigate ? (
            <a className="parent-link" onClick={() => onNavigate(render.parent)}>
              {render.parent}
            </a>
          ) : (
            <span style={{ opacity: 0.8 }}>{render.parent}</span>
          )}
        </span>
        <span className="render-commit">commit #{render.commitId}</span>
      </div>
      {hasChanges && (
        <div className="recent-render-changes">
          {changes.props?.map((p, i) => (
            <ChangeDiff key={`p${i}`} label={`prop.${p.key}`} prev={p.prev} next={p.next} />
          ))}
          {changes.state?.map((s, i) => (
            <ChangeDiff key={`s${i}`} label={`state[${s.hookIndex}]`} prev={s.prev} next={s.next} />
          ))}
          {changes.context?.map((c, i) => (
            <ChangeDiff key={`c${i}`} label={`ctx.${c.name}`} prev={c.prev} next={c.next} />
          ))}
        </div>
      )}
      {render.trigger === 'parent' && !hasChanges && (
        <div className="render-unnecessary-hint">
          No props/state/context changed — could be prevented with React.memo
        </div>
      )}
    </div>
  );
}

// ─── Component detail ───

function ComponentDetail({
  comp,
  navigableParents,
  onNavigate,
}: {
  comp: HotComponent;
  navigableParents: Set<string>;
  onNavigate: (name: string) => void;
}) {
  const recentRenders = comp.recentRenders ?? [];

  return (
    <div className="render-detail">
      {/* Summary bar */}
      <div className="render-detail-summary">
        <div className="render-stat">
          <span className="render-stat-value">{comp.renders}</span>
          <span className="render-stat-label">renders</span>
        </div>
        <div className="render-stat">
          <span className="render-stat-value">{comp.mounts}</span>
          <span className="render-stat-label">mounts</span>
        </div>
        <div className="render-stat">
          <span
            className="render-stat-value"
            style={{ color: comp.unnecessaryRenders > 0 ? '#f44747' : undefined }}
          >
            {comp.unnecessaryRenders}
          </span>
          <span className="render-stat-label">unnecessary</span>
        </div>
        <div className="render-stat">
          <span
            className="render-stat-value"
            style={{ color: comp.isMemoized ? '#3794ff' : '#808080' }}
          >
            {comp.isMemoized ? 'Yes' : 'No'}
          </span>
          <span className="render-stat-label">memo</span>
        </div>
        {comp.nativeType && (
          <div className="render-stat">
            <span className="render-stat-value native-type-badge-lg">{comp.nativeType}</span>
            <span className="render-stat-label">native</span>
          </div>
        )}
      </div>

      {/* Trigger breakdown */}
      {comp.triggers && Object.keys(comp.triggers).length > 0 && (
        <div className="render-trigger-bar">
          {Object.entries(comp.triggers)
            .filter(([, v]) => v > 0)
            .map(([trigger, count]) => (
              <span key={trigger} className="render-trigger-item">
                <TriggerBadge trigger={trigger} />
                <span style={{ fontSize: 11 }}>{count}</span>
              </span>
            ))}
        </div>
      )}

      {/* Recent renders timeline */}
      {recentRenders.length > 0 && (
        <div className="recent-renders-section">
          <div className="render-section-title">Recent Renders (last {recentRenders.length})</div>
          {recentRenders.map((r, i) => (
            <RecentRenderDetail
              key={i}
              render={r}
              onNavigate={navigableParents.has(r.parent) ? onNavigate : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───

export function RenderPanel() {
  const { connected, disconnectGeneration } = useAppState();
  const [report, setReport] = useState<RenderReport | null>(null);
  const [profiling, setProfiling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [highlightedIdx, setHighlightedIdx] = useState<number | null>(null);

  // Clear data on disconnect
  useEffect(() => {
    if (!connected) {
      setReport(null);
      setProfiling(false);
      setExpandedIdx(null);
    }
  }, [disconnectGeneration]);

  const startProfiling = useCallback(async () => {
    try {
      setLoading(true);
      await sendRequest('startRenderProfile');
      setProfiling(true);
      setReport(null);
      setExpandedIdx(null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const stopAndGetReport = useCallback(async () => {
    try {
      setLoading(true);
      const result = await sendRequest('getRenderReport');
      if (result && typeof result === 'object') {
        setReport(result as RenderReport);
      }
      setProfiling(false);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const clearProfile = useCallback(async () => {
    try {
      await sendRequest('clearRenderProfile');
      setReport(null);
      setProfiling(false);
      setExpandedIdx(null);
    } catch {
      // ignore
    }
  }, []);

  const refreshReport = useCallback(async () => {
    try {
      setLoading(true);
      const result = await sendRequest('getRenderReport');
      if (result && typeof result === 'object') {
        setReport(result as RenderReport);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const hotComponents = report?.hotComponents ?? [];

  // Build set of component names present in the list (for navigable parent links)
  const navigableParents = useMemo(() => {
    const names = new Set<string>();
    for (const c of hotComponents) names.add(c.name);
    return names;
  }, [hotComponents]);

  const navigateToComponent = useCallback(
    (name: string) => {
      const idx = hotComponents.findIndex((c) => c.name === name);
      if (idx < 0) return;
      setExpandedIdx(idx);
      // Scroll to the row
      requestAnimationFrame(() => {
        const row = document.querySelector(`[data-comp-idx="${idx}"]`);
        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      // Flash highlight
      setHighlightedIdx(idx);
      setTimeout(() => setHighlightedIdx(null), 1500);
    },
    [hotComponents]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        {!profiling ? (
          <button onClick={startProfiling} disabled={loading || !connected}>
            Start Profiling
          </button>
        ) : (
          <>
            <button onClick={stopAndGetReport} disabled={loading}>
              Stop & Report
            </button>
            <button className="btn-secondary" onClick={refreshReport} disabled={loading}>
              Refresh
            </button>
          </>
        )}
        <button className="btn-secondary" onClick={clearProfile}>
          Clear
        </button>
        {profiling && (
          <span style={{ fontSize: 11, opacity: 0.7, color: '#f44747' }}>Recording...</span>
        )}
        {report && (
          <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 'auto' }}>
            {report.duration} | {report.totalCommits} commits | {report.totalRenders} renders
          </span>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!report ? (
          <div className="empty-state">
            {!connected
              ? 'Not connected'
              : profiling
                ? 'Profiling in progress — interact with the app, then click Stop & Report'
                : 'Click Start Profiling to begin tracking renders'}
          </div>
        ) : hotComponents.length === 0 ? (
          <div className="empty-state">No render data collected</div>
        ) : (
          <>
            {/* Header row */}
            <div className="render-row render-row-header">
              <span className="rcol-name">Component</span>
              <span className="rcol-num">Renders</span>
              <span className="rcol-num">Unnecessary</span>
              <span className="rcol-triggers">Triggers</span>
              <span className="rcol-memo">Memo</span>
            </div>
            {hotComponents.map((comp, i) => {
              const isExpanded = expandedIdx === i;
              const isHighlighted = highlightedIdx === i;
              return (
                <div key={i}>
                  <div
                    data-comp-idx={i}
                    className={`render-row ${isExpanded ? 'selected' : ''} ${comp.unnecessaryRenders > 0 ? 'has-unnecessary' : ''} ${isHighlighted ? 'flash-highlight' : ''}`}
                    onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  >
                    <span className="rcol-name">
                      <span className="render-expand-icon">{isExpanded ? '▾' : '▸'}</span>
                      {comp.name}
                      {comp.nativeType && (
                        <span className="native-type-badge">{comp.nativeType}</span>
                      )}
                    </span>
                    <span className={`rcol-num ${comp.renders > 10 ? 'hot' : ''}`}>
                      {comp.renders}
                    </span>
                    <span className={`rcol-num ${comp.unnecessaryRenders > 0 ? 'hot' : ''}`}>
                      {comp.unnecessaryRenders}
                    </span>
                    <span className="rcol-triggers">{formatTriggers(comp.triggers)}</span>
                    <span className={`rcol-memo ${comp.isMemoized ? 'memoized' : ''}`}>
                      {comp.isMemoized ? 'memo' : '-'}
                    </span>
                  </div>
                  {isExpanded && (
                    <ComponentDetail
                      comp={comp}
                      navigableParents={navigableParents}
                      onNavigate={navigateToComponent}
                    />
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
