import * as React from "react";

// Lightweight cross-component signal for briefly highlighting a task row/card
// right after "Duplicate Task" creates it, so the user can spot the copy that
// was just inserted below the original. This project has no Zustand — it's a
// dependency-free module-level store consumed via useSyncExternalStore.

const HIGHLIGHT_MS = 2500;

let highlightedId: string | null = null;
let clearTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Flash the given task id. The highlight auto-clears after a short window; a
// newer flash supersedes any pending one.
export function flashDuplicatedTask(id: string) {
  highlightedId = id;
  if (clearTimer) {
    clearTimeout(clearTimer);
  }
  clearTimer = setTimeout(() => {
    highlightedId = null;
    clearTimer = null;
    emit();
  }, HIGHLIGHT_MS);
  emit();
}

export function useIsDuplicateHighlighted(id: string): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => highlightedId === id,
    () => false
  );
}
