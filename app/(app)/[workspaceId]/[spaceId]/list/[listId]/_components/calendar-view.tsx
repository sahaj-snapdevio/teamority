"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CaretLeftIcon, CaretRightIcon, PlusIcon } from "@phosphor-icons/react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isWeekend,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { updateTask } from "@/app/actions/task";
import { UserAvatar } from "@/components/common/user-avatar";
import { FacetFilter } from "@/components/filters/facet-filter";
import { useRealtimePause } from "@/components/realtime/realtime-provider";
import { CreateTaskModal } from "@/components/task/create-task-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SearchInput } from "@/components/ui/search-input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCreateTaskShortcut } from "@/hooks/use-create-task-shortcut";
import { PRIORITY_OPTIONS } from "@/lib/filters/options";
import { filterTasks } from "@/lib/filters/task-filter";
import { PRIORITY_CONFIG, type Priority } from "@/lib/priority-config";
import { setTaskNavContext } from "@/lib/task-nav-context";
import { cn } from "@/lib/utils";
import { MobileCalendar } from "./calendar-view-mobile";

export type Status = {
  id: string;
  name: string;
  color: string;
  type: "OPEN" | "ACTIVE" | "CLOSED";
};

export type CalendarTask = {
  id: string;
  title: string;
  priority: Priority;
  statusId: string | null;
  seqNumber: number;
  dueDateStart: Date | null;
  dueDateEnd: Date | null;
  assignees: { userId: string; name: string; image: string | null }[];
};

export type Member = {
  userId: string;
  name: string | null;
  email: string | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS_PER_DAY = 4;

export function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}
function parseDayKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

// The task's anchor day on the grid: its deadline (dueDateEnd) or, failing that,
// its start date. Tasks with neither are unscheduled and not shown.
export function primaryDay(t: CalendarTask): Date | null {
  const d = t.dueDateEnd ?? t.dueDateStart;
  return d ? startOfDay(new Date(d)) : null;
}

function isRange(t: CalendarTask): boolean {
  return (
    !!t.dueDateStart &&
    !!t.dueDateEnd &&
    !isSameDay(new Date(t.dueDateStart), new Date(t.dueDateEnd))
  );
}

