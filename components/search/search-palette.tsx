"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlassIcon,
  XIcon,
  ListIcon,
  SquaresFourIcon,
  ClockIcon,
  FunnelIcon,
  CaretDownIcon,
  CheckSquareIcon,
} from "@phosphor-icons/react";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import {
  globalSearch,
  recordSearchVisit,
  getSearchFilterOptions,
  type GlobalSearchResults,
  type SearchFilterOptions,
} from "@/app/actions/search";
import {
  FacetFilter,
  FacetOptionList,
  type FacetOption,
} from "@/components/filters/facet-filter";
import { FilterChip } from "@/components/filters/filter-chip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DUE_OPTIONS,
  PRIORITY_OPTIONS,
  STATUS_TYPE_OPTIONS,
  TYPE_OPTIONS,
  hasActiveFilters,
  type DueValue,
  type GlobalSearchFilters,
  type SearchEntityType,
  type StatusType,
} from "@/lib/filters/options";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  type RecentSearch,
} from "@/lib/recent-search";
import {
  clearRecentlyOpened,
  getRecentlyOpened,
  recordOpened,
  type OpenedItem,
} from "@/lib/recent-opened";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { UserAvatar } from "@/components/common/user-avatar";
import { PRIORITY_CONFIG, formatDueDate, type Priority } from "@/lib/priority-config";
import { cn } from "@/lib/utils";

interface SearchPaletteProps {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}

/** Flat, keyboard-navigable list of the navigable results (members excluded). */
type FlatItem =
  | { kind: "task"; id: string }
  | { kind: "list"; id: string; spaceId: string }
  | { kind: "space"; id: string };

const SKELETON_ROWS = ["s1", "s2", "s3", "s4"];

// Quick filters TOGGLE the same filter state as the advanced controls (no
// separate state): click enables, click again disables.
type QuickFilter =
  | { label: string; kind: "priority"; value: string }
  | { label: string; kind: "statusType"; value: StatusType }
  | { label: string; kind: "due"; value: DueValue };

const QUICK_FILTERS: QuickFilter[] = [
  { label: "🚨 Urgent", kind: "priority", value: "URGENT" },
  { label: "📅 Due today", kind: "due", value: "today" },
  { label: "⏰ Overdue", kind: "due", value: "overdue" },
  { label: "✅ Done", kind: "statusType", value: "CLOSED" },
  { label: "🏃 In progress", kind: "statusType", value: "ACTIVE" },
];

