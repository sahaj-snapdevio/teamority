"use client";

import {
  CheckCircleIcon,
  ClockIcon,
  FolderIcon,
  GaugeIcon,
  LightningIcon,
  ListChecksIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import type * as React from "react";
import type { WorkspaceOverviewData } from "@/app/actions/workspace-overview";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  summary: WorkspaceOverviewData["summary"];
}

// A subtitle is always shown (never conditionally hidden) so every tile in
// the row renders the same three lines — that's what keeps the grid reading
// as one aligned row instead of a jagged mix of two- and three-line cards.
interface Subtitle {
  text: string;
  tone?: "default" | "good" | "bad";
}

// The icon badge's color — semantic per metric in light mode (e.g.
// "Completed" is always success-green), except "warning" which only lights
// up once `value` is nonzero so a 0-overdue tile doesn't flash a false
// alarm. Dark mode intentionally drops the hue and falls back to the same
// muted circular badge for every tile — a wall of saturated colors reads
// as noisy against a dark background, so only the icon's own contrast is
// boosted there instead.
type IconTone = "neutral" | "primary" | "success" | "info" | "warning";

const ICON_TONE_CLASSES: Record<IconTone, string> = {
  neutral: "bg-muted text-foreground/70 dark:text-foreground/80",
  primary: "bg-primary/10 text-primary dark:bg-muted dark:text-foreground/80",
  success: "bg-success/10 text-success dark:bg-muted dark:text-foreground/80",
  info: "bg-info/10 text-info dark:bg-muted dark:text-foreground/80",
  warning: "bg-warning/10 text-warning dark:bg-muted dark:text-foreground/80",
};

interface Tile {
  anchor?: string;
  icon: React.ReactNode;
  iconTone: IconTone;
  label: string;
  subtitle: Subtitle;
  value: string | number;
}

function overdueSubtitle(summary: WorkspaceOverviewData["summary"]): Subtitle {
  if (summary.overdueTasks === 0) {
    return { text: "All caught up", tone: "good" };
  }
  if (summary.overdueDeltaFromYesterday === null) {
    return { text: "Needs attention", tone: "bad" };
  }
  if (summary.overdueDeltaFromYesterday === 0) {
    return { text: "No change from yesterday" };
  }
  if (summary.overdueDeltaFromYesterday > 0) {
    return {
      text: `+${summary.overdueDeltaFromYesterday} from yesterday`,
      tone: "bad",
    };
  }
  return {
    text: `${summary.overdueDeltaFromYesterday} from yesterday`,
    tone: "good",
  };
}

function StatTile({ label, value, icon, anchor, iconTone, subtitle }: Tile) {
  // "warning" is the one tone that's conditional — a 0-overdue tile falls
  // back to neutral instead of showing an alarming red icon for nothing.
  const resolvedTone: IconTone =
    iconTone === "warning" && value === 0 ? "neutral" : iconTone;
  const warningActive = resolvedTone === "warning";

  const content = (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          ICON_TONE_CLASSES[resolvedTone]
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-medium text-muted-foreground">
          {label}
        </span>
        <p
          className={cn(
            "mt-1.5 text-[28px] font-bold leading-none tracking-tight tabular-nums text-foreground",
            warningActive && "text-warning"
          )}
        >
          {value}
        </p>
        <p
          className={cn(
            "mt-1.5 text-xs leading-none text-foreground/70",
            subtitle.tone === "good" && "text-success",
            subtitle.tone === "bad" && "text-warning"
          )}
        >
          {subtitle.text}
        </p>
      </div>
    </div>
  );

  const className =
    "rounded-xl border border-border bg-card p-4 transition-colors" +
    (anchor ? " hover:bg-accent/30 cursor-pointer" : "");

  if (anchor) {
    return (
      <a className={className} href={`#${anchor}`}>
        {content}
      </a>
    );
  }
  return <div className={className}>{content}</div>;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const tiles: Tile[] = [
    {
      label: "Total Tasks",
      value: summary.totalTasks,
      icon: <ListChecksIcon className="size-5" />,
      iconTone: "neutral",
      anchor: "status-breakdown",
      subtitle: { text: "Across all projects" },
    },
    {
      label: "Completed",
      value: summary.completedTasks,
      icon: <CheckCircleIcon className="size-5" weight="fill" />,
      iconTone: "success",
      anchor: "status-breakdown",
      subtitle:
        summary.completedThisWeek > 0
          ? { text: `+${summary.completedThisWeek} this week`, tone: "good" }
          : { text: "No change this week" },
    },
    {
      label: "In Progress",
      value: summary.inProgressTasks,
      icon: <LightningIcon className="size-5" />,
      iconTone: "info",
      anchor: "status-breakdown",
      subtitle:
        summary.startedThisWeek > 0
          ? { text: `+${summary.startedThisWeek} this week` }
          : { text: "Active work" },
    },
    {
      label: "Overdue",
      value: summary.overdueTasks,
      icon: <WarningCircleIcon className="size-5" weight="fill" />,
      iconTone: "warning",
      anchor: "upcoming-deadlines",
      subtitle: overdueSubtitle(summary),
    },
    {
      label: "Due Today",
      value: summary.dueToday,
      icon: <ClockIcon className="size-5" />,
      iconTone: "neutral",
      anchor: "upcoming-deadlines",
      subtitle: { text: "Due before end of day" },
    },
    {
      label: "Active Projects",
      value: summary.activeProjects,
      icon: <FolderIcon className="size-5" />,
      iconTone: "primary",
      anchor: "projects",
      subtitle: { text: "Active workspace projects" },
    },
    {
      label: "Active Sprints",
      value: summary.activeSprints,
      icon: <GaugeIcon className="size-5" />,
      iconTone: "primary",
      anchor: summary.activeSprints > 0 ? "sprint-overview" : undefined,
      subtitle: { text: "Currently running" },
    },
  ];

  return (
    <div className="space-y-3">
      {/* Below ~380px a 2-up icon+number tile gets too cramped for 3-digit
          values (icon + gap already eat half the tile) — drop to one column
          only under that width; the sm:/lg: desktop breakpoints are untouched. */}
      <div className="grid grid-cols-1 gap-4 min-[381px]:grid-cols-2 sm:grid-cols-4">
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Overall Completion
          </span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {summary.completionPercent}%
          </span>
        </div>
        <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${summary.completionPercent}%` }}
          />
        </div>
        <p className="mt-3 text-sm tabular-nums text-foreground/70">
          {summary.completedTasks} of {summary.totalTasks} tasks completed
        </p>
      </div>
    </div>
  );
}
