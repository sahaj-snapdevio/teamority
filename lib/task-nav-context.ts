// Carries the "currently visible, ordered task ids" from a view (List/Board/
// Calendar/My Tasks/Search/...) across the full-page route transition into
// Task Detail, so Previous/Next can walk the same order the user was looking
// at without refetching or re-deriving it from the DB. Session-scoped and
// per-tab (sessionStorage), overwritten by whichever view opens a task next.
"use client";

export type TaskNavContext = {
  taskIds: string[];
  // My Tasks / Search span workspaces — maps a taskId to its owning
  // workspace when that differs from the workspace the task was opened from.
  workspaceByTaskId?: Record<string, string>;
};

const STORAGE_KEY = "kanbanica:taskNav";

export function setTaskNavContext(ctx: TaskNavContext): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    // Storage unavailable (private mode, quota) — Previous/Next just won't show.
  }
}

export function getTaskNavContext(): TaskNavContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as TaskNavContext;
    if (!parsed || !Array.isArray(parsed.taskIds)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
