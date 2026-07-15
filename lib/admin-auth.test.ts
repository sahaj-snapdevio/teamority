import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminSession } from "@/lib/admin-auth";

const { headersMock, getSessionMock, selectMock } = vi.hoisted(() => ({
  headersMock: vi.fn(),
  getSessionMock: vi.fn(),
  selectMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}));
vi.mock("@/lib/db", () => ({ db: { select: selectMock } }));

interface QueryChain extends PromiseLike<unknown[]> {
  from: () => QueryChain;
  limit: () => Promise<unknown[]>;
  where: () => QueryChain;
}

function createChain(result: unknown[]): QueryChain {
  const chain: QueryChain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(result),
    // biome-ignore lint/suspicious/noThenProperty: mirrors Drizzle's own thenable query builder
    then: (onfulfilled, onrejected) =>
      Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return chain;
}

function queueUserRow(result: unknown[]) {
  selectMock.mockReturnValue(createChain(result));
}

const requestHeaders = new Headers();
const baseSession = {
  user: { id: "u1", email: "u1@example.com", name: "User One" },
  session: { id: "sess1" },
};

beforeEach(() => {
  headersMock.mockReset();
  getSessionMock.mockReset();
  selectMock.mockReset();
  headersMock.mockResolvedValue(requestHeaders);
});

describe("getAdminSession", () => {
  it("returns null without querying the DB when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await getAdminSession();
    expect(result).toBeNull();
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("returns null without querying the DB when the session has no user", async () => {
    getSessionMock.mockResolvedValue({ user: null, session: { id: "sess1" } });
    const result = await getAdminSession();
    expect(result).toBeNull();
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("returns the session unmodified when the user is an active admin", async () => {
    getSessionMock.mockResolvedValue(baseSession);
    queueUserRow([{ role: "admin", banned: false }]);
    const result = await getAdminSession();
    expect(result).toBe(baseSession);
  });

  it("returns null when the role is not admin", async () => {
    getSessionMock.mockResolvedValue(baseSession);
    queueUserRow([{ role: "user", banned: false }]);
    const result = await getAdminSession();
    expect(result).toBeNull();
  });

  it("returns null when the user is banned, even if their role is admin", async () => {
    getSessionMock.mockResolvedValue(baseSession);
    queueUserRow([{ role: "admin", banned: true }]);
    const result = await getAdminSession();
    expect(result).toBeNull();
  });

  it("returns null when the user row no longer exists", async () => {
    getSessionMock.mockResolvedValue(baseSession);
    queueUserRow([]);
    const result = await getAdminSession();
    expect(result).toBeNull();
  });
});
