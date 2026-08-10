"use client";

import { XIcon } from "@phosphor-icons/react";

/**
 * Active-filter chip with a remove button. Shared by the list/board filter
 * toolbars and the search omnibox (extracted from ListFilterToolbar).
 */
export function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 py-0.5 pl-2.5 pr-1.5 text-xs text-primary">
      {label}
      <button
        aria-label={`Remove ${label}`}
        className="transition-colors hover:text-primary/60"
        onClick={onRemove}
        type="button"
      >
        <XIcon className="size-3" />
      </button>
    </span>
  );
}
