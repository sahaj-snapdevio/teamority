"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import {
  type DuplicateListOptions,
  duplicateList,
  getListTaskCounts,
} from "@/app/actions/list";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DuplicateListDialogProps {
  list: { id: string; name: string };
  onOpenChange: (open: boolean) => void;
  open: boolean;
  spaceId: string;
  workspaceId: string;
}

type TaskOptionKey = Exclude<keyof DuplicateListOptions, "name" | "copyTasks">;

// Copy toggles shown beneath the "Copy all tasks" master, in display order.
const TASK_OPTIONS: { key: TaskOptionKey; label: string }[] = [
  { key: "copyDescriptions", label: "Copy descriptions" },
  { key: "copySubtasks", label: "Copy subtasks" },
  { key: "copyChecklists", label: "Copy checklists" },
  { key: "copyDependencies", label: "Copy task dependencies" },
  { key: "copyTags", label: "Copy tags" },
  { key: "copyAssignees", label: "Copy assignees" },
  { key: "copyPriorities", label: "Copy priorities" },
  { key: "copyDueDates", label: "Copy due dates" },
  { key: "keepCompleted", label: "Keep completed tasks" },
  { key: "copyArchived", label: "Copy archived tasks" },
];

const DEFAULT_OPTIONS: Omit<DuplicateListOptions, "name"> = {
  copyTasks: true,
  copyDescriptions: true,
  copySubtasks: true,
  copyChecklists: true,
  copyDependencies: true,
  copyTags: true,
  copyAssignees: true,
  copyPriorities: true,
  copyDueDates: true,
  keepCompleted: false,
  copyArchived: false,
};

function CheckboxRow({
  id,
  label,
  checked,
  disabled,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={(v) => onChange?.(v === true)}
      />
      <Label
        className={
          disabled
            ? "font-normal text-muted-foreground"
            : "font-normal cursor-pointer"
        }
        htmlFor={id}
      >
        {label}
        {hint && (
          <span className="ml-1.5 text-xs text-muted-foreground">{hint}</span>
        )}
      </Label>
    </div>
  );
}

export function DuplicateListDialog({
  open,
  onOpenChange,
  workspaceId,
  spaceId,
  list,
}: DuplicateListDialogProps) {
  const router = useRouter();
  const [name, setName] = React.useState(`${list.name} (Copy)`);
  const [opts, setOpts] = React.useState(DEFAULT_OPTIONS);
  const [counts, setCounts] = React.useState<{
    activeOpen: number;
    activeCompleted: number;
    archived: number;
  } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Reset state and (re)load counts whenever the dialog opens.
  React.useEffect(() => {
    if (!open) {
      return;
    }
    setName(`${list.name} (Copy)`);
    setOpts(DEFAULT_OPTIONS);
    setCounts(null);
    setError("");
    let active = true;
    getListTaskCounts(workspaceId, spaceId, list.id).then((res) => {
      if (active && !("error" in res)) {
        setCounts(res);
      }
    });
    return () => {
      active = false;
    };
  }, [open, list.id, list.name, workspaceId, spaceId]);

  function setOpt(key: keyof typeof opts, value: boolean) {
    setOpts((prev) => ({ ...prev, [key]: value }));
  }

  const taskCount = React.useMemo(() => {
    if (!opts.copyTasks || !counts) {
      return 0;
    }
    return (
      counts.activeOpen +
      (opts.keepCompleted ? counts.activeCompleted : 0) +
      (opts.copyArchived ? counts.archived : 0)
    );
  }, [opts.copyTasks, opts.keepCompleted, opts.copyArchived, counts]);

  const showEmpty = !opts.copyTasks || taskCount === 0;

  async function handleDuplicate() {
    setLoading(true);
    setError("");
    const result = await duplicateList(workspaceId, spaceId, list.id, {
      name,
      ...opts,
    });
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    router.push(`/${workspaceId}/${spaceId}/list/${result.listId}`);
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicate List</DialogTitle>
          <DialogDescription>
            Choose what you want to copy into the new list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="duplicate-name">List name</Label>
            <Input
              autoFocus
              disabled={loading}
              id="duplicate-name"
              onChange={(e) => setName(e.target.value)}
              value={name}
            />
          </div>

          <div className="space-y-2.5">
            <CheckboxRow
              checked={opts.copyTasks}
              disabled={loading}
              id="opt-copyTasks"
              label="Copy all tasks"
              onChange={(v) => setOpt("copyTasks", v)}
            />
            <div className="ml-6 space-y-2.5 border-l pl-3.5">
              {TASK_OPTIONS.map((o) => (
                <CheckboxRow
                  checked={opts[o.key]}
                  disabled={loading || !opts.copyTasks}
                  id={`opt-${o.key}`}
                  key={o.key}
                  label={o.label}
                  onChange={(v) => setOpt(o.key, v)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-muted/50 px-3.5 py-3 text-sm">
            {showEmpty ? (
              <p className="text-muted-foreground">
                This will create an empty list with the same settings only.
              </p>
            ) : (
              <div className="space-y-0.5">
                <p className="font-medium">
                  {taskCount} {taskCount === 1 ? "task" : "tasks"} will be
                  copied.
                </p>
                <p className="text-muted-foreground">
                  Completed tasks:{" "}
                  {opts.keepCompleted ? "Included" : "Excluded"}
                </p>
                <p className="text-muted-foreground">
                  Archived tasks: {opts.copyArchived ? "Included" : "Excluded"}
                </p>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            disabled={loading}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={loading || !name.trim()}
            onClick={handleDuplicate}
            type="button"
          >
            {loading ? "Duplicating…" : "Duplicate List"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
