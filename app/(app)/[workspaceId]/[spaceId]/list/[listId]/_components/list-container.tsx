"use client";

import {
  ArchiveIcon,
  CalendarBlankIcon,
  CopyIcon,
  DotsThreeIcon,
  GearIcon,
  RowsIcon,
  SquaresFourIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { useState, useTransition } from "react";
import { archiveList, unarchiveList } from "@/app/actions/list";
import { getArchivedTasksForList } from "@/app/actions/task";
import { DeleteListDialog } from "@/components/list/delete-list-dialog";
import { DuplicateListDialog } from "@/components/list/duplicate-list-dialog";
import { CreateTaskModal } from "@/components/task/create-task-modal";
import type { TaskDependencyIndicator } from "@/components/task/task-dependency-badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSetTopbar } from "@/lib/topbar-context";
import { toastWithUndo } from "@/lib/undo-toast";
import { cn } from "@/lib/utils";
import { BoardSkeleton } from "./board-skeleton";
import { BoardView } from "./board-view";
import { CalendarView } from "./calendar-view";
import { ListView } from "./list-view";

type View = "list" | "board" | "calendar";

interface Status {
  color: string;
  id: string;
  name: string;
  orderIndex: number;
  type: "OPEN" | "ACTIVE" | "CLOSED";
}

interface Task {
  assignees: { userId: string; name: string; image: string | null }[];
  dependencyInfo?: TaskDependencyIndicator;
  trackedSeconds?: number;
  dueDateEnd: Date | null;
  dueDateStart: Date | null;
  id: string;
  isPinnedToList: boolean;
  orderIndex: number;
  pinnedToListOrder: number | null;
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  seqNumber: number;
  statusId: string | null;
  tags: { id: string; name: string; color: string }[];
  title: string;
}

interface ListContainerProps {
  canEdit: boolean;
  canManage: boolean;
  canPinToList: boolean;
  currentUserId: string;
  isAdmin: boolean;
  list: {
    id: string;
    name: string;
    color: string | null;
    description: string | null;
  };
  members: { userId: string; name: string | null; email: string | null }[];
  personallyPinnedIds: Set<string>;
  pinnedTasks: Task[];
  space: { id: string; name: string; color: string | null };
  statuses: Status[];
  tags: { id: string; name: string; color: string }[];
  tasks: Task[];
  workspaceId: string;
}

const VIEWS: { key: View; label: string; icon: React.ReactNode }[] = [
  { key: "list", label: "List", icon: <RowsIcon className="size-3.5" /> },
  {
    key: "board",
    label: "Board",
    icon: <SquaresFourIcon className="size-3.5" />,
  },
  {
    key: "calendar",
    label: "Calendar",
    icon: <CalendarBlankIcon className="size-3.5" />,
  },
];

export function ListContainer({
  workspaceId,
  space,
  list,
  statuses,
  tasks,
  pinnedTasks,
  members,
  tags,
  canManage,
  canEdit,
  isAdmin,
  canPinToList,
  currentUserId,
  personallyPinnedIds,
}: ListContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<View>(
    (searchParams.get("view") as View) ?? "list"
  );

  useSetTopbar({
    breadcrumbs: [
      { label: space.name, color: space.color, href: `/${workspaceId}/${space.id}` },
    ],
    title: list.name,
    actions:
      canManage || isAdmin ? (
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex size-7 items-center justify-center rounded-md hover:bg-accent transition-colors">
              <DotsThreeIcon
                className="size-4.5 text-foreground/70"
                weight="bold"
              />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1">
            {canManage && (
              <>
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                  onClick={() =>
                    router.push(
                      `/${workspaceId}/${space.id}/list/${list.id}/settings/general`
                    )
                  }
                >
                  <GearIcon className="size-3.5 shrink-0 text-muted-foreground" />{" "}
                  Settings
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                  onClick={() => setDuplicateOpen(true)}
                >
                  <CopyIcon className="size-3.5 shrink-0 text-muted-foreground" />{" "}
                  Duplicate
                </button>
                <div className="my-1 h-px bg-border" />
                <button
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={async () => {
                    const res = await archiveList(
                      workspaceId,
                      space.id,
                      list.id
                    );
                    if (!("error" in res)) {
                      router.push(`/${workspaceId}/${space.id}`);
                      toastWithUndo("List archived", async () => {
                        const undo = await unarchiveList(
                          workspaceId,
                          space.id,
                          list.id
                        );
                        if (!("error" in undo)) {
                          router.push(
                            `/${workspaceId}/${space.id}/list/${list.id}`
                          );
                        }
                      });
                    }
                  }}
                >
                  <ArchiveIcon className="size-3.5 shrink-0" /> Archive List
                </button>
              </>
            )}
            {isAdmin && (
              <button
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
                onClick={() => setDeleteOpen(true)}
              >
                <TrashIcon className="size-3.5 shrink-0" /> Delete List
              </button>
            )}
          </PopoverContent>
        </Popover>
      ) : undefined,
  });
  const [pendingView, setPendingView] = useState<View | null>(null);
  const [isViewPending, startViewTransition] = useTransition();

  // Defer the heavy Board mount so the tab click stays responsive. `pendingView`
  // is set urgently (so a shaped skeleton paints immediately), while the actual
  // view swap runs inside the transition and replaces the skeleton when ready.
  function switchView(next: View) {
    if (next === view) {
      return;
    }
    setPendingView(next);
    startViewTransition(() => {
      setView(next);
      setPendingView(null);
    });
  }

  const showBoardSkeleton = isViewPending && pendingView === "board";
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const [archivedTasks, setArchivedTasks] = React.useState<
    { id: string; title: string; seqNumber: number }[]
  >([]);
  const [archivedLoading, setArchivedLoading] = React.useState(false);

  async function handleToggleArchived() {
    if (!showArchived && archivedTasks.length === 0) {
      setArchivedLoading(true);
      const result = await getArchivedTasksForList(
        workspaceId,
        space.id,
        list.id
      );
      if (!("error" in result)) {
        setArchivedTasks(result.tasks);
      }
      setArchivedLoading(false);
    }
    setShowArchived((v) => !v);
  }

  return (
    <div className="space-y-5 p-6">
      <CreateTaskModal
        canManage={canManage}
        listId={list.id}
        onOpenChange={setCreateOpen}
        open={createOpen}
        spaceId={space.id}
        statuses={statuses}
        workspaceId={workspaceId}
      />
      {isAdmin && (
        <DeleteListDialog
          list={list}
          onOpenChange={setDeleteOpen}
          open={deleteOpen}
          spaceId={space.id}
          workspaceId={workspaceId}
        />
      )}
      {canManage && (
        <DuplicateListDialog
          list={list}
          onOpenChange={setDuplicateOpen}
          open={duplicateOpen}
          spaceId={space.id}
          workspaceId={workspaceId}
        />
      )}

      {/* View tabs — sticky to the top of the scroll area. Full-bleed (`-mx-6
          px-6`) so scrolling rows pass under it; `-mt-6 pt-6` pins it flush to
          the container top without a gap. */}
      <div className="sticky top-0 z-20 -mx-6 -mt-6 flex items-center gap-1 border-b bg-app px-6 pt-6">
        {VIEWS.map(({ key, label, icon }) => (
          <button
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer",
              view === key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
            key={key}
            onClick={() => switchView(key)}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Active view — while switching into Board, show a board-shaped skeleton
          and suppress the outgoing view so they don't overlap. */}
      {showBoardSkeleton && <BoardSkeleton columns={statuses.length || 4} />}
      {!showBoardSkeleton && view === "list" && (
        <ListView
          archivedLoading={archivedLoading}
          archivedTasks={showArchived ? archivedTasks : []}
          canEdit={canEdit}
          canPinToList={canPinToList}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          listId={list.id}
          members={members}
          onArchivedChanged={async () => {
            const result = await getArchivedTasksForList(
              workspaceId,
              space.id,
              list.id
            );
            if (!("error" in result)) {
              setArchivedTasks(result.tasks);
            }
          }}
          onToggleArchived={handleToggleArchived}
          personallyPinnedIds={personallyPinnedIds}
          pinnedTasks={pinnedTasks}
          showArchived={showArchived}
          spaceId={space.id}
          statuses={statuses}
          tags={tags}
          tasks={tasks}
          workspaceId={workspaceId}
        />
      )}
      {!showBoardSkeleton && view === "board" && (
        <BoardView
          canEdit={canEdit}
          canManage={canManage}
          headerless
          isAdmin={isAdmin}
          list={list}
          members={members}
          space={space}
          statuses={statuses}
          tags={tags}
          tasks={tasks}
          workspaceId={workspaceId}
        />
      )}
      {!showBoardSkeleton && view === "calendar" && (
        <CalendarView
          canEdit={canEdit}
          listId={list.id}
          members={members}
          spaceId={space.id}
          statuses={statuses}
          tasks={[...pinnedTasks, ...tasks]}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
}
