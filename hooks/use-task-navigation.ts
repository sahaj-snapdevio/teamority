"use client";

import * as React from "react";
import { getTaskNavContext } from "@/lib/task-nav-context";

export type TaskNavigation =
  | {
      available: true;
      position: number;
      total: number;
      prevId: string | null;
      nextId: string | null;
      workspaceIdFor: (taskId: string) => string | undefined;
    }
  | {
      available: false;
      position: null;
      total: null;
      prevId: null;
      nextId: null;
      workspaceIdFor: (taskId: string) => string | undefined;
    };

// Reads the nav context once per mount — a fresh mount only happens when a
// view navigates in from outside Task Detail (which is exactly when it wrote
// a new context, right before the push). In-page moves between tasks (Prev/
// Next, subtask, parent) reuse the same mount, so the stored order stays put
// and only the derived index below needs to change. Task Detail renders a
// skeleton (which ignores this hook's result) until data loads, so the
// server-render-null vs. client-real-value gap on first read never reaches
// the DOM as a hydration mismatch.
export function useTaskNavigation(taskId: string): TaskNavigation {
  const [ctx] = React.useState(() => getTaskNavContext());

  return React.useMemo(() => {
    const workspaceIdFor = (id: string) => ctx?.workspaceByTaskId?.[id];
    const index = ctx?.taskIds.indexOf(taskId) ?? -1;
    if (!ctx || index === -1) {
      return {
        available: false,
        position: null,
        total: null,
        prevId: null,
        nextId: null,
        workspaceIdFor,
      } as const;
    }
    return {
      available: true,
      position: index + 1,
      total: ctx.taskIds.length,
      prevId: index > 0 ? ctx.taskIds[index - 1] : null,
      nextId: index < ctx.taskIds.length - 1 ? ctx.taskIds[index + 1] : null,
      workspaceIdFor,
    } as const;
  }, [ctx, taskId]);
}