export function CalendarView({
  workspaceId,
  spaceId,
  listId,
  statuses,
  tasks,
  members = [],
  canEdit = false,
}: {
  workspaceId: string;
  spaceId: string;
  listId: string;
  statuses: Status[];
  tasks: CalendarTask[];
  members?: Member[];
  canEdit?: boolean;
}) {
  const router = useRouter();
  const pauseRealtime = useRealtimePause();
  const dragResumeRef = React.useRef<null | (() => void)>(null);

  // Optimistic task list, synced from props (which refresh on realtime events).
  const [localTasks, setLocalTasks] = React.useState(tasks);
  React.useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  // Filters (same state + shared predicate as List/Board).
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = React.useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = React.useState<string[]>([]);

  // Current month — persisted per list so we return to the last month viewed.
  // Read from localStorage in an effect, not the useState initializer: the
  // initializer also runs during SSR (no localStorage there), so reading it
  // eagerly renders a different date server- vs client-side and trips a
  // hydration mismatch. Both sides start at `new Date()`; the effect restores
  // the saved value right after mount.
  const storageKey = `kanbanica:calendar-month:${listId}`;
  const [viewDate, setViewDate] = React.useState<Date>(() => new Date());
  React.useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      const d = new Date(saved);
      if (!Number.isNaN(d.getTime())) {
        setViewDate(d);
      }
    }
  }, [storageKey]);
  React.useEffect(() => {
    window.localStorage.setItem(storageKey, viewDate.toISOString());
  }, [viewDate, storageKey]);

  const [isPending, startTransition] = React.useTransition();
  function goToMonth(next: Date) {
    startTransition(() => setViewDate(next));
  }

  // Mobile-only: week vs month sub-view, persisted per list like `viewDate`
  // (and restored the same post-mount way, for the same hydration reason).
  const mobileModeStorageKey = `kanbanica:calendar-mobile-mode:${listId}`;
  const [mobileMode, setMobileMode] = React.useState<"week" | "month">("week");
  React.useEffect(() => {
    const saved = window.localStorage.getItem(mobileModeStorageKey);
    if (saved === "week" || saved === "month") {
      setMobileMode(saved);
    }
  }, [mobileModeStorageKey]);
  React.useEffect(() => {
    window.localStorage.setItem(mobileModeStorageKey, mobileMode);
  }, [mobileMode, mobileModeStorageKey]);

  // Mobile-only: the day whose agenda bottom sheet is open, and the filters
  // bottom sheet's open state.
  const [agendaDay, setAgendaDay] = React.useState<Date | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  const [activeTask, setActiveTask] = React.useState<CalendarTask | null>(null);
  const [createDay, setCreateDay] = React.useState<Date | null>(null);
  // "C" opens the Create Task popup (defaults the due date to today, matching
  // how creation works in the calendar — clicking a day).
  useCreateTaskShortcut(() => setCreateDay(new Date()), canEdit);
  const [pendingReschedule, setPendingReschedule] = React.useState<{
    taskId: string;
    newStart: Date | null;
    newEnd: Date | null;
  } | null>(null);

  const statusById = React.useMemo(
    () => new Map(statuses.map((s) => [s.id, s])),
    [statuses]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // The visible 6-week grid.
  const gridDays = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate));
    const end = endOfWeek(endOfMonth(viewDate));
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  // Mobile-only: the single visible week (Week View default).
  const weekDays = React.useMemo(() => {
    const start = startOfWeek(viewDate);
    const end = endOfWeek(viewDate);
    return eachDayOfInterval({ start, end });
  }, [viewDate]);

  // Count shown on the mobile "Filters" button badge — search has its own
  // always-visible input on mobile, so it's deliberately excluded here.
  const mobileFilterCount =
    statusFilter.length + priorityFilter.length + assigneeFilter.length;

  function resetMobileFilters() {
    setStatusFilter([]);
    setPriorityFilter([]);
    setAssigneeFilter([]);
  }

  // Deadline calendar: every task appears exactly ONCE, on its deadline
  // (dueDateEnd ?? dueDateStart). The start date is deliberately ignored for
  // placement so the month view shows deadlines, not multi-day duration bars.
  const tasksByDay = React.useMemo(() => {
    const filtered = filterTasks(localTasks, {
      searchQuery,
      statusFilter,
      priorityFilter,
      assigneeFilter,
    });
    const map = new Map<string, CalendarTask[]>();
    for (const t of filtered) {
      const anchor = primaryDay(t);
      if (!anchor) {
        continue; // unscheduled — not shown
      }
      const key = dayKey(anchor);
      const arr = map.get(key);
      if (arr) {
        arr.push(t);
      } else {
        map.set(key, [t]);
      }
    }
    return map;
  }, [localTasks, searchQuery, statusFilter, priorityFilter, assigneeFilter]);

  // Previous/Next Task nav context: the visible 6-week grid in chronological
  // order, each day's tasks in their displayed order — handed to Task Detail
  // so Prev/Next walks it without a DB query.
  const visibleOrderedTaskIds = React.useMemo(
    () =>
      gridDays.flatMap((day) =>
        (tasksByDay.get(dayKey(day)) ?? []).map((t) => t.id)
      ),
    [gridDays, tasksByDay]
  );

  function openTask(taskId: string) {
    setTaskNavContext({ taskIds: visibleOrderedTaskIds });
    router.push(`/${workspaceId}/task/${taskId}?from=calendar`);
  }

  // Compute new dates for a drop, preserving span for real ranges.
  function computeDrop(t: CalendarTask, fromKey: string, toKey: string) {
    const delta = differenceInCalendarDays(
      parseDayKey(toKey),
      parseDayKey(fromKey)
    );
    if (isRange(t)) {
      return {
        newStart: addDays(new Date(t.dueDateStart as Date), delta),
        newEnd: addDays(new Date(t.dueDateEnd as Date), delta),
      };
    }
    const target = parseDayKey(toKey);
    return { newStart: target, newEnd: target };
  }

  async function applyReschedule(
    taskId: string,
    newStart: Date | null,
    newEnd: Date | null
  ) {
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, dueDateStart: newStart, dueDateEnd: newEnd }
          : t
      )
    );
    const res = await updateTask(workspaceId, spaceId, listId, taskId, {
      dueDateStart: newStart,
      dueDateEnd: newEnd,
    });
    if (res && "error" in res) {
      setLocalTasks(tasks); // revert
      toast.error(res.error);
    }
  }

  function endDrag() {
    dragResumeRef.current?.();
    dragResumeRef.current = null;
  }

  function handleDragStart(event: DragStartEvent) {
    endDrag();
    dragResumeRef.current = pauseRealtime();
    const t = localTasks.find((x) => x.id === event.active.id);
    setActiveTask(t ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    endDrag();
    setActiveTask(null);
    const { active, over } = event;
    if (!over) {
      return;
    }
    const taskId = active.id as string;
    const fromKey = active.data.current?.fromDay as string | undefined;
    const toKey = over.id as string;
    if (!fromKey || fromKey === toKey) {
      return;
    }
    const task = localTasks.find((t) => t.id === taskId);
    if (!task) {
      return;
    }
    const { newStart, newEnd } = computeDrop(task, fromKey, toKey);
    // Guard: confirm before rescheduling a completed task.
    if (statusById.get(task.statusId ?? "")?.type === "CLOSED") {
      setPendingReschedule({ taskId, newStart, newEnd });
      return;
    }
    void applyReschedule(taskId, newStart, newEnd);
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col">
        {/* Sticky header block — the filter toolbar + weekday row freeze at the
            top of the page scroll (top-14 clears the List/Board/Calendar tabs)
            while the month grid scrolls underneath. Wrapping both in one sticky
            container avoids a fragile fixed offset, since the toolbar can wrap
            to two rows on narrow widths. Desktop/tablet only — mobile gets its
            own compact header in <MobileCalendar> below (same state/handlers,
            different presentation, matching the Board/List convention). */}
        <div className="sticky top-14 z-10 hidden shrink-0 bg-app md:block">
          {/* Toolbar: search + facet filters + month navigation. No top padding —
            the view already sits below the List/Board/Calendar tabs with the
            container's own gap, so a `py-*` here stacked a second gap on top and
            pushed the calendar down relative to the List/Board toolbars. */}
          <div className="flex flex-wrap items-center gap-2 border-b border-base-300 px-4 pb-2 shrink-0">
            {/* Wrapped in a sized container rather than putting `w-full` only on
              the input: SearchInput's own root is a plain (non-flex) div, so a
              percentage width on the input alone can't expand it to fill the
              toolbar row — the wrapper is the actual flex item that needs the
              explicit width. */}
            <div className="w-full sm:w-auto">
              <SearchInput
                className="w-full sm:w-44 sm:focus:w-56"
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery("")}
                placeholder="Search tasks…"
                value={searchQuery}
              />
            </div>
            <FacetFilter
              label="Status"
              onChange={setStatusFilter}
              options={statuses.map((s) => ({
                value: s.id,
                label: s.name,
                color: s.color,
              }))}
              selected={statusFilter}
            />
            <FacetFilter
              label="Priority"
              onChange={setPriorityFilter}
              options={PRIORITY_OPTIONS}
              selected={priorityFilter}
            />
            {members.length > 0 && (
              <FacetFilter
                label="Assignee"
                onChange={setAssigneeFilter}
                options={[
                  { value: "unassigned", label: "Unassigned" },
                  ...members.map((m) => ({
                    value: m.userId,
                    label: m.name || m.email || "Unknown",
                  })),
                ]}
                searchable
                selected={assigneeFilter}
              />
            )}

            <div className="ml-auto flex items-center gap-1">
              <button
                aria-label="Previous month"
                className="flex size-8 items-center justify-center rounded-md text-base-content/60 transition-colors hover:bg-base-200 hover:text-base-content"
                onClick={() => goToMonth(subMonths(viewDate, 1))}
                type="button"
              >
                <CaretLeftIcon className="size-4" />
              </button>
              <div className="min-w-36 text-center text-sm font-semibold">
                {format(viewDate, "MMMM yyyy")}
              </div>
              <button
                aria-label="Next month"
                className="flex size-8 items-center justify-center rounded-md text-base-content/60 transition-colors hover:bg-base-200 hover:text-base-content"
                onClick={() => goToMonth(addMonths(viewDate, 1))}
                type="button"
              >
                <CaretRightIcon className="size-4" />
              </button>
              <Button
                className="ml-1 h-8 text-xs"
                disabled={isSameMonth(viewDate, new Date())}
                onClick={() => goToMonth(new Date())}
                size="sm"
                variant="outline"
              >
                Today
              </Button>
            </div>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-base-300 text-2xs font-semibold uppercase tracking-wider text-base-content/60 shrink-0">
            {WEEKDAYS.map((d, i) => (
              <div
                className={cn(
                  "px-2 py-1.5",
                  (i === 0 || i === 6) && "bg-base-200/30 dark:bg-base-200/10"
                )}
                key={d}
              >
                {d}
              </div>
            ))}
          </div>
        </div>

        {/* Month grid */}
        <DndContext
          collisionDetection={closestCenter}
          onDragCancel={() => {
            endDrag();
            setActiveTask(null);
          }}
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
          sensors={sensors}
        >
          <div className="hidden flex-1 auto-rows-fr grid-cols-7 overflow-y-auto md:grid">
            {gridDays.map((day) => (
              <DayCell
                canEdit={canEdit}
                day={day}
                inMonth={isSameMonth(day, viewDate)}
                isPending={isPending}
                key={dayKey(day)}
                onCreate={() => setCreateDay(day)}
                onOpenTask={openTask}
                statusById={statusById}
                tasks={tasksByDay.get(dayKey(day)) ?? []}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <ChipVisual statusById={statusById} task={activeTask} />
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Mobile — week-first, bottom sheets, FAB. Desktop/tablet render
            above (hidden below md:); this owns the entire sub-md experience,
            sharing all state/handlers from this component. */}
        <MobileCalendar
          agendaDay={agendaDay}
          assigneeFilter={assigneeFilter}
          canEdit={canEdit}
          gridDays={gridDays}
          isPending={isPending}
          members={members}
          mobileFilterCount={mobileFilterCount}
          mobileFiltersOpen={mobileFiltersOpen}
          mobileMode={mobileMode}
          onAgendaDayChange={setAgendaDay}
          onAssigneeFilterChange={setAssigneeFilter}
          onCreateDay={(day) => setCreateDay(day)}
          onMobileFiltersOpenChange={setMobileFiltersOpen}
          onModeChange={setMobileMode}
          onNavigate={goToMonth}
          onOpenTask={openTask}
          onPriorityFilterChange={setPriorityFilter}
          onResetFilters={resetMobileFilters}
          onSearchChange={setSearchQuery}
          onStatusFilterChange={setStatusFilter}
          priorityFilter={priorityFilter}
          searchQuery={searchQuery}
          statusById={statusById}
          statuses={statuses}
          statusFilter={statusFilter}
          tasksByDay={tasksByDay}
          viewDate={viewDate}
          weekDays={weekDays}
        />

        {/* Create task on a clicked day — reuses the existing modal */}
        <CreateTaskModal
          canManage={canEdit}
          defaultDueDate={createDay}
          listId={listId}
          onCreated={() => setCreateDay(null)}
          onOpenChange={(o) => {
            if (!o) {
              setCreateDay(null);
            }
          }}
          open={!!createDay}
          spaceId={spaceId}
          statuses={statuses}
          workspaceId={workspaceId}
        />

        {/* Confirm rescheduling a completed task */}
        <AlertDialog
          onOpenChange={(o) => {
            if (!o) {
              setPendingReschedule(null);
            }
          }}
          open={!!pendingReschedule}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reschedule completed task?</AlertDialogTitle>
              <AlertDialogDescription>
                This task is already completed. Are you sure you want to change
                its due date?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingReschedule) {
                    void applyReschedule(
                      pendingReschedule.taskId,
                      pendingReschedule.newStart,
                      pendingReschedule.newEnd
                    );
                  }
                  setPendingReschedule(null);
                }}
              >
                Reschedule
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

