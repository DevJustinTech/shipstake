"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Lock, Search } from "lucide-react";

export type RepoOption = {
  full_name: string;
  owner: string;
  name: string;
  private: boolean;
  pushed_at: string;
};

export function RepoPicker({
  repos,
  value,
  onSelect,
  loading,
}: {
  repos: RepoOption[];
  value: RepoOption | null;
  onSelect: (repo: RepoOption) => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = query
    ? repos.filter((r) => r.full_name.toLowerCase().includes(query.toLowerCase()))
    : repos;

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1">
      <span className="text-xs font-mono uppercase tracking-wide text-muted">
        Repository to stake on
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={loading}
        onClick={() => setOpen((o) => !o)}
        className="flex cursor-pointer items-center justify-between gap-3 rounded-none border-2 border-line bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:border-primary focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={`flex items-center gap-2 truncate font-mono ${value ? "text-foreground" : "text-muted/60"}`}>
          {value?.private && <Lock className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
          {loading ? "Loading your repos…" : value ? value.full_name : "Pick a repo"}
        </span>
        <ChevronDown className="size-4 shrink-0 text-primary" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-full border-2 border-primary bg-surface shadow-brutal">
          <div className="flex items-center gap-2 border-b-2 border-line px-3 py-2">
            <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
            <input
              ref={inputRef}
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted/60 focus:outline-none"
              placeholder="Filter repos…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-muted">
                {repos.length === 0 ? "No repos found on your account" : "Nothing matches that filter"}
              </li>
            ) : (
              filtered.map((repo) => (
                <li key={repo.full_name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value?.full_name === repo.full_name}
                    onClick={() => {
                      onSelect(repo);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left font-mono text-sm transition-colors ${
                      value?.full_name === repo.full_name
                        ? "bg-primary text-background"
                        : "text-foreground hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    <span className="truncate">{repo.full_name}</span>
                    {repo.private && (
                      <span className="flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-wide opacity-80">
                        <Lock className="size-3" aria-hidden="true" />
                        private
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
