"use client";

import * as React from "react";
import { TrayIcon } from "@phosphor-icons/react";
import { SprintPanel } from "@/components/sprint/sprint-panel";
import { SprintListView } from "@/components/sprint/sprint-list-view";
import { ClosedSprintView } from "@/components/sprint/closed-sprint-view";
import { BacklogView } from "@/components/sprint/backlog-view";
import { Button } from "@/components/ui/button";
import { useSetTopbar } from "@/lib/topbar-context";

interface SprintPageClientProps {
  workspaceId: string;
  spaceId: string;
  sprintId: string;
  sprintStatus: "PLANNED" | "ACTIVE" | "CLOSED";
  spaceName: string;
  spaceColor: string | null;
  spaceLogoEmoji: string | null;
  isAdmin: boolean;
  canEdit: boolean;
  members: { userId: string; name: string | null; email: string | null }[];
}

export function SprintPageClient({ workspaceId, spaceId, sprintId, sprintStatus, spaceName, spaceColor, spaceLogoEmoji, isAdmin, canEdit, members }: SprintPageClientProps) {
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
        workspaceId={workspaceId}
        spaceId={spaceId}
        onDataChanged={handleDataChanged}
      />

      {sprintStatus === "CLOSED" ? (
        <ClosedSprintView
          workspaceId={workspaceId}
          spaceId={spaceId}
          sprintId={sprintId}
        />
      ) : (
        <>
          <SprintListView
            workspaceId={workspaceId}
            spaceId={spaceId}
            isAdmin={isAdmin}
            canEdit={canEdit}
            members={members}
            refreshKey={refreshKey}
          />

          {/* Backlog toggle */}
          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-base-content/60 hover:text-base-content"
              onClick={() => setShowBacklog((v) => !v)}
            >
              <TrayIcon className="size-4" />
              {showBacklog ? "Hide Backlog" : "Show Backlog"}
            </Button>
          </div>

          {showBacklog && (
            <BacklogView
              workspaceId={workspaceId}
              spaceId={spaceId}
              sprintId={sprintId}
              refreshKey={refreshKey}
            />
          )}
        </>
      )}
    </>
  );
}
