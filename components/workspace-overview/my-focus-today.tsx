"use client";

import * as React from "react";
import type {
  MyFocusKind,
  WorkspaceOverviewData,
} from "@/app/actions/workspace-overview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type DrilldownRequest,
  TaskDrilldownSheet,
} from "@/components/workspace-overview/task-drilldown-sheet";
import { cn } from "@/lib/utils";

interface MyFocusTodayProps {
  focus: WorkspaceOverviewData["myFocus"];
  workspaceId: string;
}

const TILES: {
  key: keyof WorkspaceOverviewData["myFocus"];
  focusKind: MyFocusKind;
  dotClass: string;
  countClass: string;
  label: string;
  sheetLabel: string;
}[] = [
  {
    key: "overdueCount",
    focusKind: "overdue",
    dotClass: "bg-destructive",
    countClass: "text-destructive",
    label: "Overdue",
    sheetLabel: "Overdue Tasks",
  },
  {
    key: "dueTodayCount",
    focusKind: "dueToday",
    dotClass: "bg-warning",
    countClass: "text-warning",
    label: "Due Today",
    sheetLabel: "Due Today",
  },
  {
    key: "reviewCount",
    focusKind: "review",
    dotClass: "bg-purple-500 dark:bg-purple-400",
    countClass: "text-purple-500 dark:text-purple-400",
    label: "Review",
    sheetLabel: "Waiting for Review",
  },
  {
    key: "assignedCount",
    focusKind: "assigned",
    dotClass: "bg-info",
    countClass: "text-info",
    label: "Assigned",
    sheetLabel: "Assigned to Me",
  },
];

export function MyFocusToday({ focus, workspaceId }: MyFocusTodayProps) {
  const [drilldown, setDrilldown] = React.useState<{
    request: DrilldownRequest;
    label: string;
  } | null>(null);

  return (
    <Card id="my-focus-today">
      <CardHeader>
        <CardTitle className="normal-case text-lg font-semibold tracking-normal">
          ⭐ My Focus Today
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {TILES.map((tile) => {
            const count = focus[tile.key];
            return (
              <button
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 px-3 py-3 text-center transition-colors hover:border-foreground/15 hover:bg-accent/30 cursor-pointer"
                key={tile.key}
                onClick={() =>
                  setDrilldown({
                    request: { kind: "focus", focusKind: tile.focusKind },
                    label: tile.sheetLabel,
                  })
                }
                type="button"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      tile.dotClass
                    )}
                  />
                  <span className="text-sm font-medium text-muted-foreground">
                    {tile.label}
                  </span>
                </span>
                <span
                  className={cn(
                    "text-4xl font-bold leading-none tracking-[-0.03em] tabular-nums",
                    count > 0 ? tile.countClass : "text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
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