function DayCell({
  day,
  tasks,
  inMonth,
  isPending,
  canEdit,
  statusById,
  onOpenTask,
  onCreate,
}: {
  day: Date;
  tasks: CalendarTask[];
  inMonth: boolean;
  isPending: boolean;
  canEdit: boolean;
  statusById: Map<string, Status>;
  onOpenTask: (taskId: string) => void;
  onCreate: () => void;
}) {
  const key = dayKey(day);
  const { setNodeRef, isOver } = useDroppable({ id: key });
  const today = isToday(day);
  const weekend = isWeekend(day);
  const visible = tasks.slice(0, MAX_CHIPS_PER_DAY);
  const overflow = tasks.length - visible.length;

  return (
    <div
      className={cn(
        "group relative min-h-36 border-b border-r border-base-300 p-1.5 transition-colors",
        weekend && "bg-base-200/30 dark:bg-base-200/10",
        !inMonth && "bg-base-200/20 text-base-content/60",
        isOver && "bg-primary/5 ring-1 ring-inset ring-primary/40"
      )}
      ref={setNodeRef}
    >
      <div className="mb-1 flex items-center justify-between">
        <button
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs transition-colors hover:bg-base-200",
            today && "bg-primary font-semibold text-primary-content",
            !today && !inMonth && "text-base-content/60"
          )}
          disabled={!canEdit}
          onClick={onCreate}
          title={canEdit ? "Create task" : undefined}
          type="button"
        >
          {format(day, "d")}
        </button>
        {canEdit && (
          <button
            className="flex items-center gap-0.5 rounded px-1 text-2xs text-base-content/60 opacity-0 transition-opacity hover:text-base-content group-hover:opacity-100 group-focus-within:opacity-100"
            onClick={onCreate}
            type="button"
          >
            <PlusIcon className="size-3" />
            Create
          </button>
        )}
      </div>

      <div className="space-y-1">
        {isPending ? (
          <>
            <div className="h-5 animate-pulse rounded bg-base-200" />
            <div className="h-5 w-2/3 animate-pulse rounded bg-base-200" />
          </>
        ) : (
          <>
            {visible.map((t) => (
              <CalendarChip
                canEdit={canEdit}
                dayKeyStr={key}
                key={`${t.id}-${key}`}
                onOpenTask={onOpenTask}
                statusById={statusById}
                task={t}
              />
            ))}
            {overflow > 0 && (
              <MorePopover
                onOpenTask={onOpenTask}
                overflow={overflow}
                statusById={statusById}
                tasks={tasks}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CalendarChip({
  task,
  dayKeyStr,
  canEdit,
  statusById,
  onOpenTask,
}: {
  task: CalendarTask;
  dayKeyStr: string;
  canEdit: boolean;
  statusById: Map<string, Status>;
  onOpenTask: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { fromDay: dayKeyStr },
    disabled: !canEdit,
  });

  return (
    <div
      className={isDragging ? "opacity-40" : undefined}
      ref={setNodeRef}
      {...(canEdit ? listeners : {})}
      {...attributes}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="w-full text-left"
            onClick={() => onOpenTask(task.id)}
            type="button"
          >
            <ChipVisual statusById={statusById} task={task} />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-56 break-words text-center">
          {task.title}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// Presentational chip (also used by the DragOverlay).
function ChipVisual({
  task,
  statusById,
}: {
  task: CalendarTask;
  statusById: Map<string, Status>;
}) {
  const status = statusById.get(task.statusId ?? "");
  const done = status?.type === "CLOSED";
  const anchor = primaryDay(task);
  const overdue = !done && anchor !== null && anchor < startOfDay(new Date());
  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const assignee = task.assignees[0];

  return (
    <div
      className={cn(
        "flex w-full items-center gap-1.5 rounded-sm border-l-4 border-blue-500 bg-blue-100 px-2 py-1 text-xs text-blue-950 shadow-sm dark:bg-blue-950/50 dark:text-blue-50",
        done && "opacity-50"
      )}
    >
      {overdue && (
        <span
          className="size-1.5 shrink-0 rounded-full bg-red-500"
          title="Overdue"
        />
      )}
      {task.priority !== "NONE" && (
        <span aria-hidden className="hidden shrink-0 leading-none sm:inline">
          {priorityCfg.icon}
        </span>
      )}
      <span className={cn("min-w-0 flex-1 truncate", done && "line-through")}>
        {task.title}
      </span>
      {assignee && (
        <UserAvatar
          className="hidden size-4 shrink-0 sm:flex"
          image={assignee.image}
          name={assignee.name}
          size="xs"
        />
      )}
    </div>
  );
}

function MorePopover({
  tasks,
  overflow,
  statusById,
  onOpenTask,
}: {
  tasks: CalendarTask[];
  overflow: number;
  statusById: Map<string, Status>;
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="w-full rounded px-1.5 py-0.5 text-left text-2xs font-medium text-base-content/60 transition-colors hover:bg-base-200 hover:text-base-content"
          type="button"
        >
          +{overflow} more
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-80 w-64 overflow-y-auto p-1"
      >
        <div className="space-y-0.5">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              onOpenTask={onOpenTask}
              statusById={statusById}
              task={t}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// A single task row: title, priority icon, status dot/name, assignee avatar.
// Shared by the desktop "+N more" popover and the mobile Day Agenda sheet.
export function TaskRow({
  task,
  statusById,
  onOpenTask,
  className,
}: {
  task: CalendarTask;
  statusById: Map<string, Status>;
  onOpenTask: (taskId: string) => void;
  className?: string;
}) {
  const status = statusById.get(task.statusId ?? "");
  const done = status?.type === "CLOSED";
  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const assignee = task.assignees[0];

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-base-200",
        done && "opacity-60",
        className
      )}
      onClick={() => onOpenTask(task.id)}
      type="button"
    >
      {task.priority !== "NONE" && (
        <span aria-hidden className="shrink-0 leading-none">
          {priorityCfg.icon}
        </span>
      )}
      <span className={cn("min-w-0 flex-1 truncate", done && "line-through")}>
        {task.title}
      </span>
      {status && (
        <span className="flex shrink-0 items-center gap-1 text-2xs text-base-content/60">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          {status.name}
        </span>
      )}
      {assignee && (
        <UserAvatar
          className="size-4 shrink-0"
          image={assignee.image}
          name={assignee.name}
          size="xs"
        />
      )}
    </button>
  );
}
