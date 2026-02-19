import { useState, useEffect, useCallback, useMemo } from 'react';
import { sendRequest } from '../hooks/useExtensionMessage';
import { useAppState } from '../App';

interface StateEntry {
  id: number;
  timestamp: number;
  component: string;
  hookIndex: number;
  prev: unknown;
  next: unknown;
}

// ─── Helpers ───

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

/** Summarize a value change as a short inline string */
function summarizeChange(prev: unknown, next: unknown): string {
  // Primitive → primitive
  if (isPrimitive(prev) && isPrimitive(next)) {
    return `${formatValue(prev)} → ${formatValue(next)}`;
  }
  // Array length change
  if (Array.isArray(prev) && Array.isArray(next)) {
    if (prev.length !== next.length) {
      return `Array(${prev.length}) → Array(${next.length})`;
    }
    return `Array(${next.length}) modified`;
  }
  // Object diff summary
  if (isObj(prev) && isObj(next)) {
    const changed = countChangedKeys(
      prev as Record<string, unknown>,
      next as Record<string, unknown>
    );
    if (changed === 0) return 'reference changed';
    return `${changed} key${changed > 1 ? 's' : ''} changed`;
  }
  // Type change
  return `${typeLabel(prev)} → ${typeLabel(next)}`;
}

function isPrimitive(v: unknown): boolean {
  return (
    v === null ||
    v === undefined ||
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean'
  );
}

