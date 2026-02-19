import { useState, useEffect, useRef, useCallback } from 'react';
import { sendRequest } from '../hooks/useExtensionMessage';
import { useAppState } from '../App';
import { FilterBar } from '../components/FilterBar';

interface LogEntry {
  id: number;
  level: number;
  message: string;
  timestamp: number;
}

const LEVEL_NAMES: Record<number, string> = { 0: 'log', 1: 'info', 2: 'warn', 3: 'error' };
const LEVELS = ['all', 'log', 'info', 'warn', 'error'] as const;

export function ConsolePanel() {
  const { connected, disconnectGeneration } = useAppState();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [polling, setPolling] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Clear data on disconnect
  useEffect(() => {
    if (!connected) {
      setLogs([]);
    }
  }, [disconnectGeneration]);

  const fetchLogs = useCallback(async () => {
    if (!connected) return;
    try {
      const opts: Record<string, unknown> = { limit: 500 };
      if (level !== 'all') opts.level = level;
      const result = await sendRequest('getConsoleLogs', opts);
      if (Array.isArray(result)) {
        setLogs(result as LogEntry[]);
      }
    } catch {
      // ignore - may be disconnected
    }
  }, [level, connected]);

  useEffect(() => {
    if (!connected) return;
    fetchLogs();
    if (!polling) return;
    const timer = setInterval(fetchLogs, 2000);
    return () => clearInterval(timer);
  }, [fetchLogs, polling, connected]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScrollRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40;
  };

  const handleClear = async () => {
    try {
      await sendRequest('clearConsoleLogs');
      setLogs([]);
    } catch {
      // ignore
    }
  };

  const filtered = search
    ? logs.filter((l) => l.message?.toLowerCase().includes(search.toLowerCase()))
    : logs;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <FilterBar options={LEVELS as unknown as string[]} value={level} onChange={setLevel} />
        <input
          type="text"
          placeholder="Filter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={handleClear}>Clear</button>
        <button
          className={polling ? '' : 'btn-secondary'}
          onClick={() => setPolling(!polling)}
          title={polling ? 'Pause polling' : 'Resume polling'}
        >
          {polling ? 'Pause' : 'Resume'}
        </button>
      </div>
      <div ref={listRef} onScroll={handleScroll} style={{ flex: 1, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div className="empty-state">{connected ? 'No console messages' : 'Not connected'}</div>
        ) : (
          filtered.map((entry) => {
            const levelName = LEVEL_NAMES[entry.level] ?? 'log';
            return (
              <div key={entry.id} className={`log-entry level-${levelName}`}>
                <span className="log-level">[{levelName}]</span>
                {entry.message}
                <span className="log-ts">
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : ''}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
