"use client";

import { LinkIcon, ProhibitIcon } from "@phosphor-icons/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// A per-task dependency summary used by list/board indicators.
export type TaskDependencyIndicator = {
  /** Total number of tasks this task depends on (is blocked by). */
  total: number;
  /** How many of those blockers are not yet completed. */
  incomplete: number;
};

// Communicates dependency *state* at a glance:
//   • all completed → link icon + total  ("this task is no longer blocked")
//   • any incomplete → prohibit icon + incomplete count ("still waiting")
export function TaskDependencyBadge({
  total,
  incomplete,
  className,
}: TaskDependencyIndicator & { className?: string }) {
  if (total === 0) {
    return null;
  }
  const blocked = incomplete > 0;
  const count = blocked ? incomplete : total;
  const label = blocked
    ? `Blocked by ${incomplete} task${incomplete === 1 ? "" : "s"}`
    : "All dependencies completed";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-2xs font-medium tabular-nums",
              blocked
                ? "text-amber-600 dark:text-amber-400"
                : "text-base-content/60",
              className
            )}
          >
            {blocked ? (
              <ProhibitIcon className="size-3" weight="bold" />
            ) : (
              <LinkIcon className="size-3" />
            )}
            {count}
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
