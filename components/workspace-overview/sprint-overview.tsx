"use client";

import { GaugeIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import Link from "next/link";
import type { WorkspaceOverviewData } from "@/app/actions/workspace-overview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface SprintOverviewProps {
  sprints: WorkspaceOverviewData["activeSprints"];
  workspaceId: string;
}

export function SprintOverview({ workspaceId, sprints }: SprintOverviewProps) {
  return (
    <Card id="sprint-overview">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 normal-case text-sm font-semibold tracking-normal">
          <GaugeIcon className="size-4 text-muted-foreground" />
          Sprint Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sprints.map((s) => (
            <Link
              className="rounded-xl border border-border p-4 hover:bg-accent/30 transition-colors"
              href={`/${workspaceId}/${s.spaceId}/sprint/${s.id}`}
              key={s.id}
            >
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-muted-foreground">
                  {s.spaceName}
                </span>
              </div>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">
                {s.name}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <Progress
                  className="h-1.5 flex-1"
                  value={s.completionPercent}
                />
                <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-muted-foreground">
                  {s.completionPercent}%
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-2xs text-muted-foreground">
                <span>
                  {s.completedTasks}/{s.totalTasks} done
                </span>
                <span>
                  {s.daysRemaining === null
                    ? "No end date"
                    : s.daysRemaining === 0
                      ? "Ends today"
                      : `${s.daysRemaining} day${s.daysRemaining === 1 ? "" : "s"} left`}
                </span>
              </div>
              {s.endDate && (
                <p className="mt-0.5 text-2xs text-muted-foreground/70">
                  Ends {format(new Date(s.endDate), "MMM d")}
                </p>
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
