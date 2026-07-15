import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleDueDateReminder } from "@/lib/worker/handlers/due-date-reminder";

const { selectMock, createNotificationsMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  createNotificationsMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { select: selectMock } }));
vi.mock("@/lib/notifications/create-notification", () => ({
  createNotifications: createNotificationsMock,
}));

interface QueryChain extends PromiseLike<unknown[]> {
  from: () => QueryChain;
  innerJoin: () => QueryChain;
  limit: () => Promise<unknown[]>;
  where: () => QueryChain;
}

function createChain(result: unknown[]): QueryChain {
  const chain: QueryChain = {
    from: () => chain,
    where: () => chain,
    innerJoin: () => chain,
    limit: () => Promise.resolve(result),
    // biome-ignore lint/suspicious/noThenProperty: mirrors Drizzle's own thenable query builder
    then: (onfulfilled, onrejected) =>
      Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return chain;
}

function queueSelectResults(...batches: unknown[][]) {
  let index = 0;
  selectMock.mockImplementation(() => {
    const result = batches[index] ?? [];
    index += 1;
    return createChain(result);
  });
}

const noTasks: unknown[] = [];

beforeEach(() => {
  selectMock.mockReset();
  createNotificationsMock.mockReset();
});

describe("handleDueDateReminder", () => {
  it("sends a 1-day reminder for a task due tomorrow", async () => {
    queueSelectResults(
      [{ id: "t1", title: "Task 1", workspaceId: "w1" }], // due tomorrow
      noTasks, // due today
      noTasks, // overdue
      [], // alreadyNotified check
      [{ userId: "u1" }], // assignees
      [] // watchers
    );
    await handleDueDateReminder([]);
    expect(createNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerType: "due_date_reminder_1day",
        entityId: "t1",
        recipientIds: ["u1"],
      })
    );
  });

  it("sends a due-today reminder for a task due today", async () => {
    queueSelectResults(
      noTasks,
      [{ id: "t2", title: "Task 2", workspaceId: "w1" }],
      noTasks,
      [],
      [{ userId: "u1" }],
      []
    );
    await handleDueDateReminder([]);
    expect(createNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ triggerType: "due_date_today", entityId: "t2" })
    );
  });

  it("sends an overdue reminder for an overdue task", async () => {
    queueSelectResults(
      noTasks,
      noTasks,
      [{ id: "t3", title: "Task 3", workspaceId: "w1" }],
      [],
      [{ userId: "u1" }],
      []
    );
    await handleDueDateReminder([]);
    expect(createNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ triggerType: "task_overdue", entityId: "t3" })
    );
  });

  it("skips a task that was already notified today, without querying recipients", async () => {
    queueSelectResults(
      [{ id: "t1", title: "Task 1", workspaceId: "w1" }],
      noTasks,
      noTasks,
      [{ id: "existing-notif" }] // already notified
    );
    await handleDueDateReminder([]);
    expect(selectMock).toHaveBeenCalledTimes(4);
    expect(createNotificationsMock).not.toHaveBeenCalled();
  });

  it("skips a task with no assignees or watchers", async () => {
    queueSelectResults(
      [{ id: "t1", title: "Task 1", workspaceId: "w1" }],
      noTasks,
      noTasks,
      [],
      [], // no assignees
      [] // no watchers
    );
    await handleDueDateReminder([]);
    expect(createNotificationsMock).not.toHaveBeenCalled();
  });

  it("deduplicates a user who is both assignee and watcher", async () => {
    queueSelectResults(
      [{ id: "t1", title: "Task 1", workspaceId: "w1" }],
      noTasks,
      noTasks,
      [],
      [{ userId: "u1" }],
      [{ userId: "u1" }]
    );
    await handleDueDateReminder([]);
    expect(createNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ recipientIds: ["u1"] })
    );
  });

  it("includes the task title in the notification message", async () => {
    queueSelectResults(
      [{ id: "t1", title: "Ship the release", workspaceId: "w1" }],
      noTasks,
      noTasks,
      [],
      [{ userId: "u1" }],
      []
    );
    await handleDueDateReminder([]);
    expect(createNotificationsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("Ship the release"),
      })
    );
  });
});
