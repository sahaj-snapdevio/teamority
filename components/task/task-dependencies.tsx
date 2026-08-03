"use client";

import {
  CheckCircleIcon,
  LinkIcon,
  PlusIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import {
  addDependency,
  removeDependency,
  searchTasksForDependency,
} from "@/app/actions/task-dependency";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

// A single dependency edge as seen from the current task. `taskId` is the
// *other* task (the one this task is blocked by / blocks).
export type TaskDependencyRow = {
  id: string;
  taskId: string;
  seqNumber: number;
  title: string;
  statusName: string | null;
  statusColor: string | null;
  statusType: "OPEN" | "ACTIVE" | "CLOSED" | null;
  spaceId: string | null;
  spaceName: string | null;
  listId: string | null;
  listName: string | null;
};

type SearchResult = {
  id: string;
  title: string;
  seqNumber: number;
  statusId: string | null;
  spaceId: string | null;
  listId: string | null;
};

type Direction = "depends" | "blocks";

const FALLBACK_STATUS_COLOR = "#6B7280";

export function TaskDependencies({
  workspaceId,
  spaceId,
  listId,
  taskId,
  blockedBy,
  blocks,
  canEdit,
  onChanged,
  hideHeader = false,
}: {
  workspaceId: string;
  spaceId: string;
  listId: string;
  taskId: string;
  blockedBy: TaskDependencyRow[];
  blocks: TaskDependencyRow[];
  canEdit: boolean;
  onChanged: () => void;
  /** Hide the built-in "Dependencies" heading (when a parent section supplies it). */
  hideHeader?: boolean;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);

  const hasAny = blockedBy.length > 0 || blocks.length > 0;

  // Summary reflects the tasks *this* task waits on (its blockers).
  const incompleteBlockers = blockedBy.filter((d) => d.statusType !== "CLOSED");

  function openTask(row: TaskDependencyRow) {
    router.push(`/${workspaceId}/task/${row.taskId}`);
  }

  async function handleRemove(row: TaskDependencyRow, section: Direction) {
    // A "blocks" edge is owned by the other task, so remove it in that task's
    // context; a "blocked by" edge is owned by the current task.
    const res =
      section === "blocks"
        ? await removeDependency(
            workspaceId,
            row.spaceId ?? spaceId,
            row.listId ?? listId,
            row.id,
            row.taskId
          )
        : await removeDependency(workspaceId, spaceId, listId, row.id, taskId);
    if (res && "error" in res) {
      toast.error(res.error);
      return;
    }
    onChanged();
  }

  return (
    <div>
      {!hideHeader && (
        <div className="mb-2 flex items-center gap-2">
          <LinkIcon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Dependencies</h3>
        </div>
      )}

      {/* Status summary — a subtle pill, only shown when this task is blocked */}
      {blockedBy.length > 0 && (
        <div className="mb-3">
          {incompleteBlockers.length === 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <CheckCircleIcon className="size-3.5" weight="fill" />
              Ready to start
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <WarningIcon className="size-3.5" weight="fill" />
              Waiting on {incompleteBlockers.length} task
              {incompleteBlockers.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}

      {hasAny ? (
        <div className="space-y-4">
          {blockedBy.length > 0 && (
            <DependencyGroup
              canEdit={canEdit}
              onOpen={openTask}
              onRemove={(row) => handleRemove(row, "depends")}
              rows={blockedBy}
              title="Blocked by"
            />
          )}
          {blocks.length > 0 && (
            <DependencyGroup
              canEdit={canEdit}
              onOpen={openTask}
              onRemove={(row) => handleRemove(row, "blocks")}
              rows={blocks}
              title="Blocks"
            />
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No dependencies added yet.
        </p>
      )}

      {canEdit && (
        <button
          className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setAddOpen(true)}
          type="button"
        >
          <PlusIcon className="size-3.5" />
          Add dependency
        </button>
      )}

      {addOpen && (
        <AddDependencyDialog
          blockedBy={blockedBy}
          blocks={blocks}
          listId={listId}
          onChanged={onChanged}
          onOpenChange={setAddOpen}
          spaceId={spaceId}
          taskId={taskId}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
}

function DependencyGroup({
  title,
  rows,
  canEdit,
  onOpen,
  onRemove,
}: {
  title: string;
  rows: TaskDependencyRow[];
  canEdit: boolean;
  onOpen: (row: TaskDependencyRow) => void;
  onRemove: (row: TaskDependencyRow) => void;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs text-muted-foreground">
        {title}
      </Label>
      <div className="space-y-1">
        {rows.map((row) => (
          <div
            className="group flex items-center gap-2 rounded-md border px-2.5 py-1.5"
            key={row.id}
          >
            <button
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              onClick={() => onOpen(row)}
              type="button"
            >
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                #{row.seqNumber}
              </span>
              <span className="truncate text-sm">{row.title}</span>
            </button>
            <StatusBadge color={row.statusColor} name={row.statusName} />
            <span className="hidden shrink-0 truncate text-2xs text-muted-foreground sm:inline">
              {[row.spaceName, row.listName].filter(Boolean).join(" › ")}
            </span>
            {canEdit && (
              <button
                aria-label="Remove dependency"
                className="flex size-5 shrink-0 items-center justify-center rounded text-destructive opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                onClick={() => onRemove(row)}
                type="button"
              >
                <XIcon className="size-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({
  name,
  color,
}: {
  name: string | null;
  color: string | null;
}) {
  if (!name) {
    return null;
  }
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className="size-2 rounded-full"
        style={{ backgroundColor: color ?? FALLBACK_STATUS_COLOR }}
      />
      {name}
    </span>
  );
}

function AddDependencyDialog({
  workspaceId,
  spaceId,
  listId,
  taskId,
  blockedBy,
  blocks,
  onOpenChange,
  onChanged,
}: {
  workspaceId: string;
  spaceId: string;
  listId: string;
  taskId: string;
  blockedBy: TaskDependencyRow[];
  blocks: TaskDependencyRow[];
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [direction, setDirection] = React.useState<Direction>("depends");
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  // Tasks already related in either direction — never offer them again.
  const excluded = React.useMemo(() => {
    const ids = new Set<string>([taskId]);
    for (const d of blockedBy) {
      ids.add(d.taskId);
    }
    for (const d of blocks) {
      ids.add(d.taskId);
    }
    return ids;
  }, [taskId, blockedBy, blocks]);

  // Load tasks whenever the query changes — including on open (empty query),
  // which returns a recent-tasks quick-pick list so no typing is required.
  React.useEffect(() => {
    let active = true;
    searchTasksForDependency(workspaceId, spaceId, query, taskId).then(
      (res) => {
        if (active && "tasks" in res) {
          setResults((res.tasks ?? []).filter((t) => !excluded.has(t.id)));
        }
      }
    );
    return () => {
      active = false;
    };
  }, [query, workspaceId, spaceId, taskId, excluded]);

  async function handleSelect(result: SearchResult) {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    // "depends" → this task depends on the picked one (this is blocked by it).
    // "blocks"  → the picked task depends on this one (this task blocks it),
    // so the edge is created in the picked task's context.
    const res =
      direction === "depends"
        ? await addDependency(workspaceId, spaceId, listId, taskId, result.id)
        : await addDependency(
            workspaceId,
            result.spaceId ?? spaceId,
            result.listId ?? listId,
            result.id,
            taskId
          );
    setSubmitting(false);
    if (res && "error" in res) {
      toast.error(res.error);
      return;
    }
    onOpenChange(false);
    onChanged();
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add dependency</DialogTitle>
          <DialogDescription>
            Link this task to another one in the workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">This task…</Label>
          <RadioGroup
            className="gap-2"
            onValueChange={(v) => setDirection(v as Direction)}
            value={direction}
          >
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                direction === "depends" ? "border-primary" : "hover:bg-accent"
              )}
              htmlFor="dep-depends"
            >
              <RadioGroupItem id="dep-depends" value="depends" />
              Depends on another task
            </label>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                direction === "blocks" ? "border-primary" : "hover:bg-accent"
              )}
              htmlFor="dep-blocks"
            >
              <RadioGroupItem id="dep-blocks" value="blocks" />
              Blocks another task
            </label>
          </RadioGroup>
        </div>

        <Combobox<SearchResult | null>
          immediate
          onChange={(result) => {
            if (result) handleSelect(result);
          }}
          value={null}
        >
          <ComboboxInput
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks (#42 or title)…"
            value={query}
          />
          <ComboboxOptions static>
            {results.length === 0 && (
              <ComboboxEmpty>
                {query.trim().length >= 2
                  ? "No matching tasks."
                  : "No recent tasks."}
              </ComboboxEmpty>
            )}
            {results.length > 0 && (
              <ComboboxGroup
                heading={
                  query.trim().length < 2 ? "Recent tasks" : "Search results"
                }
              >
                {results.map((r) => (
                  <ComboboxOption key={r.id} value={r}>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      #{r.seqNumber}
                    </span>
                    <span className="truncate">{r.title}</span>
                  </ComboboxOption>
                ))}
              </ComboboxGroup>
            )}
          </ComboboxOptions>
        </Combobox>
      </DialogContent>
    </Dialog>
  );
}
