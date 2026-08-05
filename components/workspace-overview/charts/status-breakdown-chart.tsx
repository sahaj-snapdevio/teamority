"use client";

import * as React from "react";
import type { WorkspaceOverviewData } from "@/app/actions/workspace-overview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type DrilldownRequest,
  TaskDrilldownSheet,
} from "@/components/workspace-overview/task-drilldown-sheet";
import { cn } from "@/lib/utils";

interface StatusBreakdownChartProps {
  breakdown: WorkspaceOverviewData["statusBreakdown"];
  workspaceId: string;
}

// Reserved category colors — same tokens the app already uses for
// success/info/purple state (purple matches "Waiting for Review" in
// components/workspace-overview/my-focus-today.tsx).
const STATUS_COLOR: Record<string, string> = {
  OPEN: "var(--muted-foreground)",
  WORKING: "var(--info)",
  REVIEW: "#a855f7",
  COMPLETED: "var(--success)",
};

const RADIUS = 15.915; // circumference ≈ 100, so dasharray works in percentage units
const GAP = 1.5; // percentage-unit gap between segments

export function StatusBreakdownChart({
  breakdown,
  workspaceId,
}: StatusBreakdownChartProps) {
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [drilldown, setDrilldown] = React.useState<{
    request: DrilldownRequest;
    label: string;
  } | null>(null);
  const total = breakdown.reduce((sum, s) => sum + s.count, 0);

  function openDrilldown(
    statusType: WorkspaceOverviewData["statusBreakdown"][number]["type"],
    label: string
  ) {
    setDrilldown({
      request: { kind: "status", statusType },
      label: `${label} Tasks`,
    });
  }

  let cumulative = 0;
  const segments = breakdown.map((s) => {
    const pct = total ? (s.count / total) * 100 : 0;
    const visible = Math.max(pct - GAP, 0);
    const offset = 25 - cumulative;
    cumulative += pct;
    return { ...s, pct, visible, offset };
  });

  return (
    <Card id="status-breakdown">
      <CardHeader>
        <CardTitle className="normal-case text-sm font-semibold tracking-normal">
          Task Status Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No tasks yet
          </p>
        ) : (
          <div className="flex items-center gap-6">
            <div className="relative size-32 shrink-0">
              <svg className="size-32 -rotate-0" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  fill="none"
                  r={RADIUS}
                  stroke="var(--muted)"
                  strokeWidth="4"
                />
                {segments.map((s) =>
                  s.pct > 0 ? (
                    // biome-ignore lint/a11y/useSemanticElements: SVG <circle> can't be a real <button>; kept keyboard-accessible via role+tabIndex+onKeyDown, and the matching legend row below is a real <button> for the same action.
                    <circle
                      aria-label={`View ${s.label} tasks`}
                      className="cursor-pointer transition-opacity focus-visible:outline-none focus-visible:opacity-75"
                      cx="18"
                      cy="18"
                      fill="none"
                      key={s.type}
                      onClick={() => openDrilldown(s.type, s.label)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDrilldown(s.type, s.label);
                        }
                      }}
                      onMouseEnter={() => setHovered(s.type)}
                      onMouseLeave={() => setHovered(null)}
                      opacity={hovered && hovered !== s.type ? 0.35 : 1}
                      r={RADIUS}
                      role="button"
                      stroke={STATUS_COLOR[s.type]}
                      strokeDasharray={`${s.visible} ${100 - s.visible}`}
                      strokeDashoffset={s.offset}
                      strokeLinecap="round"
                      strokeWidth="4"
                      tabIndex={0}
                    />
                  ) : null
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-semibold tabular-nums text-foreground">
                  {total}
                </span>
                <span className="text-2xs text-muted-foreground">tasks</span>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              {segments.map((s) => (
                <button
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors cursor-pointer",
                    hovered === s.type && "bg-accent/40"
                  )}
                  key={s.type}
                  onClick={() => openDrilldown(s.type, s.label)}
                  onMouseEnter={() => setHovered(s.type)}
                  onMouseLeave={() => setHovered(null)}
                  type="button"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: STATUS_COLOR[s.type] }}
                    />
                    <span className="truncate text-foreground/80">
                      {s.label}
                    </span>
                  </div>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {s.count} · {Math.round(s.pct)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <TaskDrilldownSheet
        label={drilldown?.label ?? ""}
        onOpenChange={(open) => !open && setDrilldown(null)}
        open={drilldown !== null}
        request={drilldown?.request ?? null}
        workspaceId={workspaceId}
      />
    </Card>
  );
}
