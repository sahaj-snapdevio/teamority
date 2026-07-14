"use client";

import * as React from "react";
import {
  FloppyDiskIcon,
  TrashIcon,
  PencilSimpleIcon,
  CheckIcon,
} from "@phosphor-icons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FacetFilter } from "@/components/filters/facet-filter";
import { FilterChip } from "@/components/filters/filter-chip";
import {
  DUE_OPTIONS,
  PRIORITY_OPTIONS,
  type DueValue,
} from "@/lib/filters/options";
import type { FilterState, SavedFilterRow } from "@/app/actions/search";
import {
  getSavedFilters,
  createSavedFilter,
  deleteSavedFilter,
  renameSavedFilter,
} from "@/app/actions/search";

interface Status {
  id: string;
  name: string;
  color: string;
  type: string;
}

interface Member {
  userId: string;
  name: string | null;
  email: string | null;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface ListFilterToolbarProps {
  listId: string;
  statuses: Status[];
  members: Member[];
  tags: Tag[];
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

function activeCount(filters: FilterState): number {
  let n = 0;
  if (filters.status?.length) n++;
  if (filters.priority?.length) n++;
  if (filters.assignee?.length) n++;
  if (filters.due) n++;
  if (filters.tags?.length) n++;
  return n;
}

const EMPTY_FILTERS: FilterState = {};

export function ListFilterToolbar({
  listId,
  statuses,
  members,
  tags,
  filters,
  onChange,
}: ListFilterToolbarProps) {
  const [savedFilters, setSavedFilters] = React.useState<SavedFilterRow[]>([]);
  const [saveName, setSaveName] = React.useState("");
  const [savingOpen, setSavingOpen] = React.useState(false);
  const [renameId, setRenameId] = React.useState<string | null>(null);
  const [renameName, setRenameName] = React.useState("");

  const count = activeCount(filters);

  React.useEffect(() => {
    getSavedFilters(listId).then((res) => {
      if (!("error" in res)) setSavedFilters(res);
    });
  }, [listId]);

  async function handleSave() {
    if (!saveName.trim()) return;
    const res = await createSavedFilter(listId, saveName.trim(), filters);
    if (!("error" in res)) {
      const updated = await getSavedFilters(listId);
      if (!("error" in updated)) setSavedFilters(updated);
    }
    setSaveName("");
    setSavingOpen(false);
  }

  async function handleDelete(id: string) {
    await deleteSavedFilter(id);
    setSavedFilters((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleRename(id: string) {
    if (!renameName.trim()) return;
    await renameSavedFilter(id, renameName.trim());
    setSavedFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: renameName.trim() } : f)),
    );
    setRenameId(null);
    setRenameName("");
  }

  const assigneeOptions = [
    { value: "unassigned", label: "Unassigned" },
    ...members.map((m) => ({
      value: m.userId,
      label: m.name ?? m.email ?? "Unknown",
    })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Shared faceted filters */}
      <FacetFilter
        label="Status"
        options={statuses.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
        selected={filters.status ?? []}
        onChange={(next) => onChange({ ...filters, status: next })}
      />
      <FacetFilter
        label="Priority"
        options={PRIORITY_OPTIONS}
        selected={filters.priority ?? []}
        onChange={(next) => onChange({ ...filters, priority: next })}
      />
      <FacetFilter
        label="Due"
        single
        options={DUE_OPTIONS}
        selected={filters.due ? [filters.due] : []}
        onChange={(next) => onChange({ ...filters, due: (next[0] as DueValue) ?? "" })}
      />
      {members.length > 0 && (
        <FacetFilter
          label="Assignee"
          searchable
          options={assigneeOptions}
          selected={filters.assignee ?? []}
          onChange={(next) => onChange({ ...filters, assignee: next })}
        />
      )}
      {tags.length > 0 && (
        <FacetFilter
          label="Tags"
          searchable
          options={tags.map((t) => ({ value: t.id, label: t.name, color: t.color }))}
          selected={filters.tags ?? []}
          onChange={(next) => onChange({ ...filters, tags: next })}
        />
      )}

      {/* Saved filters */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-8 shrink-0 select-none items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <FloppyDiskIcon className="size-3.5" /> Saved
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-3 rounded-xl p-3">
          {savedFilters.length > 0 ? (
            <div className="space-y-1">
              {savedFilters.map((sf) => (
                <div key={sf.id} className="flex items-center gap-1">
                  {renameId === sf.id ? (
                    <>
                      <input
                        autoFocus
                        value={renameName}
                        onChange={(e) => setRenameName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRename(sf.id);
                          if (e.key === "Escape") setRenameId(null);
                        }}
                        className="flex-1 rounded border px-1.5 py-0.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => void handleRename(sf.id)}
                        className="text-primary hover:opacity-70"
                      >
                        <CheckIcon className="size-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onChange(sf.filters as FilterState)}
                        className="flex-1 rounded px-1.5 py-0.5 text-left text-xs transition-colors hover:bg-accent"
                      >
                        {sf.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenameId(sf.id);
                          setRenameName(sf.name);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <PencilSimpleIcon className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(sf.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <TrashIcon className="size-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No saved filters yet.</p>
          )}

          {count > 0 &&
            (savingOpen ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  placeholder="Filter name…"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSave();
                    if (e.key === "Escape") setSavingOpen(false);
                  }}
                  className="flex-1 rounded border px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!saveName.trim()}
                  className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSavingOpen(true)}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
              >
                <FloppyDiskIcon className="size-3.5" /> Save these filters
              </button>
            ))}
        </PopoverContent>
      </Popover>

      {/* Active filter chips */}
      {filters.status?.map((sId) => {
        const s = statuses.find((st) => st.id === sId);
        if (!s) return null;
        return (
          <FilterChip
            key={sId}
            label={`Status: ${s.name}`}
            onRemove={() =>
              onChange({ ...filters, status: filters.status?.filter((id) => id !== sId) })
            }
          />
        );
      })}

      {filters.priority?.map((p) => (
        <FilterChip
          key={p}
          label={`Priority: ${p.charAt(0) + p.slice(1).toLowerCase()}`}
          onRemove={() =>
            onChange({ ...filters, priority: filters.priority?.filter((v) => v !== p) })
          }
        />
      ))}

      {filters.due && (
        <FilterChip
          label={`Due: ${DUE_OPTIONS.find((d) => d.value === filters.due)?.label ?? filters.due}`}
          onRemove={() => onChange({ ...filters, due: "" })}
        />
      )}

      {filters.assignee?.map((aId) => {
        const m = members.find((mb) => mb.userId === aId);
        const label = aId === "unassigned" ? "Unassigned" : (m?.name ?? m?.email ?? aId);
        return (
          <FilterChip
            key={aId}
            label={`Assignee: ${label}`}
            onRemove={() =>
              onChange({ ...filters, assignee: filters.assignee?.filter((id) => id !== aId) })
            }
          />
        );
      })}

      {filters.tags?.map((tId) => {
        const t = tags.find((tg) => tg.id === tId);
        if (!t) return null;
        return (
          <FilterChip
            key={tId}
            label={`Tag: ${t.name}`}
            onRemove={() =>
              onChange({ ...filters, tags: filters.tags?.filter((id) => id !== tId) })
            }
          />
        );
      })}

      {count > 1 && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="h-7 rounded-full border border-destructive/30 px-2.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
        >
          Clear All
        </button>
      )}
    </div>
  );
}
