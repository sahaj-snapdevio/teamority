// Recently-opened entities, stored in localStorage per workspace. The title is
// captured from the search result row at click time, so this needs no backend
// query. Mirrors lib/recent-search.ts.

export type OpenedItem = {
  kind: "task" | "list" | "space";
  id: string;
  title: string;
  subtitle?: string;
  /** Needed to build the list route. */
  spaceId?: string;
  at: number;
};

const MAX = 6;
const keyFor = (workspaceId: string) => `kanbanica:recent-opened:${workspaceId}`;

export function getRecentlyOpened(workspaceId: string): OpenedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OpenedItem[]) : [];
  } catch {
    return [];
  }
}

export function recordOpened(
  workspaceId: string,
  item: Omit<OpenedItem, "at">,
): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getRecentlyOpened(workspaceId).filter(
      (e) => !(e.kind === item.kind && e.id === item.id),
    );
    const next: OpenedItem[] = [{ ...item, at: Date.now() }, ...existing].slice(0, MAX);
    window.localStorage.setItem(keyFor(workspaceId), JSON.stringify(next));
  } catch {
    /* localStorage unavailable — ignore */
  }
}

export function clearRecentlyOpened(workspaceId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(workspaceId));
  } catch {
    /* ignore */
  }
}
