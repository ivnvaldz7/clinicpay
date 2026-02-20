import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Generic typeahead combobox.
 * Props:
 *   - onSearch(query) → Promise<{ _id, label, sublabel? }[]>
 *   - value       { _id, label }
 *   - onChange    (item) => void
 *   - placeholder string
 */
export const Combobox = ({ onSearch, value, onChange, placeholder = "Buscar..." }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await onSearch(query);
        setResults(items);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open, onSearch]);

  const handleOpen = () => {
    setQuery("");
    setOpen(true);
  };

  const handleSelect = (item) => {
    onChange(item);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger — shows selected value or opens input */}
      {!open ? (
        <button
          type="button"
          onClick={handleOpen}
          className={cn(
            "flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            !value && "text-muted-foreground",
          )}
        >
          {value ? value.label : placeholder}
        </button>
      ) : (
        <div className="flex h-9 items-center rounded-md border border-ring bg-transparent px-3 shadow-sm ring-1 ring-ring">
          <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {loading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Buscando...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Sin resultados.</p>
          ) : (
            <ul className="max-h-48 overflow-y-auto py-1">
              {results.map((item) => (
                <li key={item._id}>
                  <button
                    type="button"
                    className="flex w-full flex-col px-3 py-2 text-left hover:bg-accent"
                    onClick={() => handleSelect(item)}
                  >
                    <span className="text-sm">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
