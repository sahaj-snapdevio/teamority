"use client";

import Link from "next/link";
import type { WorkspaceOverviewData } from "@/app/actions/workspace-overview";
import { SpaceIcon } from "@/components/common/space-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProjectsTableProps {
  activeSprints: WorkspaceOverviewData["activeSprints"];
  projects: WorkspaceOverviewData["projects"];
  workspaceId: string;
}

function ProjectStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div>
      <p
        className={cn(
          "text-lg font-bold tabular-nums leading-none tracking-[-0.02em]",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export function ProjectsTable({
  workspaceId,
  projects,
  activeSprints,
}: ProjectsTableProps) {
  const sprintSpaceIds = new Set(activeSprints.map((s) => s.spaceId));

  return (
    <Card id="projects">
      <CardHeader>
        <CardTitle className="normal-case text-lg font-semibold tracking-normal">
          Projects
        </CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No projects yet
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-h-96 overflow-y-auto">
            {projects.map((p) => {
              const hasActiveSprint = sprintSpaceIds.has(p.id);
              return (
                <Link
                  className="block rounded-xl border border-border p-4 transition-colors hover:bg-accent/30"
                  href={`/${workspaceId}/${p.id}`}
                  key={p.id}
                  style={{
                    borderLeftColor: p.color ?? undefined,
                    borderLeftWidth: p.color ? "3px" : undefined,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <SpaceIcon
                        color={p.color}
                        emoji={p.logoEmoji}
                        size="sm"
                      />
                      <span className="truncate text-sm font-semibold text-foreground">
                        {p.name}
                      </span>
                    </div>
                    {(p.overdueCount > 0 || hasActiveSprint) && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        {hasActiveSprint && (
                          <Badge
                            className="gap-1 rounded-full border border-success/30 bg-success-subtle px-2 py-0.5 text-2xs text-success-foreground"
                            variant="outline"
                          >
                            <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
                            Sprint
                          </Badge>
                        )}
                        {p.overdueCount > 0 && (
                          <Badge
                            className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-2xs text-warning"
                            variant="outline"
                          >
                            {p.overdueCount} overdue
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2.5">
                    <Progress
                      className="h-2.5 flex-1"
                      value={p.completedPercent}
                    />
                    <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                      {p.completedPercent}%
                    </span>
                  </div>

                  <div
                    className={cn(
                      "mt-3 grid gap-2",
                      p.overdueCount > 0 ? "grid-cols-3" : "grid-cols-2"
                    )}
                  >
                    <ProjectStat
                      label={p.taskCount === 1 ? "Task" : "Tasks"}
                      value={p.taskCount}
                    />
                    <ProjectStat
                      label="Completed"
                      tone="success"
                      value={p.completedCount}
                    />
                    {p.overdueCount > 0 && (
                      <ProjectStat
                        label="Overdue"
                        tone="warning"
                        value={p.overdueCount}
                      />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
