"use client";

import * as React from "react";
import type { WorkspaceOverviewData } from "@/app/actions/workspace-overview";
import { UserAvatar } from "@/components/common/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type DrilldownRequest,
  TaskDrilldownSheet,
} from "@/components/workspace-overview/task-drilldown-sheet";
import { getWorkloadLevel, WORKLOAD_LEVEL_CONFIG } from "@/lib/workload-config";

interface AssigneeWorkloadProps {
  members: WorkspaceOverviewData["assigneeWorkload"];
  workspaceId: string;
}

// Bar fill color tracks completion % — greener while there's a lot left to
// do, warmer as a member closes out their queue. Red only kicks in at 100%
// completion for a Heavy-workload member: not "good progress", but "they
// cleared a stack this big — expect the next one to land soon."
function completionBarColor(
  completionPercent: number,
  isHeavy: boolean
): string {
  if (completionPercent >= 100 && isHeavy) {
    return "bg-red-500";
  }
  if (completionPercent >= 80) {
    return "bg-orange-500";
  }
  if (completionPercent >= 50) {
    return "bg-yellow-600";
  }
  return "bg-green-600";
}

export function AssigneeWorkload({
  members,
  workspaceId,
}: AssigneeWorkloadProps) {
  const [drilldown, setDrilldown] = React.useState<{
    request: DrilldownRequest;
    label: string;
  } | null>(null);

  return (
    <Card id="assignee-workload">
      <CardHeader>
        <CardTitle className="normal-case text-sm font-semibold tracking-normal">
          Team Workload
        </CardTitle>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No members yet
          </p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {members.map((m) => {
              const level = getWorkloadLevel(m.activeCount);
              const levelConfig = WORKLOAD_LEVEL_CONFIG[level];
              return (
                <button
                  className="flex w-full items-center gap-3 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-accent/20 cursor-pointer"
                  key={m.userId}
                  onClick={() =>
                    setDrilldown({
                      request: { kind: "assignee", userId: m.userId },
                      label: `${m.name}'s Tasks`,
                    })
                  }
                  type="button"
                >
                  <UserAvatar
                    className="shrink-0"
                    email={m.email}
                    image={m.image}
                    name={m.name}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-foreground/90">
                        {m.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {levelConfig.emoji} {levelConfig.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-2xs text-muted-foreground">
                      {m.activeCount} active task
                      {m.activeCount === 1 ? "" : "s"}
                    </p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${completionBarColor(m.completionPercent, level === "heavy")}`}
                        style={{ width: `${m.completionPercent}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-2xs text-muted-foreground">
                      <span>
                        {m.completedCount} / {m.assignedCount} completed
                      </span>
                      {m.overdueCount > 0 && (
                        <span className="text-warning">
                          {m.overdueCount} overdue
                        </span>
                      )}
                      {m.averageAgeDays !== null && (
                        <span>Average age {m.averageAgeDays}d</span>
                      )}
                    </div>
                  </div>
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
