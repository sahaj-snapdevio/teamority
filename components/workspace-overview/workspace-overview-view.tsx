"use client";

import { ChartPieSliceIcon, FolderOpenIcon } from "@phosphor-icons/react";
import * as React from "react";
import {
  getWorkspaceOverview,
  type WorkspaceOverviewData,
} from "@/app/actions/workspace-overview";
import { useRealtimeRefetch } from "@/components/realtime/realtime-provider";
import { Card } from "@/components/ui/card";
import { AssigneeWorkload } from "@/components/workspace-overview/assignee-workload";
import { PriorityBreakdownChart } from "@/components/workspace-overview/charts/priority-breakdown-chart";
import { StatusBreakdownChart } from "@/components/workspace-overview/charts/status-breakdown-chart";
import { MyFocusToday } from "@/components/workspace-overview/my-focus-today";
import { ProjectsTable } from "@/components/workspace-overview/projects-table";
import { QuickActions } from "@/components/workspace-overview/quick-actions";
import { RecentActivityFeed } from "@/components/workspace-overview/recent-activity-feed";
import { SprintOverview } from "@/components/workspace-overview/sprint-overview";
import { SummaryCards } from "@/components/workspace-overview/summary-cards";
import { UpcomingDeadlines } from "@/components/workspace-overview/upcoming-deadlines";

interface WorkspaceOverviewViewProps {
  workspaceId: string;
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-4">
        {[
          "total",
          "completed",
          "week",
          "progress",
          "overdue",
          "today",
          "projects",
          "sprints",
        ].map((key) => (
          <div
            className="h-24 rounded-xl border border-border bg-card"
            key={key}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-xl border border-border bg-card" />
        <div className="h-64 rounded-xl border border-border bg-card" />
      </div>
    </div>
  );
}

export function WorkspaceOverviewView({
  workspaceId,
}: WorkspaceOverviewViewProps) {
  const [data, setData] = React.useState<WorkspaceOverviewData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchOverview = React.useCallback(async () => {
    const res = await getWorkspaceOverview(workspaceId);
    if (!("error" in res)) {
      setData(res);
    }
    setLoading(false);
  }, [workspaceId]);

  React.useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  useRealtimeRefetch(fetchOverview);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <ChartPieSliceIcon className="size-5 text-primary" weight="fill" />
        <h1 className="text-[34px] font-bold tracking-normal text-foreground">
          Overview
        </h1>
      </div>

      {loading || !data ? (
        <OverviewSkeleton />
      ) : data.projects.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-xl bg-accent text-muted-foreground">
            <FolderOpenIcon className="size-7" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Nothing to summarize yet
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Once you have a project with some tasks in it, this page will fill
            up with a workspace-wide summary of progress, workload, and
            activity.
          </p>
        </Card>
      ) : (
        <>
          <SummaryCards summary={data.summary} />

          <MyFocusToday focus={data.myFocus} workspaceId={workspaceId} />

          <QuickActions
            onChanged={fetchOverview}
            projects={data.projects}
            workspaceId={workspaceId}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StatusBreakdownChart
              breakdown={data.statusBreakdown}
              workspaceId={workspaceId}
            />
            <PriorityBreakdownChart
              breakdown={data.priorityBreakdown}
              workspaceId={workspaceId}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ProjectsTable
              activeSprints={data.activeSprints}
              projects={data.projects}
              workspaceId={workspaceId}
            />
            <AssigneeWorkload
              members={data.assigneeWorkload}
              workspaceId={workspaceId}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <UpcomingDeadlines
              deadlines={data.upcomingDeadlines}
              workspaceId={workspaceId}
            />
            <RecentActivityFeed
              entries={data.recentActivity}
              workspaceId={workspaceId}
            />
          </div>

          {data.activeSprints.length > 0 && (
            <SprintOverview
              sprints={data.activeSprints}
              workspaceId={workspaceId}
            />
          )}
        </>
      )}
    </div>
  );
}
