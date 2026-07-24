"use client";

import {
  CaretRightIcon,
  ClockIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react";
import { format, isToday, isYesterday } from "date-fns";
import * as React from "react";
import { toast } from "sonner";
import {
  deleteTimeEntry,
  logTime,
  setTimeEntryNote,
  startTimer,
  stopTimer,
} from "@/app/actions/time-tracking";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDuration, formatTimer } from "@/lib/format-duration";
import { cn } from "@/lib/utils";

// One time-entry row as returned by getTaskDetail. `endTime` NULL ⇒ running.
export type TimeEntryRow = {
  id: string;
  userId: string;
  startTime: string | Date;
  endTime: string | Date | null;
  durationSeconds: number | null;
  description: string | null;
  userName: string | null;
  userImage: string | null;
};

const toMs = (d: string | Date) => new Date(d).getTime();

export function TaskTimeTracking({
  workspaceId,
  spaceId,
  listId,
  taskId,
  canEdit,
  entries,
  currentUserId,
  onChanged,
  hideHeader = false,
}: {
  workspaceId: string;
  spaceId: string;
  listId: string;
  taskId: string;
  canEdit: boolean;
  entries: TimeEntryRow[];
  currentUserId: string;
  onChanged: () => void;
  /** Hide the built-in "Time Tracking" heading (a parent section supplies it). */
  hideHeader?: boolean;
}) {
  const [pending, setPending] = React.useState(false);
  const [logOpen, setLogOpen] = React.useState(false);
  // The entry that was just stopped, awaiting an optional note. Set after the
  // stop has already been written, so the note prompt never inflates the
  // recorded duration.
  const [noteFor, setNoteFor] = React.useState<{
    entryId: string;
    seconds: number;
  } | null>(null);
  // Which per-user history groups are expanded, keyed by `${dayLabel}::${userId}`.
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggleGroup = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  // The caller's own running timer (drives the Start/Stop control).
  const running = entries.find(
    (e) => e.userId === currentUserId && e.endTime === null
  );
  const anyRunning = entries.some((e) => e.endTime === null);

  // Live clock: tick a `now` state each second only while something runs. Kept
  // null until mounted to avoid a hydration mismatch on the ticking numbers.
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!anyRunning) {
      setNow(null);
      return;
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyRunning]);

  const completedSeconds = entries.reduce(
    (sum, e) => sum + (e.endTime === null ? 0 : (e.durationSeconds ?? 0)),
    0
  );
  const liveSeconds =
    now === null
      ? 0
      : entries.reduce(
          (sum, e) =>
            e.endTime === null
              ? sum + Math.max(0, Math.floor((now - toMs(e.startTime)) / 1000))
              : sum,
          0
        );
  const displayedTotal = completedSeconds + liveSeconds;

  const runningElapsed =
    running && now !== null
      ? Math.max(0, Math.floor((now - toMs(running.startTime)) / 1000))
      : 0;

  // Completed entries, newest-first, grouped by calendar day.
  const history = entries.filter((e) => e.endTime !== null);

  async function handleStart() {
    if (pending) {
      return;
    }
    setPending(true);
    const res = await startTimer(workspaceId, spaceId, listId, taskId);
    setPending(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    if (res.stopped) {
      toast(`Stopped timer on ${res.stopped.title}`, {
        description: `Started timer on ${res.startedTitle}`,
      });
    }
    onChanged();
  }

  async function handleStop() {
    if (pending) {
      return;
    }
    setPending(true);
    const res = await stopTimer(workspaceId, spaceId, listId, taskId);
    setPending(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setNoteFor({ entryId: res.entryId, seconds: res.seconds });
    onChanged();
  }

  async function handleDelete(entryId: string) {
    const res = await deleteTimeEntry(
      workspaceId,
      spaceId,
      listId,
      taskId,
      entryId
    );
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    onChanged();
  }

  return (
    <div>
      {!hideHeader && (
        <div className="mb-2 flex items-center gap-2">
          <ClockIcon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Time Tracking</h3>
        </div>
      )}

      {/* Total + control */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
        <div>
          <div className="text-xs text-muted-foreground">Tracked Time</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatDuration(displayedTotal)}
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {running ? (
              <>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Running…{" "}
                  <span className="tabular-nums">
                    {formatTimer(runningElapsed)}
                  </span>
                </span>
                <Button
                  disabled={pending}
                  onClick={handleStop}
                  size="sm"
                  variant="secondary"
                >
                  <PauseIcon className="size-4" weight="fill" />
                  Stop Timer
                </Button>
              </>
            ) : (
              <Button disabled={pending} onClick={handleStart} size="sm">
                <PlayIcon className="size-4" weight="fill" />
                Start Timer
              </Button>
            )}
          </div>
        )}
      </div>

      {canEdit && (
        <button
          className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setLogOpen(true)}
          type="button"
        >
          <PlusIcon className="size-3.5" />
          Log Time
        </button>
      )}

      {/* History — grouped by day, then by user (each user collapsible) */}
      {history.length > 0 && (
        <div className="mt-4 space-y-3">
          {groupHistory(history).map((day) => (
            <div key={day.label}>
              <Label className="mb-1.5 block text-xs text-muted-foreground">
                {day.label}
              </Label>
              <div className="space-y-1">
                {day.users.map((u) => {
                  const key = `${day.label}::${u.userId}`;
                  const isOpen = expanded.has(key);
                  return (
                    <div className="rounded-md border" key={key}>
                      {/* Collapsed user row: avatar · name · total · chevron */}
                      <button
                        aria-expanded={isOpen}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
                        onClick={() => toggleGroup(key)}
                        type="button"
                      >
                        <CaretRightIcon
                          className={cn(
                            "size-3 shrink-0 text-muted-foreground transition-transform",
                            isOpen && "rotate-90"
                          )}
                          weight="bold"
                        />
                        <UserAvatar
                          image={u.userImage}
                          name={u.userName}
                          size="xs"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {u.userName ?? "Deleted User"}
                        </span>
                        <span className="shrink-0 text-sm font-medium tabular-nums">
                          {formatDuration(u.totalSeconds)}
                        </span>
                      </button>

                      {/* Expanded: timeline of this user's sessions */}
                      {isOpen && (
                        <div className="space-y-2 border-t px-2.5 py-2 pl-8">
                          {u.rows.map((e) => (
                            <div
                              className="group flex items-start gap-2"
                              key={e.id}
                            >
                              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
                                    {sessionTimeLabel(e)}
                                  </span>
                                  <span className="ml-auto shrink-0 text-sm font-medium tabular-nums">
                                    {formatDuration(e.durationSeconds)}
                                  </span>
                                  {canEdit && e.userId === currentUserId && (
                                    <button
                                      aria-label="Delete time entry"
                                      className="flex size-5 shrink-0 items-center justify-center rounded text-destructive opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                                      onClick={() => handleDelete(e.id)}
                                      type="button"
                                    >
                                      <XIcon className="size-3" />
                                    </button>
                                  )}
                                </div>
                                {e.description && (
                                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                    {e.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {history.length === 0 && !running && (
        <p className="mt-3 text-xs text-muted-foreground">
          No time tracked yet.
        </p>
      )}

      {logOpen && (
        <LogTimeDialog
          listId={listId}
          onChanged={onChanged}
          onOpenChange={setLogOpen}
          spaceId={spaceId}
          taskId={taskId}
          workspaceId={workspaceId}
        />
      )}

      {noteFor && (
        <StopNoteDialog
          entryId={noteFor.entryId}
          listId={listId}
          onChanged={onChanged}
          onClose={() => setNoteFor(null)}
          seconds={noteFor.seconds}
          spaceId={spaceId}
          taskId={taskId}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
}

// Optional note prompt shown right after a timer stops. The stop is already
// saved by the time this opens, so skipping (or closing) it is a no-op — it
// only ever adds a note to the entry that was just written.
function StopNoteDialog({
  workspaceId,
  spaceId,
  listId,
  taskId,
  entryId,
  seconds,
  onClose,
  onChanged,
}: {
  workspaceId: string;
  spaceId: string;
  listId: string;
  taskId: string;
  entryId: string;
  seconds: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    const trimmed = note.trim();
    if (!trimmed) {
      onClose();
      return;
    }
    setSaving(true);
    const res = await setTimeEntryNote(
      workspaceId,
      spaceId,
      listId,
      taskId,
      entryId,
      trimmed
    );
    setSaving(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    onClose();
    onChanged();
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Timer stopped</DialogTitle>
          <DialogDescription>
            {formatDuration(seconds)} tracked. Add a note about what you worked
            on — optional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="stop-note">Note</Label>
          <Input
            autoFocus
            id="stop-note"
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            placeholder="What did you work on?"
            value={note}
          />
        </div>

        <DialogFooter>
          <Button
            disabled={saving}
            onClick={onClose}
            type="button"
            variant="ghost"
          >
            Skip
          </Button>
          <Button disabled={saving || !note.trim()} onClick={handleSave} type="button">
            {saving ? "Saving…" : "Save note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type UserGroup = {
  userId: string;
  userName: string | null;
  userImage: string | null;
  totalSeconds: number;
  rows: TimeEntryRow[];
};
type DayGroup = { label: string; users: UserGroup[] };

// Group completed entries by day (preserving the incoming newest-first day
// order), then by user within each day. Per-user totals sum the sessions;
// users are ordered by total desc, and each user's sessions run chronologically
// (earliest first) for a timeline read.
function groupHistory(rows: TimeEntryRow[]): DayGroup[] {
  const days: DayGroup[] = [];
  for (const row of rows) {
    const d = new Date(row.startTime);
    const label = isToday(d)
      ? "Today"
      : isYesterday(d)
        ? "Yesterday"
        : format(d, "MMM d, yyyy");

    let day = days.find((g) => g.label === label);
    if (!day) {
      day = { label, users: [] };
      days.push(day);
    }

    let user = day.users.find((u) => u.userId === row.userId);
    if (!user) {
      user = {
        userId: row.userId,
        userName: row.userName,
        userImage: row.userImage,
        totalSeconds: 0,
        rows: [],
      };
      day.users.push(user);
    }
    user.rows.push(row);
    user.totalSeconds += row.durationSeconds ?? 0;
  }

  for (const day of days) {
    day.users.sort((a, b) => b.totalSeconds - a.totalSeconds);
    for (const user of day.users) {
      user.rows.sort((a, b) => toMs(a.startTime) - toMs(b.startTime));
    }
  }
  return days;
}

// A session's time label: "12:58 PM – 1:09 PM" for a real timer interval, or a
// single "2:10 PM" for a manually-logged block (start === end).
function sessionTimeLabel(e: TimeEntryRow): string {
  const start = new Date(e.startTime);
  const startLabel = format(start, "h:mm a");
  if (e.endTime === null) {
    return startLabel;
  }
  const end = new Date(e.endTime);
  if (start.getTime() === end.getTime()) {
    return startLabel;
  }
  return `${startLabel} – ${format(end, "h:mm a")}`;
}

function LogTimeDialog({
  workspaceId,
  spaceId,
  listId,
  taskId,
  onOpenChange,
  onChanged,
}: {
  workspaceId: string;
  spaceId: string;
  listId: string;
  taskId: string;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [hours, setHours] = React.useState("");
  const [minutes, setMinutes] = React.useState("");
  const [date, setDate] = React.useState<Date>(() => new Date());
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [calendarOpen, setCalendarOpen] = React.useState(false);

  const h = Number.parseInt(hours || "0", 10);
  const m = Number.parseInt(minutes || "0", 10);
  const valid = Number.isFinite(h) && Number.isFinite(m) && h * 60 + m > 0;

  async function handleSave() {
    if (!valid || saving) {
      return;
    }
    setSaving(true);
    const res = await logTime(workspaceId, spaceId, listId, taskId, {
      hours: h,
      minutes: m,
      date: date.toISOString(),
      description: description.trim() || undefined,
    });
    setSaving(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    onOpenChange(false);
    onChanged();
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log time</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="log-hours">Hours</Label>
              <Input
                id="log-hours"
                inputMode="numeric"
                min={0}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                type="number"
                value={hours}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="log-minutes">Minutes</Label>
              <Input
                id="log-minutes"
                inputMode="numeric"
                min={0}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="0"
                type="number"
                value={minutes}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Date</Label>
            <Popover onOpenChange={setCalendarOpen} open={calendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  className="w-full justify-start font-normal"
                  variant="outline"
                >
                  {format(date, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  onSelect={(d) => {
                    if (d) {
                      setDate(d);
                    }
                    setCalendarOpen(false);
                  }}
                  selected={date}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="log-description">Description (optional)</Label>
            <Input
              id="log-description"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?"
              value={description}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            disabled={!valid || saving}
            onClick={handleSave}
            type="button"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