export function SearchPalette({ workspaceId, open, onClose }: SearchPaletteProps) {
  const router = useRouter();
  const { query, setQuery, debouncedQuery } = useDebouncedSearch(300);
  const [filters, setFilters] = React.useState<GlobalSearchFilters>({});
  const [results, setResults] = React.useState<GlobalSearchResults | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [options, setOptions] = React.useState<SearchFilterOptions | null>(null);
  const [recent, setRecent] = React.useState<RecentSearch[]>([]);
  const [recentOpened, setRecentOpened] = React.useState<OpenedItem[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filtersActive = hasActiveFilters(filters);
  const searching = Boolean(debouncedQuery) || filtersActive;

  // Reset + load options/recent when opened.
  React.useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 50);
    setQuery("");
    setFilters({});
    setResults(null);
    setSelectedIndex(0);
    setRecent(getRecentSearches(workspaceId));
    setRecentOpened(getRecentlyOpened(workspaceId));
    getSearchFilterOptions(workspaceId).then((res) => {
      if (!("error" in res)) setOptions(res);
    });
  }, [open, workspaceId, setQuery]);

  // Run a search on debounced text OR active filters (filter-only search).
  React.useEffect(() => {
    setSelectedIndex(0);
    if (!(Boolean(debouncedQuery) || hasActiveFilters(filters))) {
      setResults(null);
      return;
    }
    setLoading(true);
    globalSearch(workspaceId, debouncedQuery, filters)
      .then((res) => {
        if (!("error" in res)) setResults(res);
      })
      .finally(() => setLoading(false));
  }, [debouncedQuery, filters, workspaceId]);

  const flatItems = React.useMemo<FlatItem[]>(() => {
    if (!results) return [];
    const items: FlatItem[] = [];
    for (const t of results.tasks) items.push({ kind: "task", id: t.id });
    for (const l of results.lists)
      items.push({ kind: "list", id: l.id, spaceId: l.spaceId });
    for (const s of results.spaces) items.push({ kind: "space", id: s.id });
    return items;
  }, [results]);

  // Close on Escape (from anywhere).
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function set<K extends keyof GlobalSearchFilters>(
    key: K,
    value: GlobalSearchFilters[K],
  ) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  // Quick filters toggle a single value in the shared filter state.
  function isQuickActive(qf: QuickFilter): boolean {
    if (qf.kind === "due") return filters.due === qf.value;
    return (filters[qf.kind] ?? []).includes(qf.value);
  }
  function toggleQuick(qf: QuickFilter) {
    if (qf.kind === "due") {
      set("due", filters.due === qf.value ? "" : qf.value);
      return;
    }
    const current = (filters[qf.kind] ?? []) as string[];
    const next = current.includes(qf.value)
      ? current.filter((v) => v !== qf.value)
      : [...current, qf.value];
    set(qf.kind, next as GlobalSearchFilters[typeof qf.kind]);
  }

  async function navigateTask(taskId: string) {
    const t = results?.tasks.find((x) => x.id === taskId);
    if (t) {
      recordOpened(workspaceId, {
        kind: "task",
        id: t.id,
        title: t.title,
        subtitle: `${t.spaceName}${t.listName ? ` • ${t.listName}` : ""}`,
      });
    }
    addRecentSearch(workspaceId, query, filters);
    await recordSearchVisit(workspaceId, "task", taskId);
    onClose();
    router.push(`/${workspaceId}/task/${taskId}`);
  }

  async function navigateList(listId: string, spaceId: string) {
    const l = results?.lists.find((x) => x.id === listId);
    if (l) {
      recordOpened(workspaceId, {
        kind: "list",
        id: l.id,
        title: l.name,
        subtitle: l.spaceName,
        spaceId: l.spaceId,
      });
    }
    addRecentSearch(workspaceId, query, filters);
    await recordSearchVisit(workspaceId, "list", listId);
    onClose();
    router.push(`/${workspaceId}/${spaceId}/list/${listId}`);
  }

  async function navigateSpace(spaceId: string) {
    const s = results?.spaces.find((x) => x.id === spaceId);
    if (s) {
      recordOpened(workspaceId, { kind: "space", id: s.id, title: s.name });
    }
    addRecentSearch(workspaceId, query, filters);
    await recordSearchVisit(workspaceId, "space", spaceId);
    onClose();
    router.push(`/${workspaceId}/${spaceId}`);
  }

  function navigateOpened(item: OpenedItem) {
    onClose();
    if (item.kind === "task") {
      router.push(`/${workspaceId}/task/${item.id}`);
    } else if (item.kind === "list" && item.spaceId) {
      router.push(`/${workspaceId}/${item.spaceId}/list/${item.id}`);
    } else {
      router.push(`/${workspaceId}/${item.id}`);
    }
  }

  function navigateFlat(it: FlatItem) {
    if (it.kind === "task") void navigateTask(it.id);
    else if (it.kind === "list") void navigateList(it.id, it.spaceId);
    else void navigateSpace(it.id);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (flatItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const it = flatItems[selectedIndex];
      if (it) {
        e.preventDefault();
        navigateFlat(it);
      }
    }
  }

  function applyRecent(r: RecentSearch) {
    setQuery(r.query);
    setFilters(r.filters);
  }

  if (!open) return null;

  const hasResults =
    results &&
    (results.tasks.length > 0 ||
      results.lists.length > 0 ||
      results.spaces.length > 0 ||
      results.members.length > 0);

  // Filter-option lists from the loaded workspace options.
  const assigneeOptions: FacetOption[] = [
    { value: "unassigned", label: "Unassigned" },
    ...(options?.members ?? []).map((m) => ({
      value: m.userId,
      label: m.name ?? m.email ?? "Unknown",
    })),
  ];
  const spaceOptions: FacetOption[] = (options?.spaces ?? []).map((s) => ({
    value: s.id,
    label: s.name,
    color: s.color ?? undefined,
  }));
  const sprintOptions: FacetOption[] = (options?.sprints ?? []).map((s) => ({
    value: s.id,
    label: s.name,
  }));
  const tagOptions: FacetOption[] = (options?.tags ?? []).map((t) => ({
    value: t.id,
    label: t.name,
    color: t.color,
  }));

  const moreCount =
    (filters.priority?.length ?? 0) +
    (filters.space?.length ?? 0) +
    (filters.sprint?.length ?? 0) +
    (filters.tags?.length ?? 0) +
    (filters.due ? 1 : 0);

  // Active-filter chips (each removes exactly its own value).
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filters.type && filters.type !== "all") {
    activeChips.push({
      key: "type",
      label: TYPE_OPTIONS.find((o) => o.value === filters.type)?.label ?? filters.type,
      onRemove: () => set("type", "all"),
    });
  }
  for (const st of filters.statusType ?? []) {
    activeChips.push({
      key: `st-${st}`,
      label: STATUS_TYPE_OPTIONS.find((o) => o.value === st)?.label ?? st,
      onRemove: () => set("statusType", (filters.statusType ?? []).filter((v) => v !== st)),
    });
  }
  for (const p of filters.priority ?? []) {
    activeChips.push({
      key: `p-${p}`,
      label: PRIORITY_CONFIG[p as Priority]?.label ?? p,
      onRemove: () => set("priority", (filters.priority ?? []).filter((v) => v !== p)),
    });
  }
  for (const a of filters.assignee ?? []) {
    const m = options?.members.find((x) => x.userId === a);
    activeChips.push({
      key: `a-${a}`,
      label: a === "unassigned" ? "Unassigned" : (m?.name ?? m?.email ?? "Assignee"),
      onRemove: () => set("assignee", (filters.assignee ?? []).filter((v) => v !== a)),
    });
  }
  for (const sp of filters.space ?? []) {
    activeChips.push({
      key: `sp-${sp}`,
      label: options?.spaces.find((x) => x.id === sp)?.name ?? "Project",
      onRemove: () => set("space", (filters.space ?? []).filter((v) => v !== sp)),
    });
  }
  for (const spr of filters.sprint ?? []) {
    activeChips.push({
      key: `spr-${spr}`,
      label: options?.sprints.find((x) => x.id === spr)?.name ?? "Sprint",
      onRemove: () => set("sprint", (filters.sprint ?? []).filter((v) => v !== spr)),
    });
  }
  for (const t of filters.tags ?? []) {
    activeChips.push({
      key: `t-${t}`,
      label: options?.tags.find((x) => x.id === t)?.name ?? "Tag",
      onRemove: () => set("tags", (filters.tags ?? []).filter((v) => v !== t)),
    });
  }
  if (filters.due) {
    activeChips.push({
      key: "due",
      label: DUE_OPTIONS.find((o) => o.value === filters.due)?.label ?? filters.due,
      onRemove: () => set("due", ""),
    });
  }

  const active = flatItems[selectedIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop — light blur + a semi-transparent dark overlay. */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border bg-card shadow-2xl">
        {/* Search input — the dominant element. */}
        <div className="flex items-center gap-3 border-b px-4 py-4">
          <MagnifyingGlassIcon className="size-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tasks, lists, projects, members — or filter below…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          )}
          <kbd className="hidden h-5 items-center gap-1 rounded border bg-muted px-1.5 text-2xs font-medium text-muted-foreground sm:inline-flex">
            Esc
          </kbd>
        </div>

        {/* Filter row — high-value facets inline; the rest behind "More filters".
            The muted background groups the filter controls into their own zone,
            distinct from the search box above and the results below. */}
        <div className="flex flex-wrap items-center gap-1.5 border-b bg-muted/30 px-3 py-2">
          <FacetFilter
            label="Type"
            single
            options={TYPE_OPTIONS.filter((o) => o.value !== "all")}
            selected={filters.type && filters.type !== "all" ? [filters.type] : []}
            onChange={(n) => set("type", (n[0] as SearchEntityType) ?? "all")}
          />
          <FacetFilter
            label="Assignee"
            searchable
            options={assigneeOptions}
            selected={filters.assignee ?? []}
            onChange={(n) => set("assignee", n)}
          />
          <FacetFilter
            label="Status"
            options={STATUS_TYPE_OPTIONS}
            selected={filters.statusType ?? []}
            onChange={(n) => set("statusType", n as StatusType[])}
          />

          {/* More filters */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex h-8 shrink-0 select-none items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors",
                  moreCount > 0
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <FunnelIcon className="size-3.5" />
                More filters
                {moreCount > 0 && <span className="font-bold">({moreCount})</span>}
                <CaretDownIcon className="size-3 opacity-60" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="max-h-[55vh] w-72 overflow-y-auto rounded-xl p-2"
            >
              <Accordion type="single" collapsible defaultValue="priority" className="w-full">
                <MoreFilterAccordionItem
                  value="priority"
                  label="Priority"
                  count={filters.priority?.length ?? 0}
                >
                  <FacetOptionList
                    options={PRIORITY_OPTIONS}
                    selected={filters.priority ?? []}
                    onChange={(n) => set("priority", n)}
                  />
                </MoreFilterAccordionItem>
                <MoreFilterAccordionItem
                  value="project"
                  label="Project"
                  count={filters.space?.length ?? 0}
                >
                  <FacetOptionList
                    options={spaceOptions}
                    searchable={spaceOptions.length > 6}
                    selected={filters.space ?? []}
                    onChange={(n) => set("space", n)}
                    emptyText="No projects"
                  />
                </MoreFilterAccordionItem>
                <MoreFilterAccordionItem
                  value="sprint"
                  label="Sprint"
                  count={filters.sprint?.length ?? 0}
                >
                  <FacetOptionList
                    options={sprintOptions}
                    searchable={sprintOptions.length > 6}
                    selected={filters.sprint ?? []}
                    onChange={(n) => set("sprint", n)}
                    emptyText="No sprints"
                  />
                </MoreFilterAccordionItem>
                <MoreFilterAccordionItem
                  value="tags"
                  label="Tags"
                  count={filters.tags?.length ?? 0}
                >
                  <FacetOptionList
                    options={tagOptions}
                    searchable={tagOptions.length > 6}
                    selected={filters.tags ?? []}
                    onChange={(n) => set("tags", n)}
                    emptyText="No tags"
                  />
                </MoreFilterAccordionItem>
                <MoreFilterAccordionItem
                  value="due"
                  label="Due Date"
                  count={filters.due ? 1 : 0}
                >
                  <FacetOptionList
                    single
                    options={DUE_OPTIONS}
                    selected={filters.due ? [filters.due] : []}
                    onChange={(n) => set("due", (n[0] as DueValue) ?? "")}
                  />
                </MoreFilterAccordionItem>
              </Accordion>
            </PopoverContent>
          </Popover>

          <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />

          {/* Quick filters — toggle chips over the same filter state. */}
          {QUICK_FILTERS.map((q) => {
            const activeQuick = isQuickActive(q);
            return (
              <button
                key={q.label}
                type="button"
                onClick={() => toggleQuick(q)}
                className={cn(
                  "flex h-8 shrink-0 select-none items-center rounded-full border px-2.5 text-xs font-medium transition-colors",
                  activeQuick
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {q.label}
              </button>
            );
          })}
        </div>

        {/* Active-filter chips */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b bg-muted/30 px-3 py-2">
            {activeChips.map((c) => (
              <FilterChip key={c.key} label={c.label} onRemove={c.onRemove} />
            ))}
            <button
              type="button"
              onClick={() => setFilters({})}
              className="ml-auto shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Results / recent */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && (
            <div className="space-y-1 p-2">
              {SKELETON_ROWS.map((k) => (
                <div key={k} className="flex items-center gap-3 px-2 py-2.5">
                  <div className="size-2 shrink-0 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && searching && !hasResults && (
            <div className="flex flex-col items-center gap-2 py-12">
              <MagnifyingGlassIcon className="size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No results{debouncedQuery ? ` for “${debouncedQuery}”` : ""}
              </p>
            </div>
          )}

          {!loading && !searching && (
            <div className="p-2">
              {recent.length > 0 && (
                <section className="pb-2">
                  <div className="flex items-center justify-between px-2 pb-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Recent searches
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        clearRecentSearches(workspaceId);
                        setRecent([]);
                      }}
                      className="text-2xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                  {recent.map((r) => (
                    <button
                      type="button"
                      key={`${r.at}-${r.query}`}
                      onClick={() => applyRecent(r)}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
                    >
                      <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm">
                        {r.query || "Filtered search"}
                      </span>
                      {recentFilterCount(r) > 0 && (
                        <span className="shrink-0 text-2xs text-muted-foreground">
                          {recentFilterCount(r)} filter
                          {recentFilterCount(r) > 1 ? "s" : ""}
                        </span>
                      )}
                    </button>
                  ))}
                </section>
              )}

              {recentOpened.length > 0 && (
                <section className="pb-2">
                  <div className="flex items-center justify-between px-2 pb-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Recently opened
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        clearRecentlyOpened(workspaceId);
                        setRecentOpened([]);
                      }}
                      className="text-2xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                  {recentOpened.map((o) => (
                    <button
                      type="button"
                      key={`${o.kind}-${o.id}`}
                      onClick={() => navigateOpened(o)}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
                    >
                      {o.kind === "task" ? (
                        <CheckSquareIcon className="size-4 shrink-0 text-muted-foreground" />
                      ) : o.kind === "list" ? (
                        <ListIcon className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <SquaresFourIcon className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{o.title}</p>
                        {o.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">{o.subtitle}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </section>
              )}

              {recent.length === 0 && recentOpened.length === 0 && (
                <section className="px-2 py-3">
                  <p className="pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Quick tips
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Search by task, list, project, or member. Use filters like
                    Assignee, Status, or Priority to narrow results, or simply
                    start typing to find what you need.
                  </p>
                </section>
              )}
            </div>
          )}

          {!loading && hasResults && results && (
            <div className="divide-y">
              {results.tasks.length > 0 && (
                <ResultSection title="Tasks" count={results.tasks.length}>
                  {results.tasks.map((t) => {
                    const isActive = active?.kind === "task" && active.id === t.id;
                    const cfg = PRIORITY_CONFIG[t.priority as Priority];
                    const due = formatDueDate(t.dueDateEnd);
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => navigateTask(t.id)}
                        className={cn(
                          "flex w-full items-start gap-3 border-l-2 px-4 py-2.5 text-left transition-colors",
                          isActive
                            ? "border-primary bg-primary/10"
                            : "border-transparent hover:bg-accent",
                        )}
                      >
                        <span
                          className="mt-1.5 inline-flex size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: t.statusColor ?? undefined }}
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium">{t.title}</p>
                            {t.statusName && (
                              <span
                                className="shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium"
                                style={{
                                  backgroundColor: t.statusColor ? t.statusColor + "26" : undefined,
                                  color: t.statusColor ?? undefined,
                                }}
                              >
                                {t.statusName}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                            <span className="truncate">
                              {t.spaceName}
                              {t.listName ? ` • ${t.listName}` : ""}
                            </span>
                            {cfg && t.priority !== "NONE" && (
                              <span className={cn("flex items-center gap-0.5 font-medium", cfg.color)}>
                                <span>{cfg.icon}</span>
                                {cfg.label}
                              </span>
                            )}
                            {due && (
                              <span className={due.overdue ? "font-medium text-destructive" : ""}>
                                {due.label}
                              </span>
                            )}
                            {t.assignees.length > 0 && (
                              <span className="flex -space-x-1">
                                {t.assignees.slice(0, 3).map((a) => (
                                  <UserAvatar
                                    key={a.userId}
                                    name={a.name}
                                    email={a.email}
                                    size="xs"
                                    className="border border-background"
                                  />
                                ))}
                                {t.assignees.length > 3 && (
                                  <span className="flex size-5 items-center justify-center rounded-full border border-background bg-muted text-[9px] font-medium">
                                    +{t.assignees.length - 3}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </ResultSection>
              )}

              {results.lists.length > 0 && (
                <ResultSection title="Lists" count={results.lists.length}>
                  {results.lists.map((l) => {
                    const isActive = active?.kind === "list" && active.id === l.id;
                    return (
                      <button
                        type="button"
                        key={l.id}
                        onClick={() => navigateList(l.id, l.spaceId)}
                        className={cn(
                          "flex w-full items-center gap-3 border-l-2 px-4 py-2 text-left transition-colors",
                          isActive
                            ? "border-primary bg-primary/10"
                            : "border-transparent hover:bg-accent",
                        )}
                      >
                        <ListIcon className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{l.name}</p>
                          <p className="text-xs text-muted-foreground">{l.spaceName}</p>
                        </div>
                      </button>
                    );
                  })}
                </ResultSection>
              )}

              {results.spaces.length > 0 && (
                <ResultSection title="Projects" count={results.spaces.length}>
                  {results.spaces.map((s) => {
                    const isActive = active?.kind === "space" && active.id === s.id;
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => navigateSpace(s.id)}
                        className={cn(
                          "flex w-full items-center gap-3 border-l-2 px-4 py-2 text-left transition-colors",
                          isActive
                            ? "border-primary bg-primary/10"
                            : "border-transparent hover:bg-accent",
                        )}
                      >
                        <SquaresFourIcon
                          className="size-4 shrink-0"
                          style={{ color: s.color ?? undefined }}
                        />
                        <p className="truncate text-sm font-medium">{s.name}</p>
                      </button>
                    );
                  })}
                </ResultSection>
              )}

              {results.members.length > 0 && (
                <ResultSection title="Members" count={results.members.length}>
                  {results.members.map((m) => (
                    <div
                      key={m.userId}
                      className="flex w-full items-center gap-3 border-l-2 border-transparent px-4 py-2"
                    >
                      <UserAvatar name={m.name} email={m.email} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.name ?? m.email}</p>
                        {m.name && (
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        )}
                      </div>
                      <span className="text-2xs uppercase text-muted-foreground">
                        {m.role}
                      </span>
                    </div>
                  ))}
                </ResultSection>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-2xs text-muted-foreground">
          <FooterHint keys="↑↓" label="Navigate" />
          <FooterHint keys="Enter" label="Open" />
          <FooterHint keys="Esc" label="Close" />
          <FooterHint keys="Tab" label="Next filter" />
        </div>
      </div>
    </div>
  );
}

function ResultSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="py-2">
      <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title} <span className="text-muted-foreground/60">({count})</span>
      </p>
      {children}
    </section>
  );
}

function MoreFilterAccordionItem({
  value,
  label,
  count,
  children,
}: {
  value: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger className="py-2.5 text-xs font-semibold hover:no-underline">
        <span className="flex items-center gap-1.5">
          {label}
          {count > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold text-primary-foreground">
              {count}
            </span>
          )}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-2">{children}</AccordionContent>
    </AccordionItem>
  );
}

function FooterHint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-medium text-muted-foreground">
        {keys}
      </kbd>
      {label}
    </span>
  );
}

function recentFilterCount(r: RecentSearch): number {
  const f = r.filters;
  let n = 0;
  if (f.type && f.type !== "all") n++;
  if (f.statusType?.length) n++;
  if (f.priority?.length) n++;
  if (f.assignee?.length) n++;
  if (f.space?.length) n++;
  if (f.sprint?.length) n++;
  if (f.tags?.length) n++;
  if (f.due) n++;
  return n;
}
