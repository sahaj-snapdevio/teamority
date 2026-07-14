// Recent omnibox searches — stored in localStorage per workspace so selecting a
// recent search restores BOTH the text and the active filters. Mirrors the
// list-view prefs pattern (client-only, no DB). See lib/filters/options.ts.

import { hasActiveFilters, type GlobalSearchFilters } from "@/lib/filters/options";

export type RecentSearch = {
  query: string;
  filters: GlobalSearchFilters;
  at: number;
};

const MAX = 8;
const keyFor = (workspaceId: string) => `kanbanica:recent-search:${workspaceId}`;

function signature(query: string, filters: GlobalSearchFilters): string {
  return JSON.stringify({ q: query.trim(), f: filters });
}

export function getRecentSearches(workspaceId: string): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentSearch[]) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(
  workspaceId: string,
  query: string,
  filters: GlobalSearchFilters,
): void {
  if (typeof window === "undefined") return;
  const trimmed = query.trim();
  // Don't record an empty search (no text and no active filters).
  if (!trimmed && !hasActiveFilters(filters)) return;
  try {
    const sig = signature(trimmed, filters);
    const existing = getRecentSearches(workspaceId).filter(
      (e) => signature(e.query, e.filters) !== sig,
    );
    const next: RecentSearch[] = [
      { query: trimmed, filters, at: Date.now() },
      ...existing,
    ].slice(0, MAX);
    window.localStorage.setItem(keyFor(workspaceId), JSON.stringify(next));
  } catch {
    /* localStorage unavailable — ignore */
  }
}

export function clearRecentSearches(workspaceId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(workspaceId));
  } catch {
    /* ignore */
  }
}
