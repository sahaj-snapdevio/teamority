"use client";

import {
  ActivityIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import * as React from "react";
import {
  getSpaceActivity,
  type SpaceActivityEntry,
} from "@/app/actions/space-activity";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { describeEvent } from "@/lib/activity-descriptions";

interface SpaceActivityFeedProps {
  spaceId: string;
  workspaceId: string;
}

function initials(name: string | null, email: string | null) {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (email ?? "?").slice(0, 2).toUpperCase();
}

export function SpaceActivityFeed({
  workspaceId,
  spaceId,
}: SpaceActivityFeedProps) {
  const [entries, setEntries] = React.useState<SpaceActivityEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);

  const load = React.useCallback(
    async (p: number) => {
      setLoading(true);
      const res = await getSpaceActivity(workspaceId, spaceId, p);
      if (!("error" in res)) {
        setEntries(res.entries);
        setHasMore(res.entries.length === 50);
      }
      setLoading(false);
    },
    [workspaceId, spaceId]
  );

  React.useEffect(() => {
    void load(page);
  }, [load, page]);

  return (
    <div className="p-6 max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ActivityIcon className="size-5 text-primary" />
        <h1 className="text-lg font-semibold">Space Activity</h1>
        <span className="text-sm text-base-content/60">· last 30 days</span>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div className="flex gap-3 p-3 rounded-lg border" key={i}>
              <div className="size-8 rounded-full bg-base-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-base-200 rounded w-1/3" />
                <div className="h-3 bg-base-200 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border bg-elevated flex flex-col items-center gap-3 py-16 text-center">
          <ActivityIcon className="size-10 text-base-content/20" />
          <p className="text-sm text-base-content/60">
            No activity in the last 30 days
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-elevated divide-y overflow-hidden">
            {entries.map((entry) => (
              <div
                className="flex items-start gap-3 px-4 py-3 hover:bg-base-200/20 transition-colors"
                key={entry.id}
              >
                <Avatar className="size-7 shrink-0 mt-0.5">
                  {entry.actorImage && <AvatarImage src={entry.actorImage} />}
                  <AvatarFallback className="text-2xs bg-primary/10 text-primary">
                    {initials(entry.actorName, entry.actorEmail)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">
                      {entry.actorName ?? entry.actorEmail ?? "System"}
                    </span>{" "}
                    <span className="text-base-content/60">
                      {describeEvent(
                        entry.eventType,
                        entry.meta as Record<string, unknown>
                      )}
                    </span>
                    {" · "}
                    <Link
                      className="font-medium hover:underline text-base-content"
                      href={`/${workspaceId}/task/${entry.taskId}`}
                    >
                      #{entry.taskSeq} {entry.taskTitle}
                    </Link>
                  </p>
                  <p className="text-xs text-base-content/60 mt-0.5">
                    <span className="text-base-content/60">
                      {entry.listName} ·{" "}
                    </span>
                    <span title={format(new Date(entry.createdAt), "PPpp")}>
                      {formatDistanceToNow(new Date(entry.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <button
              className="flex items-center gap-1 text-sm text-base-content/60 hover:text-base-content disabled:opacity-40 transition-colors"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              <CaretLeftIcon className="size-4" /> Previous
            </button>
            <span className="text-sm text-base-content/60">Page {page}</span>
            <button
              className="flex items-center gap-1 text-sm text-base-content/60 hover:text-base-content disabled:opacity-40 transition-colors"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
              type="button"
            >
              Next <CaretRightIcon className="size-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
