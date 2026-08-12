"use client";

import {
  CaretDownIcon,
  FunnelIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react";
import * as React from "react";
import { FacetOptionList } from "@/components/filters/facet-filter";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface FilterBuilderField {
  key: string;
  label: string;
}

// Single, compact "Filters" entry point — the alternative to giving every
// field its own always-visible toolbar button, which doesn't scale once a
// workspace has more than a handful of custom fields. Generic over whatever
// `fields` the caller passes in, but callers should exclude any field that
// already has its own dedicated toolbar button (Status/Priority/Assignee) so
// this stays the "custom + future advanced fields" picker rather than
// duplicating those — see list-view.tsx / board-view.tsx's `filterFields`.
// Callers keep owning the actual filter state (customFieldFilters, …); this
// component only decides which fields' controls are currently shown and lets
// the user pick more from a searchable list. `renderControl` gets to reuse
// each field's existing control (CustomFieldFilterControl) verbatim — this is
// a picker shell around those, not a second filter-control implementation.
export function FilterBuilder({
  fields,
  isActive,
  renderControl,
  onClear,
}: {
  fields: FilterBuilderField[];
  isActive: (key: string) => boolean;
  renderControl: (key: string) => React.ReactNode;
  onClear: (key: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  // Fields the user has opened a row for this session but hasn't picked a
  // value yet — not persisted (nothing to remember: once a value is set the
  // field shows up via `isActive` on its own).
  const [pendingKeys, setPendingKeys] = React.useState<string[]>([]);

  const activeKeys = React.useMemo(
    () => fields.filter((f) => isActive(f.key)).map((f) => f.key),
    [fields, isActive]
  );

  const visibleKeys = React.useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const key of [...activeKeys, ...pendingKeys]) {
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(key);
      }
    }
    return ordered;
  }, [activeKeys, pendingKeys]);

  const availableToAdd = fields.filter((f) => !visibleKeys.includes(f.key));

  function handleClear(key: string) {
    onClear(key);
    setPendingKeys((prev) => prev.filter((k) => k !== key));
  }

  function handleClearAll() {
    for (const key of visibleKeys) {
      onClear(key);
    }
    setPendingKeys([]);
  }

  const addFilterButton = availableToAdd.length > 0 && (
    <Popover onOpenChange={setAddOpen} open={addOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-base-200"
          type="button"
        >
          <PlusIcon className="size-3.5" />
          Add filter
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1.5" side="right">
        <FacetOptionList
          emptyText="No fields"
          onChange={(next) => {
            const key = next[0];
            if (key) {
              setPendingKeys((prev) =>
                prev.includes(key) ? prev : [...prev, key]
              );
            }
            setAddOpen(false);
          }}
          options={availableToAdd.map((f) => ({
            value: f.key,
            label: f.label,
          }))}
          searchable
          searchPlaceholder="Search fields…"
          selected={[]}
          single
        />
      </PopoverContent>
    </Popover>
  );

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex h-8 shrink-0 select-none items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors",
            activeKeys.length > 0
              ? "border-primary bg-primary/10 text-primary"
              : "border-base-300 text-base-content/60 hover:bg-base-200 hover:text-base-content"
          )}
          type="button"
        >
          <FunnelIcon className="size-3.5" />
          More Filters
          {activeKeys.length > 0 && (
            <span className="font-bold">({activeKeys.length})</span>
          )}
          <CaretDownIcon className="size-3 opacity-60" />
        </button>
      </PopoverTrigger>
      {/* Fixed-height shell: the header never scrolls (it sits outside the
          scroll container, which is equivalent to "sticky" here but doesn't
          depend on scroll-position math), only the filter list below it does.
          max-h caps the popover so it can never grow past ~75% of the
          viewport no matter how many filters are added. */}
      <PopoverContent
        align="start"
        className="flex max-h-[75vh] w-72 flex-col overflow-hidden rounded-xl p-0"
      >
        <div className="flex shrink-0 flex-col gap-1.5 border-b border-base-300 p-2">
          <p className="px-1 text-2xs font-bold uppercase tracking-wide text-base-content/60">
            More Filters
          </p>
          <div className="flex items-center justify-between gap-2">
            {addFilterButton || <span />}
            {visibleKeys.length > 0 && (
              <button
                className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-base-content/60 hover:bg-base-200 hover:text-base-content"
                onClick={handleClearAll}
                type="button"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
        {/* overscroll-contain keeps a scroll-wheel fling from "chaining" past
            the end of this list into the page behind the popover. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {visibleKeys.length === 0 ? (
            <p className="px-1 py-1 text-xs text-base-content/60">
              No filters yet — add one above.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {visibleKeys.map((key) => {
                const field = fields.find((f) => f.key === key);
                if (!field) {
                  return null;
                }
                return (
                  <div
                    className="rounded-lg border border-base-300 p-2"
                    key={key}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">
                        {field.label}
                      </span>
                      <button
                        className="flex size-5 shrink-0 items-center justify-center rounded text-base-content/60 hover:bg-base-200 hover:text-base-content"
                        onClick={() => handleClear(key)}
                        type="button"
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </div>
                    {renderControl(key)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
