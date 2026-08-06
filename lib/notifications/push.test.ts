import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendPushToUser } from "@/lib/notifications/push";

const {
  selectMock,
  deleteMock,
  deleteWhereSpy,
  sendNotificationMock,
  setVapidDetailsMock,
  getWebPushSettingsMock,
} = vi.hoisted(() => ({
  selectMock: vi.fn(),
  deleteMock: vi.fn(),
  deleteWhereSpy: vi.fn(),
  sendNotificationMock: vi.fn(),
  setVapidDetailsMock: vi.fn(),
  getWebPushSettingsMock: vi.fn(),
}));

vi.mock("@/lib/integration-settings", () => ({
  getWebPushSettings: getWebPushSettingsMock,
}));
vi.mock("@/lib/db", () => ({ db: { select: selectMock, delete: deleteMock } }));
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: setVapidDetailsMock,
    sendNotification: sendNotificationMock,
  },
}));

interface QueryChain extends PromiseLike<unknown[]> {
  from: () => QueryChain;
  where: () => QueryChain;
}

function createChain(result: unknown[]): QueryChain {
  const chain: QueryChain = {
    from: () => chain,
    where: () => chain,
    // biome-ignore lint/suspicious/noThenProperty: mirrors Drizzle's own thenable query builder
    then: (onfulfilled, onrejected) =>
      Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return chain;
}

function queueSubscriptions(result: unknown[]) {
  selectMock.mockReturnValue(createChain(result));
}

function setConfigured() {
  getWebPushSettingsMock.mockResolvedValue({
    publicKey: "pub-key",
    privateKey: "priv-key",
    subject: "mailto:test@example.com",
  });
}

function setUnconfigured() {
  getWebPushSettingsMock.mockResolvedValue(null);
}

const sub1 = {
  id: "sub1",
  userId: "u1",
  endpoint: "https://push.example/1",
  p256dh: "p1",
  auth: "a1",
};
const sub2 = {
  id: "sub2",
  userId: "u1",
  endpoint: "https://push.example/2",
  p256dh: "p2",
  auth: "a2",
};

beforeEach(() => {
  selectMock.mockReset();
  deleteMock.mockReset();
  deleteWhereSpy.mockReset();
  sendNotificationMock.mockReset();
  setVapidDetailsMock.mockReset();
  getWebPushSettingsMock.mockReset();
  setConfigured();
  deleteMock.mockImplementation((table: unknown) => ({
    where: (cond: unknown) => {
      deleteWhereSpy(table, cond);
      return Promise.resolve(undefined);
    },
  }));
});

describe("sendPushToUser", () => {
  it("does nothing when VAPID is not configured", async () => {
    setUnconfigured();
    await sendPushToUser("u1", { title: "Hi", body: "There" });
    expect(selectMock).not.toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("does nothing when the user has no subscriptions", async () => {
    queueSubscriptions([]);
    await sendPushToUser("u1", { title: "Hi", body: "There" });
    expect(sendNotificationMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("sends a push notification to each subscription for the user, with a 10-minute TTL", async () => {
    queueSubscriptions([sub1, sub2]);
    sendNotificationMock.mockResolvedValue(undefined);
    await sendPushToUser("u1", { title: "Hi", body: "There" });
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    expect(sendNotificationMock).toHaveBeenCalledWith(
      {
        endpoint: sub1.endpoint,
        keys: { p256dh: sub1.p256dh, auth: sub1.auth },
      },
      expect.any(String),
      { TTL: 600 }
    );
    expect(sendNotificationMock).toHaveBeenCalledWith(
      {
        endpoint: sub2.endpoint,
        keys: { p256dh: sub2.p256dh, auth: sub2.auth },
      },
      expect.any(String),
      { TTL: 600 }
    );
  });

  it("sends the payload as JSON containing title, body, and url", async () => {
    queueSubscriptions([sub1]);
    sendNotificationMock.mockResolvedValue(undefined);
    await sendPushToUser("u1", {
      title: "Hi",
      body: "There",
      url: "/w1/task/t1",
    });
    const [, payloadJson] = sendNotificationMock.mock.calls[0] as [
      unknown,
      string,
    ];
    expect(JSON.parse(payloadJson)).toMatchObject({
      title: "Hi",
      body: "There",
      url: "/w1/task/t1",
    });
  });

  it("stamps the payload with sentAt and a ttlMs matching the TTL header, so the service worker applies the same cutoff", async () => {
    queueSubscriptions([sub1]);
    sendNotificationMock.mockResolvedValue(undefined);
    const before = Date.now();
    await sendPushToUser("u1", { title: "Hi", body: "There" });
    const after = Date.now();
    const [, payloadJson] = sendNotificationMock.mock.calls[0] as [
      unknown,
      string,
    ];
    const payload = JSON.parse(payloadJson) as {
      sentAt: number;
      ttlMs: number;
    };
    expect(payload.sentAt).toBeGreaterThanOrEqual(before);
    expect(payload.sentAt).toBeLessThanOrEqual(after);
    expect(payload.ttlMs).toBe(600_000);
  });

  it("deletes the subscription when the push service returns 410 Gone", async () => {
    queueSubscriptions([sub1]);
    sendNotificationMock.mockRejectedValue({ statusCode: 410 });
    await sendPushToUser("u1", { title: "Hi", body: "There" });
    expect(deleteWhereSpy).toHaveBeenCalledTimes(1);
  });

  it("deletes the subscription when the push service returns 404 Not Found", async () => {
    queueSubscriptions([sub1]);
    sendNotificationMock.mockRejectedValue({ statusCode: 404 });
    await sendPushToUser("u1", { title: "Hi", body: "There" });
    expect(deleteWhereSpy).toHaveBeenCalledTimes(1);
  });

  it("does not delete the subscription for a non-expiry error, and does not throw", async () => {
    queueSubscriptions([sub1]);
    sendNotificationMock.mockRejectedValue({ statusCode: 500 });
    await expect(
      sendPushToUser("u1", { title: "Hi", body: "There" })
    ).resolves.toBeUndefined();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("handles a mix of successful and expired subscriptions independently", async () => {
    queueSubscriptions([sub1, sub2]);
    sendNotificationMock.mockImplementation((target: { endpoint: string }) => {
      if (target.endpoint === sub1.endpoint) {
        return Promise.reject({ statusCode: 410 });
      }
      return Promise.resolve(undefined);
    });
    await sendPushToUser("u1", { title: "Hi", body: "There" });
    expect(deleteWhereSpy).toHaveBeenCalledTimes(1);
  });
});
