"use client";

import {
  FolderPlusIcon,
  LightningIcon,
  PlusCircleIcon,
  UserPlusIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { getListStatuses, getWorkspaceLists } from "@/app/actions/list";
import { getSprintSettings } from "@/app/actions/sprint";
import type { WorkspaceOverviewData } from "@/app/actions/workspace-overview";
import { SpaceIcon } from "@/components/common/space-icon";
import { CreateSprintModal } from "@/components/sprint/create-sprint-modal";
import { CreateTaskModal } from "@/components/task/create-task-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CreateSpaceModal } from "@/components/workspace/create-space-modal";
import { InviteMemberModal } from "@/components/workspace/invite-member-modal";

interface QuickActionsProps {
  onChanged: () => void;
  projects: WorkspaceOverviewData["projects"];
  workspaceId: string;
}

type ListPickerSpace = {
  id: string;
  name: string;
  color: string | null;
  logoEmoji: string | null;
  lists: { id: string; name: string; color: string | null }[];
};

type Status = {
  id: string;
  name: string;
  color: string;
  type: "OPEN" | "ACTIVE" | "CLOSED";
};

// ─── Create Task: pick a project → list, then reuse the existing task modal ───
function CreateTaskAction({
  workspaceId,
  onChanged,
}: {
  workspaceId: string;
  onChanged: () => void;
}) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [spaces, setSpaces] = React.useState<ListPickerSpace[] | null>(null);
  const [target, setTarget] = React.useState<{
    spaceId: string;
    listId: string;
    statuses: Status[];
  } | null>(null);
  const [loadingStatuses, setLoadingStatuses] = React.useState(false);

  async function handleOpenPopover(open: boolean) {
    setPopoverOpen(open);
    if (open && spaces === null) {
      const res = await getWorkspaceLists(workspaceId, "");
      setSpaces("error" in res ? [] : res.spaces);
    }
  }

  async function handlePickList(spaceId: string, listId: string) {
    setLoadingStatuses(true);
    const statuses = await getListStatuses(workspaceId, spaceId, listId);
    setLoadingStatuses(false);
    if ("error" in statuses) {
      return;
    }
    setPopoverOpen(false);
    setTarget({ spaceId, listId, statuses });
  }

  return (
    <>
      <Popover onOpenChange={handleOpenPopover} open={popoverOpen}>
        <PopoverTrigger asChild>
          <Button size="default" variant="outline">
            <PlusCircleIcon
              className="size-4 text-primary"
              data-icon="inline-start"
            />
            Create Task
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-64 p-1.5 max-h-80 overflow-y-auto"
        >
          <p className="px-2 py-1 text-2xs font-bold uppercase text-base-content/60">
            {loadingStatuses ? "Loading…" : "Choose a list"}
          </p>
          {spaces === null ? (
            <p className="px-2 py-1.5 text-xs text-base-content/60">Loading…</p>
          ) : spaces.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-base-content/60">
              No lists yet
            </p>
          ) : (
            spaces.map((sp) => (
              <div key={sp.id}>
                <p className="flex items-center gap-1.5 px-2 py-0.5 text-2xs font-bold uppercase text-base-content/60">
                  <SpaceIcon
                    color={sp.color ?? "#6B7280"}
                    emoji={sp.logoEmoji}
                  />
                  {sp.name}
                </p>
                {sp.lists.map((l) => (
                  <button
                    className="flex w-full items-center gap-2 rounded pl-5 pr-2 py-1.5 text-xs hover:bg-base-200 cursor-pointer disabled:opacity-50"
                    disabled={loadingStatuses}
                    key={l.id}
                    onClick={() => void handlePickList(sp.id, l.id)}
                    type="button"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: l.color ?? "#6B7280" }}
                    />
                    <span className="flex-1 truncate text-left">{l.name}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </PopoverContent>
      </Popover>

      {target && (
        <CreateTaskModal
          listId={target.listId}
          onCreated={onChanged}
          onOpenChange={(open) => !open && setTarget(null)}
          open
          spaceId={target.spaceId}
          statuses={target.statuses}
          workspaceId={workspaceId}
        />
      )}
    </>
  );
}

// ─── Start Sprint: pick a project, then reuse the sprint-settings gate ───
function StartSprintAction({
  workspaceId,
  projects,
  onChanged,
}: {
  workspaceId: string;
  projects: WorkspaceOverviewData["projects"];
  onChanged: () => void;
}) {
  const router = useRouter();
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [checking, setChecking] = React.useState<string | null>(null);
  const [sprintSpaceId, setSprintSpaceId] = React.useState<string | null>(null);

  async function handlePickProject(spaceId: string) {
    setChecking(spaceId);
    const settings = await getSprintSettings(workspaceId, spaceId);
    setChecking(null);
    setPopoverOpen(false);
    if ("error" in settings || settings.sprintStartDay === null) {
      router.push(`/${workspaceId}/${spaceId}/settings/sprints`);
      return;
    }
    setSprintSpaceId(spaceId);
  }

  return (
    <>
      <Popover onOpenChange={setPopoverOpen} open={popoverOpen}>
        <PopoverTrigger asChild>
          <Button size="default" variant="outline">
            <LightningIcon
              className="size-4 text-success"
              data-icon="inline-start"
              weight="fill"
            />
            Start Sprint
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-56 p-1.5 max-h-80 overflow-y-auto"
        >
          <p className="px-2 py-1 text-2xs font-bold uppercase text-base-content/60">
            Choose a project
          </p>
          {projects.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-base-content/60">
              No projects yet
            </p>
          ) : (
            projects.map((p) => (
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-base-200 cursor-pointer disabled:opacity-50"
                disabled={checking !== null}
                key={p.id}
                onClick={() => void handlePickProject(p.id)}
                type="button"
              >
                <SpaceIcon color={p.color} emoji={p.logoEmoji} />
                <span className="flex-1 truncate text-left">{p.name}</span>
                {checking === p.id && (
                  <span className="text-2xs text-base-content/60">…</span>
                )}
              </button>
            ))
          )}
        </PopoverContent>
      </Popover>

      {sprintSpaceId && (
        <CreateSprintModal
          onCreated={() => {
            setSprintSpaceId(null);
            onChanged();
          }}
          onOpenChange={(open) => !open && setSprintSpaceId(null)}
          open
          spaceId={sprintSpaceId}
          workspaceId={workspaceId}
        />
      )}
    </>
  );
}

export function QuickActions({
  workspaceId,
  projects,
  onChanged,
}: QuickActionsProps) {
  const [createProjectOpen, setCreateProjectOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium text-base-content/60">
          Quick Actions
        </span>

        <CreateTaskAction onChanged={onChanged} workspaceId={workspaceId} />
        <StartSprintAction
          onChanged={onChanged}
          projects={projects}
          workspaceId={workspaceId}
        />

        <Button
          onClick={() => setCreateProjectOpen(true)}
          size="default"
          variant="outline"
        >
          <FolderPlusIcon
            className="size-4 text-info"
            data-icon="inline-start"
          />
          Create Project
        </Button>

        <Button
          onClick={() => setInviteOpen(true)}
          size="default"
          variant="outline"
        >
          <UserPlusIcon
            className="size-4 text-purple-500 dark:text-purple-400"
            data-icon="inline-start"
          />
          Invite Member
        </Button>
      </div>

      <CreateSpaceModal
        onOpenChange={setCreateProjectOpen}
        open={createProjectOpen}
        workspaceId={workspaceId}
      />
      <InviteMemberModal
        onOpenChange={setInviteOpen}
        open={inviteOpen}
        workspaceId={workspaceId}
      />
    </Card>
  );
}
