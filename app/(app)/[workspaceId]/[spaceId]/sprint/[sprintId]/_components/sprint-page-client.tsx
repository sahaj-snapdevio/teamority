"use client";

import { TrayIcon } from "@phosphor-icons/react";
import * as React from "react";
import { BacklogView } from "@/components/sprint/backlog-view";
import { ClosedSprintView } from "@/components/sprint/closed-sprint-view";
import { SprintListView } from "@/components/sprint/sprint-list-view";
import { SprintPanel } from "@/components/sprint/sprint-panel";
import { Button } from "@/components/ui/button";
import { useSetTopbar } from "@/lib/topbar-context";

interface SprintPageClientProps {
  canEdit: boolean;
  isAdmin: boolean;
  members: { userId: string; name: string | null; email: string | null }[];
  spaceColor: string | null;
  spaceId: string;
  spaceLogoEmoji: string | null;
  spaceName: string;
  sprintId: string;
  sprintStatus: "PLANNED" | "ACTIVE" | "CLOSED";
  workspaceId: string;
}

export function SprintPageClient({
  workspaceId,
  spaceId,
  sprintId,
  sprintStatus,
  spaceName,
  spaceColor,
  spaceLogoEmoji,
  isAdmin,
  canEdit,
  members,
}: SprintPageClientProps) {
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [showBacklog, setShowBacklog] = React.useState(false);

  useSetTopbar({
    breadcrumbs: [
      {
        label: spaceName,
        color: spaceColor,
        emoji: spaceLogoEmoji,
        href: `/${workspaceId}/${spaceId}`,
      },
    ],
    title: "Sprints",
  });

  function handleDataChanged() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <>
      <SprintPanel
        onDataChanged={handleDataChanged}
        spaceId={spaceId}
        workspaceId={workspaceId}
      />

      {sprintStatus === "CLOSED" ? (
        <ClosedSprintView
          spaceId={spaceId}
          sprintId={sprintId}
          workspaceId={workspaceId}
        />
      ) : (
        <>
          <SprintListView
            canEdit={canEdit}
            isAdmin={isAdmin}
            members={members}
            refreshKey={refreshKey}
            spaceId={spaceId}
            workspaceId={workspaceId}
          />

          {/* Backlog toggle */}
          <div className="pt-2">
            <Button
              className="gap-2 text-base-content/60 hover:text-base-content"
              onClick={() => setShowBacklog((v) => !v)}
              size="sm"
              variant="ghost"
            >
              <TrayIcon className="size-4" />
              {showBacklog ? "Hide Backlog" : "Show Backlog"}
            </Button>
          </div>

          {showBacklog && (
            <BacklogView
              refreshKey={refreshKey}
              spaceId={spaceId}
              sprintId={sprintId}
              workspaceId={workspaceId}
            />
          )}
        </>
      )}
    </>
  );
}
