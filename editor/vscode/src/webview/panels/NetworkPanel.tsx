import { useState, useEffect, useCallback, useRef } from 'react';
import { sendRequest } from '../hooks/useExtensionMessage';
import { useAppState } from '../App';
import { JsonViewer } from '../components/JsonViewer';

interface NetworkEntry {
  id: number;
  method: string;
  url: string;
  status: number | null;
  statusText: string | null;
  duration: number | null;
  startTime: number | null;
  state: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: string | Record<string, string>; // JSON string from runtime
  requestBody?: string | null;
  responseBody?: string | null;
  error?: string | null;
  mocked?: boolean;
}

type DetailTab = 'headers' | 'request' | 'response';

function parseHeaders(
  raw: string | Record<string, string> | undefined | null
): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function tryParseJson(str: string | null | undefined): unknown {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function getStatusColor(status: number | null): string {
  if (status === null) return '';
  if (status >= 500) return '#f44747';
  if (status >= 400) return '#f44747';
  if (status >= 300) return '#e9a700';
  return '#3c3';
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    return path.length > 1 ? path : url;
  } catch {
    return url;
  }
}

function HeadersTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (entries.length === 0) {
    return <div style={{ opacity: 0.5, padding: '4px 0', fontSize: 12 }}>No headers</div>;
  }
  return (
    <table className="headers-table">
      <tbody>
        {entries.map(([key, value]) => (
          <tr key={key}>
            <td className="header-name">{key}</td>
            <td className="header-value">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DetailPaneContent({ entry }: { entry: NetworkEntry }) {
  const [tab, setTab] = useState<DetailTab>('headers');

  const respHeaders = parseHeaders(entry.responseHeaders);
  const reqHeaders = entry.requestHeaders ?? {};
  const parsedReqBody = tryParseJson(entry.requestBody);
  const parsedResBody = tryParseJson(entry.responseBody);
  const hasReqBody = entry.requestBody != null && entry.requestBody !== '';
  const hasResBody = entry.responseBody != null && entry.responseBody !== '';

  return (
    <div className="net-detail">
      <div className="net-detail-tabs">
        <button className={tab === 'headers' ? 'active' : ''} onClick={() => setTab('headers')}>
          Headers
        </button>
        <button
          className={tab === 'request' ? 'active' : ''}
          onClick={() => setTab('request')}
          style={{ opacity: hasReqBody ? 1 : 0.4 }}
        >
          Request
        </button>
        <button
          className={tab === 'response' ? 'active' : ''}
          onClick={() => setTab('response')}
          style={{ opacity: hasResBody || entry.error ? 1 : 0.4 }}
        >
          Response
        </button>
      </div>

      <div className="net-detail-body">
        {tab === 'headers' && (
          <>
            {/* General */}
            <div className="net-section">
              <div className="net-section-title">General</div>
              <table className="headers-table">
                <tbody>
                  <tr>
                    <td className="header-name">Request URL</td>
                    <td className="header-value" style={{ wordBreak: 'break-all' }}>
                      {entry.url}
                    </td>
                  </tr>
                  <tr>
                    <td className="header-name">Request Method</td>
                    <td className="header-value">{entry.method}</td>
                  </tr>
                  <tr>
                    <td className="header-name">Status Code</td>
                    <td className="header-value">
                      <span style={{ color: getStatusColor(entry.status) }}>
                        {entry.status ?? 'pending'}
                        {entry.statusText ? ` ${entry.statusText}` : ''}
                      </span>
                    </td>
                  </tr>
                  {entry.duration != null && (
                    <tr>
                      <td className="header-name">Duration</td>
                      <td className="header-value">{entry.duration}ms</td>
                    </tr>
                  )}
                  {entry.mocked && (
                    <tr>
                      <td className="header-name">Mocked</td>
                      <td className="header-value" style={{ color: '#e9a700' }}>
                        Yes (intercepted by mock)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Response Headers */}
            <div className="net-section">
              <div className="net-section-title">Response Headers</div>
              <HeadersTable headers={respHeaders} />
            </div>

            {/* Request Headers */}
            <div className="net-section">
              <div className="net-section-title">Request Headers</div>
              <HeadersTable headers={reqHeaders} />
            </div>
          </>
        )}

        {tab === 'request' && (
          <div className="net-section">
            {hasReqBody ? (
              typeof parsedReqBody === 'object' && parsedReqBody !== null ? (
                <JsonViewer data={parsedReqBody} defaultExpanded />
              ) : (
                <pre className="net-raw-body">{entry.requestBody}</pre>
              )
            ) : (
              <div style={{ opacity: 0.5, padding: 8, fontSize: 12 }}>No request body</div>
            )}
          </div>
        )}

        {tab === 'response' && (
          <div className="net-section">
            {entry.error ? (
              <pre className="net-raw-body" style={{ color: '#f44747' }}>
                {entry.error}
              </pre>
            ) : hasResBody ? (
              typeof parsedResBody === 'object' && parsedResBody !== null ? (
                <JsonViewer data={parsedResBody} defaultExpanded />
              ) : (
                <pre className="net-raw-body">{entry.responseBody}</pre>
              )
            ) : (
              <div style={{ opacity: 0.5, padding: 8, fontSize: 12 }}>No response body</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function NetworkPanel() {
  const { connected, disconnectGeneration } = useAppState();
  const [requests, setRequests] = useState<NetworkEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [urlFilter, setUrlFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [polling, setPolling] = useState(true);

  // Clear data on disconnect
  useEffect(() => {
    if (!connected) {
      setRequests([]);
      setSelectedId(null);
    }
  }, [disconnectGeneration]);

  const fetchRequests = useCallback(async () => {
    if (!connected) return;
    try {
      const opts: Record<string, unknown> = { limit: 200 };
      if (urlFilter) opts.url = urlFilter;
      if (methodFilter) opts.method = methodFilter;
      const result = await sendRequest('getNetworkRequests', opts);
      if (Array.isArray(result)) {
        setRequests(result as NetworkEntry[]);
      }
    } catch {
      // ignore
    }
  }, [urlFilter, methodFilter, connected]);

  useEffect(() => {
    if (!connected) return;
    fetchRequests();
    if (!polling) return;
    const timer = setInterval(fetchRequests, 2000);
    return () => clearInterval(timer);
  }, [fetchRequests, polling, connected]);

  const handleClear = async () => {
    try {
      await sendRequest('clearNetworkRequests');
      setRequests([]);
      setSelectedId(null);
    } catch {
      // ignore
    }
  };

  const selectedEntry = selectedId !== null ? requests.find((r) => r.id === selectedId) : null;

  // Drag-resize for detail pane
  const [detailHeight, setDetailHeight] = useState(250);
  const splitRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      const startY = e.clientY;
      const startHeight = detailHeight;

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = startY - ev.clientY;
        const containerH = splitRef.current?.clientHeight ?? 600;
        const newH = Math.max(100, Math.min(containerH - 60, startHeight + delta));
        setDetailHeight(newH);
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [detailHeight]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div className="toolbar">
        <input
          type="text"
          placeholder="Filter URL..."
          value={urlFilter}
          onChange={(e) => setUrlFilter(e.target.value)}
          style={{ maxWidth: 200 }}
        />
        <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
          <option value="">All methods</option>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button onClick={handleClear}>Clear</button>
        <button className={polling ? '' : 'btn-secondary'} onClick={() => setPolling(!polling)}>
          {polling ? 'Pause' : 'Resume'}
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.5 }}>
          {requests.length} request{requests.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Split pane: list + detail */}
      <div className="net-split" ref={splitRef}>
        {/* Request list */}
        <div className="net-list">
          <div className="network-row network-header">
            <span className="net-col-status">Status</span>
            <span className="net-col-method">Method</span>
            <span className="net-col-url">URL</span>
            <span className="net-col-duration">Time</span>
          </div>
          {requests.length === 0 ? (
            <div className="empty-state">{connected ? 'No network requests' : 'Not connected'}</div>
          ) : (
            requests.map((entry) => {
              const isSelected = selectedId === entry.id;
              const isError = entry.error || (entry.status !== null && entry.status >= 400);
              const isPending = entry.status === null && !entry.error;
              return (
                <div
                  key={entry.id}
                  className={`network-row ${isSelected ? 'selected' : ''} ${entry.mocked ? 'mocked' : ''}`}
                  onClick={() => setSelectedId(isSelected ? null : entry.id)}
                >
                  <span className="net-col-status">
                    {entry.status !== null ? (
                      <span
                        className="status-badge"
                        style={{ color: getStatusColor(entry.status) }}
                      >
                        {entry.status}
                      </span>
                    ) : entry.error ? (
                      <span style={{ color: '#f44747' }}>ERR</span>
                    ) : (
                      <span style={{ opacity: 0.4 }}>...</span>
                    )}
                  </span>
                  <span className={`net-col-method ${isError ? 'status-error' : ''}`}>
                    {entry.method}
                  </span>
                  <span
                    className={`net-col-url ${isPending ? 'status-pending' : ''}`}
                    title={entry.url}
                  >
                    {shortenUrl(entry.url)}
                    {entry.mocked && <span className="mock-badge">mock</span>}
                  </span>
                  <span className="net-col-duration">
                    {entry.duration != null ? `${entry.duration}ms` : isPending ? '' : '-'}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Drag handle + Detail pane */}
        {selectedEntry && (
          <>
            <div className="net-resize-handle" onMouseDown={onResizeMouseDown} />
            <div className="net-detail" style={{ height: detailHeight }}>
              <DetailPaneContent entry={selectedEntry} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