function isObj(v: unknown): boolean {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function formatValue(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return v.length > 30 ? `"${v.slice(0, 30)}…"` : `"${v}"`;
  return String(v);
}

function typeLabel(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (typeof v === 'object') return `{${Object.keys(v as object).length}}`;
  return String(v);
}

function countChangedKeys(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let count = 0;
  for (const k of allKeys) {
    if (a[k] !== b[k]) count++;
  }
  return count;
}

// ─── Unified Diff Viewer ───

function UnifiedDiff({ prev, next }: { prev: unknown; next: unknown }) {
  // Primitive values
  if (isPrimitive(prev) && isPrimitive(next)) {
    return (
      <div className="state-unified-diff">
        <div className="diff-line diff-removed">
          <span className="diff-marker">-</span> {formatValue(prev)}
        </div>
        <div className="diff-line diff-added">
          <span className="diff-marker">+</span> {formatValue(next)}
        </div>
      </div>
    );
  }

  // Array diff
  if (Array.isArray(prev) && Array.isArray(next)) {
    return <ArrayDiff prev={prev} next={next} />;
  }

  // Object diff
  if (isObj(prev) && isObj(next)) {
    return (
      <ObjectDiff prev={prev as Record<string, unknown>} next={next as Record<string, unknown>} />
    );
  }

  // Fallback: type mismatch
  return (
    <div className="state-unified-diff">
      <div className="diff-line diff-removed">
        <span className="diff-marker">-</span> {JSON.stringify(prev)}
      </div>
      <div className="diff-line diff-added">
        <span className="diff-marker">+</span> {JSON.stringify(next)}
      </div>
    </div>
  );
}

function ObjectDiff({
  prev,
  next,
}: {
  prev: Record<string, unknown>;
  next: Record<string, unknown>;
}) {
  const allKeys = [...new Set([...Object.keys(prev), ...Object.keys(next)])];

  return (
    <div className="state-unified-diff">
      <div className="diff-line diff-bracket">{'{'}</div>
      {allKeys.map((key) => {
        const inPrev = key in prev;
        const inNext = key in next;
        const changed = inPrev && inNext && prev[key] !== next[key];
        const added = !inPrev && inNext;
        const removed = inPrev && !inNext;

        if (added) {
          return (
            <div key={key} className="diff-line diff-added">
              <span className="diff-marker">+</span>
              <span className="diff-key">{key}</span>: {renderInlineValue(next[key])}
            </div>
          );
        }
        if (removed) {
          return (
            <div key={key} className="diff-line diff-removed">
              <span className="diff-marker">-</span>
              <span className="diff-key">{key}</span>: {renderInlineValue(prev[key])}
            </div>
          );
        }
        if (changed) {
          return (
            <div key={key}>
              <div className="diff-line diff-removed">
                <span className="diff-marker">-</span>
                <span className="diff-key">{key}</span>: {renderInlineValue(prev[key])}
              </div>
              <div className="diff-line diff-added">
                <span className="diff-marker">+</span>
                <span className="diff-key">{key}</span>: {renderInlineValue(next[key])}
              </div>
            </div>
          );
        }
        // Unchanged
        return (
          <div key={key} className="diff-line diff-unchanged">
            <span className="diff-marker"> </span>
            <span className="diff-key">{key}</span>: {renderInlineValue(prev[key])}
          </div>
        );
      })}
      <div className="diff-line diff-bracket">{'}'}</div>
    </div>
  );
}

function ArrayDiff({ prev, next }: { prev: unknown[]; next: unknown[] }) {
  const maxLen = Math.max(prev.length, next.length);
  const showMax = 20;

  return (
    <div className="state-unified-diff">
      <div className="diff-line diff-bracket">[</div>
      {Array.from({ length: Math.min(maxLen, showMax) }, (_, i) => {
        const inPrev = i < prev.length;
        const inNext = i < next.length;

        if (!inPrev) {
          return (
            <div key={i} className="diff-line diff-added">
              <span className="diff-marker">+</span>
              <span className="diff-key">[{i}]</span> {renderInlineValue(next[i])}
            </div>
          );
        }
        if (!inNext) {
          return (
            <div key={i} className="diff-line diff-removed">
              <span className="diff-marker">-</span>
              <span className="diff-key">[{i}]</span> {renderInlineValue(prev[i])}
            </div>
          );
        }
        if (prev[i] !== next[i]) {
          return (
            <div key={i}>
              <div className="diff-line diff-removed">
                <span className="diff-marker">-</span>
                <span className="diff-key">[{i}]</span> {renderInlineValue(prev[i])}
              </div>
              <div className="diff-line diff-added">
                <span className="diff-marker">+</span>
                <span className="diff-key">[{i}]</span> {renderInlineValue(next[i])}
              </div>
            </div>
          );
        }
        return (
          <div key={i} className="diff-line diff-unchanged">
            <span className="diff-marker"> </span>
            <span className="diff-key">[{i}]</span> {renderInlineValue(prev[i])}
          </div>
        );
      })}
      {maxLen > showMax && (
        <div className="diff-line diff-unchanged">
          <span className="diff-marker"> </span>
          <span style={{ opacity: 0.5 }}>… {maxLen - showMax} more items</span>
        </div>
      )}
      <div className="diff-line diff-bracket">]</div>
    </div>
  );
}

function renderInlineValue(v: unknown): React.ReactNode {
  if (v === null) return <span className="json-null">null</span>;
  if (v === undefined) return <span className="json-null">undefined</span>;
  if (typeof v === 'string')
    return <span className="json-string">"{v.length > 50 ? v.slice(0, 50) + '…' : v}"</span>;
  if (typeof v === 'number') return <span className="json-number">{v}</span>;
  if (typeof v === 'boolean') return <span className="json-boolean">{String(v)}</span>;
  if (Array.isArray(v)) return <span className="json-null">Array({v.length})</span>;
  if (typeof v === 'object') return <span className="json-null">{'{…}'}</span>;
  return <span>{String(v)}</span>;
}

// ─── Component group ───

interface ComponentGroup {
  name: string;
  entries: StateEntry[];
  lastTimestamp: number;
}

function groupByComponent(entries: StateEntry[]): ComponentGroup[] {
  const map = new Map<string, StateEntry[]>();
  for (const e of entries) {
    const arr = map.get(e.component);
    if (arr) arr.push(e);
    else map.set(e.component, [e]);
  }
  const groups: ComponentGroup[] = [];
  for (const [name, items] of map) {
    groups.push({
      name,
      entries: items,
      lastTimestamp: items[items.length - 1]!.timestamp,
    });
  }
  // Sort by most recent change first
  groups.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  return groups;
}

// ─── Timeline entry row ───

function StateRow({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: StateEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={`state-row ${isExpanded ? 'expanded' : ''}`}>
      <div className="state-row-header" onClick={onToggle}>
        <span className="state-time">{formatTime(entry.timestamp)}</span>
        <span className="state-comp-name">{entry.component}</span>
        <span className="state-hook">#{entry.hookIndex}</span>
        <span className="state-summary">{summarizeChange(entry.prev, entry.next)}</span>
        <span className="state-expand-icon">{isExpanded ? '▾' : '▸'}</span>
      </div>
      {isExpanded && (
        <div className="state-row-detail">
          <UnifiedDiff prev={entry.prev} next={entry.next} />
        </div>
      )}
    </div>
  );
}

// ─── Grouped entry row (compact, no component name, inline primitive diff) ───

function GroupedEntryRow({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: StateEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isSimple = isPrimitive(entry.prev) && isPrimitive(entry.next);

  return (
    <div className={`sg-entry ${isExpanded ? 'expanded' : ''}`}>
      <div className="sg-entry-header" onClick={onToggle}>
        <span className="sg-dot" />
        <span className="state-time">{formatTime(entry.timestamp)}</span>
        <span className="state-hook">hook #{entry.hookIndex}</span>
        {isSimple ? (
          <span className="sg-inline-diff">
            {renderInlineValue(entry.prev)}
            <span className="sg-arrow"> → </span>
            {renderInlineValue(entry.next)}
          </span>
        ) : (
          <>
            <span className="state-summary">{summarizeChange(entry.prev, entry.next)}</span>
            <span className="state-expand-icon">{isExpanded ? '▾' : '▸'}</span>
          </>
        )}
      </div>
      {isExpanded && !isSimple && (
        <div className="sg-entry-detail">
          <UnifiedDiff prev={entry.prev} next={entry.next} />
        </div>
      )}
    </div>
  );
}

// ─── Grouped view ───

function GroupedView({
  entries,
  componentFilter,
}: {
  entries: StateEntry[];
  componentFilter: string;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const groups = useMemo(() => {
    const filtered = componentFilter
      ? entries.filter((e) => e.component.toLowerCase().includes(componentFilter.toLowerCase()))
      : entries;
    return groupByComponent(filtered);
  }, [entries, componentFilter]);

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (groups.length === 0) {
    return <div className="empty-state">No state changes recorded</div>;
  }

  return (
    <>
      {groups.map((group) => {
        const isGroupOpen = expandedGroups.has(group.name);
        // Latest entry for preview
        const latest = group.entries[group.entries.length - 1]!;
        const latestSummary = summarizeChange(latest.prev, latest.next);
        return (
          <div key={group.name} className="state-group">
            <div
              className={`state-group-header ${isGroupOpen ? 'open' : ''}`}
              onClick={() => toggleGroup(group.name)}
            >
              <span className="state-expand-icon">{isGroupOpen ? '▾' : '▸'}</span>
              <span className="state-comp-name">{group.name}</span>
              <span className="state-group-count">{group.entries.length}</span>
              {!isGroupOpen && <span className="sg-latest-preview">latest: {latestSummary}</span>}
              <span className="state-time" style={{ marginLeft: 'auto' }}>
                {formatTime(group.lastTimestamp)}
              </span>
            </div>
            {isGroupOpen && (
              <div className="state-group-body">
                {group.entries.map((entry) => (
                  <GroupedEntryRow
                    key={entry.id}
                    entry={entry}
                    isExpanded={expandedId === entry.id}
                    onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── Main panel ───

type ViewMode = 'timeline' | 'grouped';

export function StatePanel() {
  const { connected, disconnectGeneration } = useAppState();
  const [entries, setEntries] = useState<StateEntry[]>([]);
  const [componentFilter, setComponentFilter] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [polling, setPolling] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');

  // Clear data on disconnect
  useEffect(() => {
    if (!connected) {
      setEntries([]);
      setExpandedId(null);
    }
  }, [disconnectGeneration]);

  const fetchChanges = useCallback(async () => {
    if (!connected) return;
    try {
      const opts: Record<string, unknown> = { limit: 200 };
      const result = await sendRequest('getStateChanges', opts);
      if (Array.isArray(result)) {
        setEntries(result as StateEntry[]);
      }
    } catch {
      // ignore
    }
  }, [connected]);

  useEffect(() => {
    if (!connected) return;
    fetchChanges();
    if (!polling) return;
    const timer = setInterval(fetchChanges, 2000);
    return () => clearInterval(timer);
  }, [fetchChanges, polling, connected]);

  const handleClear = async () => {
    try {
      await sendRequest('clearStateChanges');
      setEntries([]);
      setExpandedId(null);
    } catch {
      // ignore
    }
  };

  const filteredEntries = useMemo(() => {
    if (!componentFilter) return entries;
    return entries.filter((e) => e.component.toLowerCase().includes(componentFilter.toLowerCase()));
  }, [entries, componentFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <input
          type="text"
          placeholder="Filter component..."
          value={componentFilter}
          onChange={(e) => setComponentFilter(e.target.value)}
        />
        <div className="filter-bar">
          <button
            className={`filter-chip ${viewMode === 'timeline' ? 'active' : ''}`}
            onClick={() => setViewMode('timeline')}
          >
            Timeline
          </button>
          <button
            className={`filter-chip ${viewMode === 'grouped' ? 'active' : ''}`}
            onClick={() => setViewMode('grouped')}
          >
            Grouped
          </button>
        </div>
        <button onClick={handleClear}>Clear</button>
        <button className={polling ? '' : 'btn-secondary'} onClick={() => setPolling(!polling)}>
          {polling ? 'Pause' : 'Resume'}
        </button>
        {entries.length > 0 && (
          <span style={{ fontSize: 11, opacity: 0.5, marginLeft: 'auto' }}>
            {entries.length} changes
          </span>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!connected ? (
          <div className="empty-state">Not connected</div>
        ) : entries.length === 0 ? (
          <div className="empty-state">No state changes recorded</div>
        ) : viewMode === 'grouped' ? (
          <GroupedView entries={entries} componentFilter={componentFilter} />
        ) : /* Timeline view */
        filteredEntries.length === 0 ? (
          <div className="empty-state">No matches for "{componentFilter}"</div>
        ) : (
          filteredEntries.map((entry) => (
            <StateRow
              key={entry.id}
              entry={entry}
              isExpanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
