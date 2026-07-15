import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleSprintAutoClose } from "@/lib/worker/handlers/sprint-auto-close";

const { selectMock, closeSprintAndRolloverMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  closeSprintAndRolloverMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { select: selectMock } }));
vi.mock("@/lib/sprint/rollover", () => ({
  closeSprintAndRollover: closeSprintAndRolloverMock,
}));

interface QueryChain extends PromiseLike<unknown[]> {
  from: () => QueryChain;
  innerJoin: () => QueryChain;
  where: () => QueryChain;
}

function createChain(result: unknown[]): QueryChain {
  const chain: QueryChain = {
    from: () => chain,
    where: () => chain,
    innerJoin: () => chain,
    // biome-ignore lint/suspicious/noThenProperty: mirrors Drizzle's own thenable query builder
    then: (onfulfilled, onrejected) =>
      Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return chain;
}

function queueEligibleSprints(result: unknown[]) {
  selectMock.mockReturnValue(createChain(result));
}

beforeEach(() => {
  selectMock.mockReset();
  closeSprintAndRolloverMock.mockReset();
  closeSprintAndRolloverMock.mockResolvedValue({ nextSprintId: null });
});

describe("handleSprintAutoClose", () => {
  it("does nothing when there are no eligible sprints", async () => {
    queueEligibleSprints([]);
    await handleSprintAutoClose([]);
    expect(closeSprintAndRolloverMock).not.toHaveBeenCalled();
  });

  it("closes an eligible sprint with move_to_next_sprint when moveIncomplete is true", async () => {
    queueEligibleSprints([
      {
        id: "s1",
        name: "Sprint 1",
        spaceId: "sp1",
        createdBy: "u1",
        autoCreateNext: true,
        moveIncomplete: true,
      },
    ]);
    await handleSprintAutoClose([]);
    expect(closeSprintAndRolloverMock).toHaveBeenCalledWith({
      spaceId: "sp1",
      sprintId: "s1",
      actorId: "u1",
      autoCreateNext: true,
      incompleteStrategy: "move_to_next_sprint",
    });
  });

  it("uses move_to_backlog when moveIncomplete is false", async () => {
    queueEligibleSprints([
      {
        id: "s1",
        name: "Sprint 1",
        spaceId: "sp1",
        createdBy: "u1",
        autoCreateNext: false,
        moveIncomplete: false,
      },
    ]);
    await handleSprintAutoClose([]);
    expect(closeSprintAndRolloverMock).toHaveBeenCalledWith(
      expect.objectContaining({ incompleteStrategy: "move_to_backlog" })
    );
  });

  it("continues processing remaining sprints when one fails", async () => {
    queueEligibleSprints([
      {
        id: "s1",
        name: "A",
        spaceId: "sp1",
        createdBy: "u1",
        autoCreateNext: false,
        moveIncomplete: false,
      },
      {
        id: "s2",
        name: "B",
        spaceId: "sp2",
        createdBy: "u2",
        autoCreateNext: false,
        moveIncomplete: false,
      },
    ]);
    closeSprintAndRolloverMock
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ nextSprintId: null });
    await expect(handleSprintAutoClose([])).resolves.toBeUndefined();
    expect(closeSprintAndRolloverMock).toHaveBeenCalledTimes(2);
  });

  it("processes multiple eligible sprints with their own independent settings", async () => {
    queueEligibleSprints([
      {
        id: "s1",
        name: "A",
        spaceId: "sp1",
        createdBy: "u1",
        autoCreateNext: true,
        moveIncomplete: true,
      },
      {
        id: "s2",
        name: "B",
        spaceId: "sp2",
        createdBy: "u2",
        autoCreateNext: false,
        moveIncomplete: false,
      },
    ]);
    await handleSprintAutoClose([]);
    expect(closeSprintAndRolloverMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sprintId: "s1",
        incompleteStrategy: "move_to_next_sprint",
      })
    );
    expect(closeSprintAndRolloverMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sprintId: "s2",
        incompleteStrategy: "move_to_backlog",
      })
    );
  });
});
