"use client";

import * as React from "react";
import type { WorkspaceOverviewData } from "@/app/actions/workspace-overview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type DrilldownRequest,
  TaskDrilldownSheet,
} from "@/components/workspace-overview/task-drilldown-sheet";
import { PRIORITY_CONFIG, type Priority } from "@/lib/priority-config";

interface PriorityBreakdownChartProps {
  breakdown: WorkspaceOverviewData["priorityBreakdown"];
  workspaceId: string;
}

const BAR_COLOR: Record<Priority, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-yellow-600",
  LOW: "bg-gray-400",
  NONE: "bg-gray-300 dark:bg-gray-600",
};

export function PriorityBreakdownChart({
  breakdown,
  workspaceId,
}: PriorityBreakdownChartProps) {
  const [drilldown, setDrilldown] = React.useState<{
    request: DrilldownRequest;
    label: string;
  } | null>(null);
  const total = breakdown.reduce((sum, p) => sum + p.count, 0);
  const max = Math.max(1, ...breakdown.map((p) => p.count));

  function openDrilldown(priority: Priority, label: string) {
    setDrilldown({
      request: { kind: "priority", priority },
      label: `${label} Tasks`,
    });
  }

  return (
    <Card id="priority-breakdown">
      <CardHeader>
        <CardTitle className="normal-case text-lg font-semibold tracking-normal">
          Priority Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-base-content/60">
            No tasks yet
          </p>
        ) : (
          <div className="space-y-1">
            {breakdown.map((p) => {
              const cfg = PRIORITY_CONFIG[p.priority];
              const widthPct = Math.round((p.count / max) * 100);
              return (
                <button
                  aria-label={`View ${cfg.label} tasks`}
                  className="group flex w-full items-center gap-3 rounded-md px-1.5 py-1.5 text-left transition-colors cursor-pointer hover:bg-base-200/40"
                  key={p.priority}
                  onClick={() => openDrilldown(p.priority, cfg.label)}
                  type="button"
                >
                  <span className="w-24 shrink-0 text-sm text-base-content/80">
                    <span className="mr-1">{cfg.icon}</span>
                    {cfg.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-base-200">
                    <div
                      className={`h-full rounded-full ${BAR_COLOR[p.priority]} transition-all group-hover:brightness-110`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm tabular-nums text-base-content/60">
                    {p.count}
                  </span>
                </button>
              );
            })}
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
