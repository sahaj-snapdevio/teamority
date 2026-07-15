import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentSession, requireAdmin, requireSession } from "@/lib/authz";

const { headersMock, getSessionMock, redirectMock, selectMock } = vi.hoisted(
  () => ({
    headersMock: vi.fn(),
    getSessionMock: vi.fn(),
    redirectMock: vi.fn(),
    selectMock: vi.fn(),
  })
);

vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
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
  redirectMock.mockReset();
  selectMock.mockReset();
  headersMock.mockResolvedValue(requestHeaders);
  // Real next/navigation redirect() never returns — it throws to interrupt
  // rendering. Mirror that so a caller that ignores the throw is caught.
  redirectMock.mockImplementation((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  });
});

describe("getCurrentSession", () => {
  it("passes the request headers through to auth.api.getSession", async () => {
    getSessionMock.mockResolvedValue(baseSession);
    const result = await getCurrentSession();
    expect(getSessionMock).toHaveBeenCalledWith({ headers: requestHeaders });
    expect(result).toBe(baseSession);
  });

  it("returns null exactly as auth.api.getSession does when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);
    const result = await getCurrentSession();
    expect(result).toBeNull();
  });
});

describe("requireSession", () => {
  it("returns the session without redirecting when one exists", async () => {
    getSessionMock.mockResolvedValue(baseSession);
    const result = await requireSession();
    expect(result).toBe(baseSession);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /login when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});

describe("requireAdmin", () => {
  it("returns an updated session with fresh role/email/banned when the user is an active admin", async () => {
    getSessionMock.mockResolvedValue(baseSession);
    queueUserRow([
      { id: "u1", role: "admin", banned: false, email: "fresh@example.com" },
    ]);
    const result = await requireAdmin();
    expect(result).toEqual({
      ...baseSession,
      user: {
        ...baseSession.user,
        banned: false,
        email: "fresh@example.com",
        role: "admin",
      },
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects to /dashboard when the fresh role is not admin", async () => {
    getSessionMock.mockResolvedValue(baseSession);
    queueUserRow([
      { id: "u1", role: "user", banned: false, email: "u1@example.com" },
    ]);
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to /dashboard when the user is banned, even if their role is admin", async () => {
    getSessionMock.mockResolvedValue(baseSession);
    queueUserRow([
      { id: "u1", role: "admin", banned: true, email: "u1@example.com" },
    ]);
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("redirects to /dashboard when the user row no longer exists", async () => {
    getSessionMock.mockResolvedValue(baseSession);
    queueUserRow([]);
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("redirects to /login before ever querying the DB when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(selectMock).not.toHaveBeenCalled();
  });
});
