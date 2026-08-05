"use client";

import {
  CheckCircleIcon,
  ClockIcon,
  FolderIcon,
  GaugeIcon,
  LightningIcon,
  ListChecksIcon,
  MinusIcon,
  TrendDownIcon,
  TrendUpIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import type * as React from "react";
import type { WorkspaceOverviewData } from "@/app/actions/workspace-overview";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  summary: WorkspaceOverviewData["summary"];
}

interface Trend {
  direction: "up" | "down" | "neutral";
  sentiment: "good" | "bad" | "neutral";
  text: string;
}

interface Tile {
  anchor?: string;
  icon: React.ReactNode;
  label: string;
  tone?: "default" | "warning";
  trend?: Trend;
  value: string | number;
}

function TrendLine({ trend }: { trend: Trend }) {
  const Icon =
    trend.direction === "up"
      ? TrendUpIcon
      : trend.direction === "down"
        ? TrendDownIcon
        : MinusIcon;
  return (
    <p
      className={cn(
        "mt-1 flex items-center gap-1 text-2xs",
        trend.sentiment === "good" && "text-success",
        trend.sentiment === "bad" && "text-warning",
        trend.sentiment === "neutral" && "text-muted-foreground/70"
      )}
    >
      <Icon className="size-3" weight="bold" />
      {trend.text}
    </p>
  );
}

function StatTile({
  label,
  value,
  icon,
  anchor,
  tone = "default",
  trend,
}: Tile) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "text-muted-foreground/60",
            tone === "warning" && "text-warning"
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums text-foreground",
          tone === "warning" && value !== 0 && "text-warning"
        )}
      >
        {value}
      </p>
      {trend && <TrendLine trend={trend} />}
    </>
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
      icon: <ListChecksIcon className="size-4" />,
      anchor: "status-breakdown",
    },
    {
      label: "Completed",
      value: summary.completedTasks,
      icon: <CheckCircleIcon className="size-4" weight="fill" />,
      anchor: "status-breakdown",
      trend:
        summary.completedThisWeek > 0
          ? {
              direction: "up",
              sentiment: "good",
              text: `+${summary.completedThisWeek} this week`,
            }
          : {
              direction: "neutral",
              sentiment: "neutral",
              text: "No change this week",
            },
    },
    {
      label: "In Progress",
      value: summary.inProgressTasks,
      icon: <LightningIcon className="size-4" />,
      anchor: "status-breakdown",
      trend:
        summary.startedThisWeek > 0
          ? {
              direction: "up",
              sentiment: "good",
              text: `+${summary.startedThisWeek} this week`,
            }
          : {
              direction: "neutral",
              sentiment: "neutral",
              text: "No new activity this week",
            },
    },
    {
      label: "Overdue",
      value: summary.overdueTasks,
      icon: <WarningCircleIcon className="size-4" weight="fill" />,
      anchor: "upcoming-deadlines",
      tone: "warning",
      trend:
        summary.overdueDeltaFromYesterday === null
          ? undefined
          : summary.overdueDeltaFromYesterday === 0
            ? {
                direction: "neutral",
                sentiment: "neutral",
                text: "No change from yesterday",
              }
            : summary.overdueDeltaFromYesterday > 0
              ? {
                  direction: "up",
                  sentiment: "bad",
                  text: `+${summary.overdueDeltaFromYesterday} from yesterday`,
                }
              : {
                  direction: "down",
                  sentiment: "good",
                  text: `${summary.overdueDeltaFromYesterday} from yesterday`,
                },
    },
    {
      label: "Due Today",
      value: summary.dueToday,
      icon: <ClockIcon className="size-4" />,
      anchor: "upcoming-deadlines",
    },
    {
      label: "Active Projects",
      value: summary.activeProjects,
      icon: <FolderIcon className="size-4" />,
      anchor: "projects",
    },
    {
      label: "Active Sprints",
      value: summary.activeSprints,
      icon: <GaugeIcon className="size-4" />,
      anchor: summary.activeSprints > 0 ? "sprint-overview" : undefined,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Overall Completion</span>
          <span className="tabular-nums text-foreground">
            {summary.completionPercent}%
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${summary.completionPercent}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
          {summary.completedTasks} / {summary.totalTasks} completed (
          {summary.completionPercent}%)
        </p>
      </div>
    </div>
  );
}
