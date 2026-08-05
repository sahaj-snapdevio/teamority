"use client";

import Link from "next/link";
import * as React from "react";
import type {
  DeadlineBucket,
  WorkspaceOverviewData,
  WorkspaceOverviewTaskRef,
} from "@/app/actions/workspace-overview";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type DrilldownRequest,
  TaskDrilldownSheet,
} from "@/components/workspace-overview/task-drilldown-sheet";
import { describeDeadline } from "@/lib/deadline-format";

interface UpcomingDeadlinesProps {
  deadlines: WorkspaceOverviewData["upcomingDeadlines"];
  workspaceId: string;
}

type BucketKey = keyof WorkspaceOverviewData["upcomingDeadlines"];

const SECTIONS: {
  key: BucketKey;
  bucket: DeadlineBucket;
  emoji: string;
  label: string;
  labelClass: string;
  emptyLabel: string;
}[] = [
  {
    key: "overdue",
    bucket: "overdue",
    emoji: "🔴",
    label: "Overdue",
    labelClass: "text-destructive",
    emptyLabel: "No overdue tasks 🎉",
  },
  {
    key: "dueToday",
    bucket: "dueToday",
    emoji: "🟡",
    label: "Today",
    labelClass: "text-warning",
    emptyLabel: "Nothing due",
  },
  {
    key: "dueTomorrow",
    bucket: "dueTomorrow",
    emoji: "🟢",
    label: "Tomorrow",
    labelClass: "text-success",
    emptyLabel: "Nothing due tomorrow",
  },
  {
    key: "next7Days",
    bucket: "next7Days",
    emoji: "🔵",
    label: "Next 7 Days",
    labelClass: "text-info",
    emptyLabel: "Nothing else coming up",
  },
];

function DeadlineRow({
  workspaceId,
  task,
  bucketKey,
}: {
  workspaceId: string;
  task: WorkspaceOverviewTaskRef;
  bucketKey: BucketKey;
}) {
  const deadline = task.dueDate
    ? describeDeadline(new Date(task.dueDate))
    : null;
  return (
    <Link
      className="flex items-start gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent/30 transition-colors"
      href={`/${workspaceId}/task/${task.id}`}
    >
      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-foreground/90">{task.title}</p>
        {deadline && (
          <p
            className={`mt-0.5 text-2xs ${bucketKey === "overdue" ? "text-destructive" : "text-muted-foreground"}`}
          >
            {deadline.text}
          </p>
        )}
      </div>
    </Link>
  );
}

export function UpcomingDeadlines({
  workspaceId,
  deadlines,
}: UpcomingDeadlinesProps) {
  const [drilldown, setDrilldown] = React.useState<{
    request: DrilldownRequest;
    label: string;
  } | null>(null);
  const isEmpty = SECTIONS.every((s) => deadlines[s.key].total === 0);

  function openBucket(bucket: DeadlineBucket, label: string) {
    setDrilldown({ request: { kind: "deadline", bucket }, label });
  }

  return (
    <Card id="upcoming-deadlines">
      <CardHeader>
        <CardTitle className="normal-case text-sm font-semibold tracking-normal">
          Upcoming Deadlines
        </CardTitle>
        {!isEmpty && (
          <CardAction>
            <button
              className="text-xs font-medium text-primary hover:underline cursor-pointer"
              onClick={() => openBucket("all", "Upcoming Deadlines")}
              type="button"
            >
              View All
            </button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nothing due soon 🎉
          </p>
        ) : (
          <div className="max-h-80 space-y-4 overflow-y-auto">
            {SECTIONS.map((section) => {
              const { tasks, total } = deadlines[section.key];
              const remaining = total - tasks.length;
              return (
                <div key={section.key}>
                  <p
                    className={`mb-1 flex items-center gap-1.5 text-sm font-semibold ${section.labelClass}`}
                  >
                    <span>{section.emoji}</span>
                    {section.label}
                    {total > 0 && (
                      <span className="tabular-nums">({total})</span>
                    )}
                  </p>
                  {total === 0 ? (
                    <p className="px-1.5 py-1 text-xs text-muted-foreground/70">
                      {section.emptyLabel}
                    </p>
                  ) : (
                    <div className="space-y-0.5">
                      {tasks.map((t) => (
                        <DeadlineRow
                          bucketKey={section.key}
                          key={t.id}
                          task={t}
                          workspaceId={workspaceId}
                        />
                      ))}
                      {remaining > 0 && (
                        <button
                          className="px-1.5 py-1 text-xs font-medium text-primary hover:underline cursor-pointer"
                          onClick={() =>
                            openBucket(section.bucket, `${section.label} Tasks`)
                          }
                          type="button"
                        >
                          +{remaining} more
                        </button>
                      )}
                    </div>
                  )}
                </div>
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
