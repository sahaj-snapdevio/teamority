"use client";

import Link from "next/link";
import type { WorkspaceOverviewData } from "@/app/actions/workspace-overview";
import { SpaceIcon } from "@/components/common/space-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProjectsTableProps {
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
          "text-lg font-semibold tabular-nums leading-none",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-2xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function ProjectsTable({ workspaceId, projects }: ProjectsTableProps) {
  return (
    <Card id="projects">
      <CardHeader>
        <CardTitle className="normal-case text-sm font-semibold tracking-normal">
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
            {projects.map((p) => (
              <Link
                className="block rounded-xl border border-border p-4 hover:bg-accent/30 transition-colors"
                href={`/${workspaceId}/${p.id}`}
                key={p.id}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <SpaceIcon color={p.color} emoji={p.logoEmoji} size="sm" />
                  <span className="truncate text-sm font-semibold text-foreground">
                    {p.name}
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

                <div className="mt-3 flex items-center gap-2">
                  <Progress
                    className="h-1.5 flex-1"
                    value={p.completedPercent}
                  />
                  <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-muted-foreground">
                    {p.completedPercent}%
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
