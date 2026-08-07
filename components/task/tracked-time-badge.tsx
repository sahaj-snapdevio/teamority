"use client";

import { ClockIcon } from "@phosphor-icons/react";
import { formatDuration } from "@/lib/format-duration";
import { cn } from "@/lib/utils";

// A subtle per-card indicator of total tracked (completed) time on a task.
// Renders nothing when no time has been tracked.
export function TrackedTimeBadge({
  seconds,
  className,
}: {
  seconds: number | null | undefined;
  className?: string;
}) {
  if (!seconds || seconds <= 0) {
    return null;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-2xs font-medium text-base-content/60 tabular-nums",
        className
      )}
    >
      <ClockIcon className="size-3" />
      {formatDuration(seconds)}
    </span>
  );
}
