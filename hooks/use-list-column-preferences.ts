"use client";

import * as React from "react";

export interface ListColumnOption {
  id: string;
  label: string;
}

function storageKey(listId: string) {
  return `kanbanica:list-columns:${listId}`;
}

function loadVisibleIds(listId: string): string[] | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(listId));
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

// Generic per-list column show/hide preference, deliberately decoupled from
// `list-view.tsx`'s own `ListViewPrefs` (Group By/Sort/Filters) blob — this
// hook has no dependency on the List View and can be reused unchanged by a
// future Board/Table view. `columns` is whatever the caller currently offers
// (today: custom fields only); a later PR can prepend built-in columns
// (Priority, Due Date, Assignee, Tags) to that same array without any change
// here — the hook only ever deals in generic `{id, label}` options.
//
// New/unseen column ids default to hidden (an empty initial allow-list), so a
// custom field created after the user's last visit — or a future built-in
// column added to `columns` — starts hidden without any extra logic.
export function useListColumnPreferences(
  listId: string,
  columns: ListColumnOption[]
) {
  const [visibleIds, setVisibleIds] = React.useState<string[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const stored = loadVisibleIds(listId);
    setVisibleIds(stored ?? []);
    setHydrated(true);
  }, [listId]);

  React.useEffect(() => {
    if (!hydrated) {
      return;
    }
    try {
      window.localStorage.setItem(
        storageKey(listId),
        JSON.stringify(visibleIds)
      );
    } catch {
      // ignore quota / disabled storage
    }
  }, [hydrated, listId, visibleIds]);

  // Drop ids for columns that no longer exist (field archived/deleted) so the
  // stored preference doesn't grow stale entries forever.
  const validIds = React.useMemo(
    () => new Set(columns.map((c) => c.id)),
    [columns]
  );
  const visible = React.useMemo(
    () => visibleIds.filter((id) => validIds.has(id)),
    [visibleIds, validIds]
  );

  return {
    visibleIds: visible,
    setVisibleIds,
    isVisible: (id: string) => visible.includes(id),
  };
}
