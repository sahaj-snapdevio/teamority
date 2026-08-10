"use client";

import { CheckIcon, PlusIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addTaskToSprint,
  type BacklogTask,
  getBacklogTasks,
} from "@/app/actions/sprint";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AddTasksToSprintModalProps {
  listId?: string;
  onAdded: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  spaceId: string;
  sprintId: string;
  sprintName: string;
  workspaceId: string;
}

const PRIORITY_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  NONE: { label: "No Priority", color: "text-base-content/60", icon: "😴" },
  LOW: { label: "Low", color: "text-blue-500", icon: "🦥" },
  MEDIUM: { label: "Medium", color: "text-yellow-500", icon: "🚶" },
  HIGH: { label: "High", color: "text-orange-500", icon: "🏃" },
  URGENT: { label: "Urgent", color: "text-red-500", icon: "🚨" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AddTasksToSprintModal({
  open,
  onOpenChange,
  workspaceId,
  spaceId,
  listId: _listId,
  sprintId,
  sprintName,
  onAdded,
}: AddTasksToSprintModalProps) {
  const [tasks, setTasks] = useState<BacklogTask[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getBacklogTasks(workspaceId, spaceId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      // Flatten tasks from all list groups, preserving list order
      setTasks(result.lists.flatMap((l) => l.tasks));
    } catch {
      setError("Failed to load backlog tasks.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, spaceId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelected(new Set());
    setSearch("");
    setError(null);
    void loadTasks();
  }, [open, loadTasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return tasks;
    }
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) || String(t.seqNumber).includes(q)
    );
  }, [tasks, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((t) => t.id)));
    }
  }

  async function handleAdd() {
    if (selected.size === 0) {
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const ids = Array.from(selected);
      const results = await Promise.all(
        ids.map((taskId) =>
          addTaskToSprint(workspaceId, spaceId, sprintId, taskId)
        )
      );
      const failed = results.filter((r) => "error" in r);
      if (failed.length > 0) {
        setError(`${failed.length} task(s) could not be added.`);
      }
      onAdded();
      onOpenChange(false);
    } catch {
      setError("Failed to add tasks. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((t) => selected.has(t.id));

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle className="text-base">
            Add tasks to{" "}
            <span className="text-base-content/60 font-normal">
              {sprintName}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="min-w-0 w-full space-y-3 py-1">
          {/* Search */}
          <SearchInput
            autoFocus
            className="h-9 w-full rounded-md text-sm"
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            placeholder="Search backlog tasks…"
            value={search}
          />

          {/* Task list */}
          <div className="rounded-md border overflow-hidden">
            {loading ? (
              <div className="space-y-px p-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    className="h-10 rounded bg-base-200 animate-pulse"
                    key={i}
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-10 text-center">
                <p className="text-sm text-base-content/60">
                  {tasks.length === 0
                    ? "All tasks are already in a sprint"
                    : "No tasks match your search"}
                </p>
              </div>
            ) : (
              <div className="w-full max-h-80 overflow-y-auto overflow-x-hidden">
                {/* Select all header */}
                <button
                  className="flex w-full items-center gap-3 border-b bg-base-200/30 px-3 py-2 text-left hover:bg-base-200/50 transition-colors"
                  onClick={toggleAll}
                  type="button"
                >
                  {/* Visual indicator only — the row itself is the button, so a
                      real (button-based) Checkbox here would nest buttons. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-none border border-base-300 transition-colors",
                      allFilteredSelected &&
                        "border-primary bg-primary text-primary-content"
                    )}
                  >
                    {allFilteredSelected && (
                      <CheckIcon className="size-3" weight="bold" />
                    )}
                  </span>
                  <span className="text-xs font-medium text-base-content/60 uppercase tracking-wide">
                    {allFilteredSelected ? "Deselect all" : "Select all"} (
                    {filtered.length})
                  </span>
                </button>

                {filtered.map((task) => (
                  <button
                    className="flex w-full min-w-0 overflow-hidden items-center gap-3 px-3 py-2.5 text-left hover:bg-base-200/50 transition-colors border-b last:border-b-0"
                    key={task.id}
                    onClick={() => toggle(task.id)}
                    type="button"
                  >
                    {/* Visual indicator only — the row itself is the button, so a
                        real (button-based) Checkbox here would nest buttons. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-none border border-base-300 transition-colors",
                        selected.has(task.id) &&
                          "border-primary bg-primary text-primary-content"
                      )}
                    >
                      {selected.has(task.id) && (
                        <CheckIcon className="size-3" weight="bold" />
                      )}
                    </span>
                    <span className="font-mono text-xs text-base-content/60 shrink-0 w-8">
                      #{task.seqNumber}
                    </span>
                    <span className="flex-1 min-w-0 text-sm truncate">
                      {task.title}
                    </span>
                    {task.priority &&
                      task.priority !== "NONE" &&
                      (() => {
                        const cfg = PRIORITY_CONFIG[task.priority];
                        return cfg ? (
                          <span
                            className={`flex items-center gap-1 text-xs font-medium shrink-0 ${cfg.color}`}
                          >
                            <span>{cfg.icon}</span>
                            {cfg.label}
                          </span>
                        ) : null;
                      })()}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-md bg-error/10 px-3 py-2 text-sm text-error">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={adding}
            onClick={() => onOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={adding || selected.size === 0} onClick={handleAdd}>
            <PlusIcon className="size-3.5 mr-1.5" />
            {adding
              ? "Adding…"
              : `Add ${selected.size > 0 ? selected.size : ""} task${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
