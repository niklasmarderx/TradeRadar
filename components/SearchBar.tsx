"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/lib/types";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();

  const search = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setResults(data.slice(0, 8));
          setIsOpen(data.length > 0);
          setSelectedIdx(-1);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const navigate = (ticker: string) => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    router.push(`/stock/${ticker}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && selectedIdx >= 0) {
      e.preventDefault();
      navigate(results[selectedIdx].ticker);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        {/* Magnifying glass icon */}
        <svg
          className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Aktie suchen..."
          className="w-40 sm:w-56 pl-7 pr-2 py-1 text-xs bg-background border border-card-border rounded font-mono-num text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
        />
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 border border-accent/50 border-t-accent rounded-full animate-spin" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full mt-1 left-0 right-0 bg-card border border-card-border rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto"
        >
          {results.map((r, i) => (
            <button
              key={`${r.ticker}-${i}`}
              onClick={() => navigate(r.ticker)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-card-hover transition-colors ${
                i === selectedIdx ? "bg-card-hover" : ""
              } ${i > 0 ? "border-t border-card-border" : ""}`}
            >
              <span className="font-mono-num text-xs font-bold text-accent min-w-[60px]">
                {r.ticker}
              </span>
              <span className="text-xs text-sub truncate flex-1">{r.name}</span>
              <span className="text-[10px] text-muted">{r.region}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
