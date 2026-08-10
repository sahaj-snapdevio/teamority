"use client";

import {
  CheckIcon,
  FloppyDiskIcon,
  PencilSimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import * as React from "react";
import type { FilterState, SavedFilterRow } from "@/app/actions/search";
import {
  createSavedFilter,
  deleteSavedFilter,
  getSavedFilters,
  renameSavedFilter,
} from "@/app/actions/search";
import { FacetFilter } from "@/components/filters/facet-filter";
import { FilterChip } from "@/components/filters/filter-chip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DUE_OPTIONS,
  type DueValue,
  PRIORITY_OPTIONS,
} from "@/lib/filters/options";

interface Status {
  color: string;
  id: string;
  name: string;
  type: string;
}

interface Member {
  email: string | null;
  name: string | null;
  userId: string;
}

interface Tag {
  color: string;
  id: string;
  name: string;
}

interface ListFilterToolbarProps {
  filters: FilterState;
  listId: string;
  members: Member[];
  onChange: (f: FilterState) => void;
  statuses: Status[];
  tags: Tag[];
}

function activeCount(filters: FilterState): number {
  let n = 0;
  if (filters.status?.length) {
    n++;
  }
  if (filters.priority?.length) {
    n++;
  }
  if (filters.assignee?.length) {
    n++;
  }
  if (filters.due) {
    n++;
  }
  if (filters.tags?.length) {
    n++;
  }
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
      if (!("error" in res)) {
        setSavedFilters(res);
      }
    });
  }, [listId]);

  async function handleSave() {
    if (!saveName.trim()) {
      return;
    }
    const res = await createSavedFilter(listId, saveName.trim(), filters);
    if (!("error" in res)) {
      const updated = await getSavedFilters(listId);
      if (!("error" in updated)) {
        setSavedFilters(updated);
      }
    }
    setSaveName("");
    setSavingOpen(false);
  }

  async function handleDelete(id: string) {
    await deleteSavedFilter(id);
    setSavedFilters((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleRename(id: string) {
    if (!renameName.trim()) {
      return;
    }
    await renameSavedFilter(id, renameName.trim());
    setSavedFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: renameName.trim() } : f))
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
        onChange={(next) => onChange({ ...filters, status: next })}
        options={statuses.map((s) => ({
          value: s.id,
          label: s.name,
          color: s.color,
        }))}
        selected={filters.status ?? []}
      />
      <FacetFilter
        label="Priority"
        onChange={(next) => onChange({ ...filters, priority: next })}
        options={PRIORITY_OPTIONS}
        selected={filters.priority ?? []}
      />
      <FacetFilter
        label="Due"
        onChange={(next) =>
          onChange({ ...filters, due: (next[0] as DueValue) ?? "" })
        }
        options={DUE_OPTIONS}
        selected={filters.due ? [filters.due] : []}
        single
      />
      {members.length > 0 && (
        <FacetFilter
          label="Assignee"
          onChange={(next) => onChange({ ...filters, assignee: next })}
          options={assigneeOptions}
          searchable
          selected={filters.assignee ?? []}
        />
      )}
      {tags.length > 0 && (
        <FacetFilter
          label="Tags"
          onChange={(next) => onChange({ ...filters, tags: next })}
          options={tags.map((t) => ({
            value: t.id,
            label: t.name,
            color: t.color,
          }))}
          searchable
          selected={filters.tags ?? []}
        />
      )}

      {/* Saved filters */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className="flex h-8 shrink-0 select-none items-center gap-1.5 rounded-md border border-base-300 px-2.5 text-xs font-semibold text-base-content/60 transition-colors hover:bg-base-200 hover:text-base-content"
            type="button"
          >
            <FloppyDiskIcon className="size-3.5" /> Saved
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-3 rounded-xl p-3">
          {savedFilters.length > 0 ? (
            <div className="space-y-1">
              {savedFilters.map((sf) => (
                <div className="flex items-center gap-1" key={sf.id}>
                  {renameId === sf.id ? (
                    <>
                      <input
                        autoFocus
                        className="flex-1 rounded border px-1.5 py-0.5 text-xs"
                        onChange={(e) => setRenameName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            void handleRename(sf.id);
                          }
                          if (e.key === "Escape") {
                            setRenameId(null);
                          }
                        }}
                        value={renameName}
                      />
                      <button
                        className="text-primary hover:opacity-70"
                        onClick={() => void handleRename(sf.id)}
                        type="button"
                      >
                        <CheckIcon className="size-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="flex-1 rounded px-1.5 py-0.5 text-left text-xs transition-colors hover:bg-base-200"
                        onClick={() => onChange(sf.filters as FilterState)}
                        type="button"
                      >
                        {sf.name}
                      </button>
                      <button
                        className="text-base-content/60 hover:text-base-content"
                        onClick={() => {
                          setRenameId(sf.id);
                          setRenameName(sf.name);
                        }}
                        type="button"
                      >
                        <PencilSimpleIcon className="size-3" />
                      </button>
                      <button
                        className="text-base-content/60 hover:text-error"
                        onClick={() => void handleDelete(sf.id)}
                        type="button"
                      >
                        <TrashIcon className="size-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-base-content/60">
              No saved filters yet.
            </p>
          )}

          {count > 0 &&
            (savingOpen ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  className="flex-1 rounded border px-2 py-1 text-xs"
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void handleSave();
                    }
                    if (e.key === "Escape") {
                      setSavingOpen(false);
                    }
                  }}
                  placeholder="Filter name…"
                  value={saveName}
                />
                <button
                  className="rounded bg-primary px-2 py-1 text-xs text-primary-content disabled:opacity-40"
                  disabled={!saveName.trim()}
                  onClick={() => void handleSave()}
                  type="button"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs text-base-content/60 transition-colors hover:bg-base-200"
                onClick={() => setSavingOpen(true)}
                type="button"
              >
                <FloppyDiskIcon className="size-3.5" /> Save these filters
              </button>
            ))}
        </PopoverContent>
      </Popover>

      {/* Active filter chips */}
      {filters.status?.map((sId) => {
        const s = statuses.find((st) => st.id === sId);
        if (!s) {
          return null;
        }
        return (
          <FilterChip
            key={sId}
            label={`Status: ${s.name}`}
            onRemove={() =>
              onChange({
                ...filters,
                status: filters.status?.filter((id) => id !== sId),
              })
            }
          />
        );
      })}

      {filters.priority?.map((p) => (
        <FilterChip
          key={p}
          label={`Priority: ${p.charAt(0) + p.slice(1).toLowerCase()}`}
          onRemove={() =>
            onChange({
              ...filters,
              priority: filters.priority?.filter((v) => v !== p),
            })
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
        const label =
          aId === "unassigned" ? "Unassigned" : (m?.name ?? m?.email ?? aId);
        return (
          <FilterChip
            key={aId}
            label={`Assignee: ${label}`}
            onRemove={() =>
              onChange({
                ...filters,
                assignee: filters.assignee?.filter((id) => id !== aId),
              })
            }
          />
        );
      })}

      {filters.tags?.map((tId) => {
        const t = tags.find((tg) => tg.id === tId);
        if (!t) {
          return null;
        }
        return (
          <FilterChip
            key={tId}
            label={`Tag: ${t.name}`}
            onRemove={() =>
              onChange({
                ...filters,
                tags: filters.tags?.filter((id) => id !== tId),
              })
            }
          />
        );
      })}

      {count > 1 && (
        <button
          className="h-7 rounded-full border border-error/30 px-2.5 text-xs text-error transition-colors hover:bg-error/10"
          onClick={() => onChange(EMPTY_FILTERS)}
          type="button"
        >
          Clear All
        </button>
      )}
    </div>
  );
}
