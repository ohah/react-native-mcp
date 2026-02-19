interface FilterBarProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export function FilterBar({ options, value, onChange }: FilterBarProps) {
  return (
    <div className="filter-bar">
      {options.map((opt) => (
        <button
          key={opt}
          className={`filter-chip ${value === opt ? 'active' : ''}`}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
