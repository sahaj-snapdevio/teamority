"use client";

import {
  ActivityIcon,
  CaretDownIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  subDays,
} from "date-fns";
import Link from "next/link";
import * as React from "react";
import type { WorkspaceOverviewData } from "@/app/actions/workspace-overview";
import { UserAvatar } from "@/components/common/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { activityIcon, describeEvent } from "@/lib/activity-descriptions";

interface RecentActivityFeedProps {
  entries: WorkspaceOverviewData["recentActivity"];
  workspaceId: string;
}

type ActivityEntry = WorkspaceOverviewData["recentActivity"][number];

const GROUP_ORDER = ["Today", "Yesterday", "Last 7 Days", "Earlier"] as const;

function dateGroupLabel(createdAt: Date): (typeof GROUP_ORDER)[number] {
  if (isToday(createdAt)) {
    return "Today";
  }
  if (isYesterday(createdAt)) {
    return "Yesterday";
  }
  if (createdAt >= subDays(new Date(), 7)) {
    return "Last 7 Days";
  }
  return "Earlier";
}

function groupByDate(entries: ActivityEntry[]) {
  const groups = new Map<(typeof GROUP_ORDER)[number], ActivityEntry[]>();
  for (const entry of entries) {
    const label = dateGroupLabel(new Date(entry.createdAt));
    const existing = groups.get(label) ?? [];
    existing.push(entry);
    groups.set(label, existing);
  }
  return GROUP_ORDER.map((label) => ({
    label,
    entries: groups.get(label) ?? [],
  })).filter((g) => g.entries.length > 0);
}

// Only these actions collapse into "{actor} {verb} N tasks" — everything else
// (comments, custom fields, dependencies, …) stays as individual rows rather
// than risk a grammatically-odd generic sentence.
const GROUPABLE_VERB: Partial<Record<string, string>> = {
  task_created: "created",
  task_archived: "archived",
  task_unarchived: "unarchived",
  comment_added: "commented on",
  status_changed: "changed status on",
  assignee_added: "assigned",
  tag_added: "tagged",
  attachment_uploaded: "uploaded attachments to",
  time_logged: "logged time on",
  subtask_created: "added subtasks to",
};

interface ActivityRun {
  actorEmail: string | null;
  actorImage: string | null;
  actorName: string | null;
  entries: ActivityEntry[];
  eventType: string;
  key: string;
}

// Collapses consecutive entries by the same actor + event type into one run —
// only adjacent runs merge, so chronology never gets reordered.
function groupConsecutive(entries: ActivityEntry[]): ActivityRun[] {
  const runs: ActivityRun[] = [];
  for (const entry of entries) {
    const actorKey = entry.actorEmail ?? entry.actorName ?? "system";
    const last = runs.at(-1);
    if (
      last &&
      last.key === `${actorKey}:${entry.eventType}` &&
      GROUPABLE_VERB[entry.eventType]
    ) {
      last.entries.push(entry);
      continue;
    }
    runs.push({
      key: `${actorKey}:${entry.eventType}`,
      actorName: entry.actorName,
      actorEmail: entry.actorEmail,
      actorImage: entry.actorImage,
      eventType: entry.eventType,
      entries: [entry],
    });
  }
  return runs;
}

function ActivityRow({
  workspaceId,
  entry,
  indented,
}: {
  workspaceId: string;
  entry: ActivityEntry;
  indented?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-md px-1.5 py-2 hover:bg-accent/20 transition-colors ${indented ? "pl-8" : ""}`}
    >
      {!indented && (
        <UserAvatar
          className="mt-0.5 shrink-0"
          email={entry.actorEmail}
          image={entry.actorImage}
          name={entry.actorName}
          size="xs"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          {!indented && (
            <>
              <span className="font-medium">
                {entry.actorName ?? entry.actorEmail ?? "Someone"}
              </span>{" "}
            </>
          )}
          <span aria-hidden="true">
            {activityIcon(entry.eventType, entry.toDashboardCategory)}
          </span>{" "}
          <span className="text-muted-foreground">
            {describeEvent(
              entry.eventType,
              (entry.meta ?? {}) as Record<string, unknown>
            )}
          </span>{" "}
          <Link
            className="font-medium text-foreground hover:underline"
            href={`/${workspaceId}/task/${entry.taskId}`}
          >
            #{entry.taskSeq} {entry.taskTitle}
          </Link>
        </p>
        <p className="mt-0.5 text-2xs text-muted-foreground">
          <span className="text-muted-foreground/70">{entry.spaceName} · </span>
          <span title={format(new Date(entry.createdAt), "PPpp")}>
            {formatDistanceToNow(new Date(entry.createdAt), {
              addSuffix: true,
            })}
          </span>
        </p>
      </div>
    </div>
  );
}

function ActivityGroup({
  workspaceId,
  run,
}: {
  workspaceId: string;
  run: ActivityRun;
}) {
  const [expanded, setExpanded] = React.useState(false);

  if (run.entries.length === 1) {
    return <ActivityRow entry={run.entries[0]} workspaceId={workspaceId} />;
  }

  const verb = GROUPABLE_VERB[run.eventType] ?? "updated";
  const latest = run.entries[0];

  return (
    <div>
      <button
        className="flex w-full items-start gap-2.5 rounded-md px-1.5 py-2 text-left hover:bg-accent/20 transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        <UserAvatar
          className="mt-0.5 shrink-0"
          email={run.actorEmail}
          image={run.actorImage}
          name={run.actorName}
          size="xs"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">
            <span className="font-medium">
              {run.actorName ?? run.actorEmail ?? "Someone"}
            </span>{" "}
            <span aria-hidden="true">
              {activityIcon(run.eventType, run.entries[0].toDashboardCategory)}
            </span>{" "}
            <span className="text-muted-foreground">
              {verb} {run.entries.length} task
              {run.entries.length === 1 ? "" : "s"}
            </span>
          </p>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            <span title={format(new Date(latest.createdAt), "PPpp")}>
              {formatDistanceToNow(new Date(latest.createdAt), {
                addSuffix: true,
              })}
            </span>
          </p>
        </div>
        {expanded ? (
          <CaretDownIcon className="mt-1 size-3 shrink-0 text-muted-foreground" />
        ) : (
          <CaretRightIcon className="mt-1 size-3 shrink-0 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="space-y-0.5">
          {run.entries.map((entry) => (
            <ActivityRow
              entry={entry}
              indented
              key={entry.id}
              workspaceId={workspaceId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RecentActivityFeed({
  workspaceId,
  entries,
}: RecentActivityFeedProps) {
  const dateGroups = groupByDate(entries);

  return (
    <Card id="recent-activity">
      <CardHeader>
        <CardTitle className="normal-case text-sm font-semibold tracking-normal">
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ActivityIcon className="size-8 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">
              No activity in the last 30 days
            </p>
          </div>
        ) : (
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {dateGroups.map((dateGroup) => {
              const runs = groupConsecutive(dateGroup.entries);
              return (
                <div key={dateGroup.label}>
                  <p className="mb-0.5 px-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                    {dateGroup.label}
                  </p>
                  <div className="space-y-1">
                    {runs.map((run) => (
                      <ActivityGroup
                        key={`${run.key}:${run.entries[0].id}`}
                        run={run}
                        workspaceId={workspaceId}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
