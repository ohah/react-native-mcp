import { useState } from 'react';

interface JsonViewerProps {
  data: unknown;
  defaultExpanded?: boolean;
}

export function JsonViewer({ data, defaultExpanded = false }: JsonViewerProps) {
  if (data === null) return <span className="json-null">null</span>;
  if (data === undefined) return <span className="json-null">undefined</span>;
  if (typeof data === 'string') return <span className="json-string">"{data}"</span>;
  if (typeof data === 'number') return <span className="json-number">{data}</span>;
  if (typeof data === 'boolean') return <span className="json-boolean">{String(data)}</span>;

  if (Array.isArray(data)) {
    return (
      <CollapsibleNode label={`Array(${data.length})`} defaultExpanded={defaultExpanded}>
        {data.map((item, i) => (
          <div key={i} style={{ paddingLeft: 16 }}>
            <span className="json-key">{i}: </span>
            <JsonViewer data={item} />
          </div>
        ))}
      </CollapsibleNode>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    return (
      <CollapsibleNode label={`{${entries.length}}`} defaultExpanded={defaultExpanded}>
        {entries.map(([key, val]) => (
          <div key={key} style={{ paddingLeft: 16 }}>
            <span className="json-key">{key}: </span>
            <JsonViewer data={val} />
          </div>
        ))}
      </CollapsibleNode>
    );
  }

  return <span>{String(data)}</span>;
}

function CollapsibleNode({
  label,
  children,
  defaultExpanded = false,
}: {
  label: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <span className="json-viewer">
      <span className="json-toggle" onClick={() => setExpanded(!expanded)}>
        {expanded ? '▾ ' : '▸ '}
        {label}
      </span>
      {expanded && <div className="json-children">{children}</div>}
    </span>
  );
}
