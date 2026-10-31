"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface TickerAutocompleteProps {
  value: string;
  onChange: (ticker: string, name?: string) => void;
  placeholder?: string;
  className?: string;
}

interface SearchResult {
  ticker: string;
  name: string;
  type: string;
  region: string;
}

export default function TickerAutocomplete({
  value,
  onChange,
  placeholder = "Ticker suchen...",
  className = "",
}: TickerAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setResults(data.slice(0, 8));
          setOpen(true);
        }
      }
    } catch {
      // Ignore search errors
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(val: string) {
    setQuery(val);
    onChange(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 300);
  }

  function handleSelect(result: SearchResult) {
    setQuery(result.ticker);
    onChange(result.ticker, result.name);
    setOpen(false);
    setResults([]);
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Sync external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={`bg-background border border-card-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-accent ${className}`}
        />
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <svg className="w-3 h-3 animate-spin text-muted" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-card border border-card-border rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.ticker}
              onClick={() => handleSelect(r)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-card-hover transition-colors text-left"
            >
              <div>
                <span className="font-mono-num font-bold text-accent">{r.ticker}</span>
                <span className="text-sub ml-2 truncate">{r.name}</span>
              </div>
              <span className="text-[9px] text-muted shrink-0">{r.region}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
