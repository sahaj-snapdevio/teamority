"use client";

import * as React from "react";
import { CaretDownIcon, CheckIcon, PlusIcon } from "@phosphor-icons/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toggle } from "@/lib/filters/options";

export type FacetOption = {
  value: string;
  label: string;
  /** Optional color dot (statuses, tags). */
  color?: string;
  /** Optional leading node (avatar, emoji icon). */
  icon?: React.ReactNode;
};

/**
 * The option list (with optional search + clear). Shared by FacetFilter (inside
 * its Popover) and any panel that needs the same list inline — e.g. the omnibox
 * "More filters" panel — so the list rendering lives in one place.
 *
 * `single` isn't just about the click behaviour: it also switches the indicator
 * from a square checkbox to a round radio, so a field that holds exactly one
 * value (Priority, Status, a SINGLE_SELECT custom field) never reads as a
 * multi-select.
 */
export function FacetOptionList({
  options,
  selected,
  onChange,
  single = false,
  searchable = false,
  emptyText = "No options",
  onAfterToggle,
  onCreate,
  searchPlaceholder = "Search…",
  clearLabel = "Clear",
  showClearDivider = false,
  maxListHeight,
}: {
  options: FacetOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  single?: boolean;
  searchable?: boolean;
  emptyText?: string;
  onAfterToggle?: () => void;
  /** When set, an unmatched search query offers a "Create <query>" action. */
  onCreate?: (label: string) => void;
  /** Placeholder for the search input (only rendered when `searchable`). */
  searchPlaceholder?: string;
  /** Label for the "clear all" action shown once something is selected. */
  clearLabel?: string;
  /** Adds a divider above the clear action, separating it as a footer. */
  showClearDivider?: boolean;
  /** Fixed max-height (with scroll) for the option list, overriding the default item-count heuristic. */
  maxListHeight?: string;
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const trimmedQuery = query.trim();
  const hasExactMatch = options.some(
    (o) => o.label.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const canCreate = !!onCreate && trimmedQuery.length > 0 && !hasExactMatch;

  function handleToggle(value: string) {
    onChange(single ? (selected.includes(value) ? [] : [value]) : toggle(selected, value));
    onAfterToggle?.();
  }

  function handleCreate() {
    if (!onCreate || !trimmedQuery) {
      return;
    }
    onCreate(trimmedQuery);
    setQuery("");
  }

  return (
    <div>
      {searchable && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="mb-1 w-full rounded-md border border-base-300 bg-base-100 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}
      <div
        className={cn(
          "space-y-0.5",
          maxListHeight ? "overflow-y-auto" : filtered.length > 8 && "max-h-56 overflow-y-auto",
        )}
        style={maxListHeight ? { maxHeight: maxListHeight } : undefined}
      >
        {filtered.length === 0 ? (
          canCreate ? null : (
            <p className="px-2 py-1.5 text-xs text-base-content/60">
              {emptyText}
            </p>
          )
        ) : (
          filtered.map((o) => {
            const active = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={active}
                onClick={() => handleToggle(o.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-base-200"
              >
                {/* Visual indicator only — the row itself is the button, so a
                    real (button-based) Checkbox/Radio here would nest buttons.
                    Round dot for single-select, square tick for multi. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center border border-base-300 transition-colors",
                    single ? "rounded-full" : "rounded-none",
                    active && "border-primary bg-primary text-primary-content",
                  )}
                >
                  {active &&
                    (single ? (
                      <span className="size-1.5 rounded-full bg-primary-content" />
                    ) : (
                      <CheckIcon className="size-3" weight="bold" />
                    ))}
                </span>
                {o.icon}
                {o.color && (
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: o.color }}
                  />
                )}
                <span className="flex-1 truncate">{o.label}</span>
              </button>
            );
          })
        )}
        {canCreate && (
          <button
            type="button"
            onClick={handleCreate}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-primary hover:bg-base-200"
          >
            <PlusIcon className="size-3.5 shrink-0" />
            <span className="truncate">Create “{trimmedQuery}”</span>
          </button>
        )}
      </div>
      {selected.length > 0 && !single && (
        <>
          {showClearDivider && <div className="my-1 h-px bg-border" />}
          <button
            type="button"
            onClick={() => onChange([])}
            className="mt-1 w-full rounded-md px-2 py-1 text-center text-xs text-base-content/60 hover:bg-base-200"
          >
            {clearLabel}
          </button>
        </>
      )}
    </div>
  );
}

interface FacetFilterProps {
  label: string;
  icon?: React.ReactNode;
  options: FacetOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Single-select (radio-like) — e.g. Type, Due. Default multi-select. */
  single?: boolean;
  /** Show a search box to filter long option lists. */
  searchable?: boolean;
  align?: "start" | "center" | "end";
  emptyText?: string;
  className?: string;
}

/**
 * One reusable faceted-filter control: a chip trigger + a Popover checkbox list.
 * Used by the list/board filter toolbars and the search omnibox so there is a
 * single filter-dropdown implementation across the app.
 */
export function FacetFilter({
  label,
  icon,
  options,
  selected,
  onChange,
  single = false,
  searchable = false,
  align = "start",
  emptyText = "No options",
  className,
}: FacetFilterProps) {
  const [open, setOpen] = React.useState(false);

  const count = selected.length;
  const summary =
    single && count === 1
      ? options.find((o) => o.value === selected[0])?.label ?? null
      : count > 0
        ? `(${count})`
        : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 shrink-0 select-none items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors",
            count > 0
              ? "border-primary bg-primary/10 text-primary"
              : "border-base-300 text-base-content/60 hover:bg-base-200 hover:text-base-content",
            className,
          )}
        >
          {icon}
          {label}
          {summary && <span className="font-bold">{summary}</span>}
          <CaretDownIcon className="size-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-56 rounded-xl p-1.5">
        <FacetOptionList
          options={options}
          selected={selected}
          onChange={onChange}
          single={single}
          searchable={searchable}
          emptyText={emptyText}
          onAfterToggle={() => {
            if (single) setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
