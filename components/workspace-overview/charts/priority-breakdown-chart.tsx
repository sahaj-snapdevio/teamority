"use client";

import type { WorkspaceOverviewData } from "@/app/actions/workspace-overview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRIORITY_CONFIG, type Priority } from "@/lib/priority-config";

interface PriorityBreakdownChartProps {
  breakdown: WorkspaceOverviewData["priorityBreakdown"];
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
}: PriorityBreakdownChartProps) {
  const total = breakdown.reduce((sum, p) => sum + p.count, 0);
  const max = Math.max(1, ...breakdown.map((p) => p.count));

  return (
    <Card id="priority-breakdown">
      <CardHeader>
        <CardTitle className="normal-case text-sm font-semibold tracking-normal">
          Priority Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No tasks yet
          </p>
        ) : (
          <div className="space-y-3">
            {breakdown.map((p) => {
              const cfg = PRIORITY_CONFIG[p.priority];
              const widthPct = Math.round((p.count / max) * 100);
              return (
                <div className="flex items-center gap-3" key={p.priority}>
                  <span className="w-24 shrink-0 text-sm text-foreground/80">
                    <span className="mr-1">{cfg.icon}</span>
                    {cfg.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${BAR_COLOR[p.priority]} transition-all`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    {p.count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
