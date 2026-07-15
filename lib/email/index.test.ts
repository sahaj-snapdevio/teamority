import { beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueEmail } from "@/lib/email";
import { JOB_NAMES } from "@/lib/worker/job-types";

const { insertMock, insertValuesSpy, enqueueJobMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  insertValuesSpy: vi.fn(),
  enqueueJobMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { insert: insertMock } }));
vi.mock("@/lib/worker/enqueue", () => ({ enqueueJob: enqueueJobMock }));

function stubInsert(returningRow: { id: string }) {
  insertMock.mockImplementation(() => ({
    values: (rows: unknown) => {
      insertValuesSpy(rows);
      return { returning: () => Promise.resolve([returningRow]) };
    },
  }));
}

beforeEach(() => {
  insertMock.mockReset();
  insertValuesSpy.mockReset();
  enqueueJobMock.mockReset();
});

describe("enqueueEmail", () => {
  it("inserts a queued outbox row with a generated idempotency key and the given payload", async () => {
    stubInsert({ id: "outbox-1" });
    await enqueueEmail({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>hi</p>",
      text: "hi",
    });

    expect(insertValuesSpy).toHaveBeenCalledTimes(1);
    const values = insertValuesSpy.mock.calls[0][0] as {
      idempotencyKey: string;
      payload: unknown;
      status: string;
    };
    expect(values.status).toBe("queued");
    expect(values.payload).toEqual({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>hi</p>",
      text: "hi",
    });
    expect(values.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("enqueues an EMAIL_SEND job referencing the new outbox row's id", async () => {
    stubInsert({ id: "outbox-42" });
    await enqueueEmail({ to: "a@b.com", subject: "Hi", html: "<p>hi</p>" });
    expect(enqueueJobMock).toHaveBeenCalledWith(JOB_NAMES.EMAIL_SEND, {
      outboxId: "outbox-42",
    });
  });

  it("generates a different idempotency key for each call", async () => {
    stubInsert({ id: "outbox-1" });
    await enqueueEmail({ to: "a@b.com", subject: "One", html: "<p>1</p>" });
    const first = insertValuesSpy.mock.calls[0][0] as {
      idempotencyKey: string;
    };

    await enqueueEmail({ to: "a@b.com", subject: "Two", html: "<p>2</p>" });
    const second = insertValuesSpy.mock.calls[1][0] as {
      idempotencyKey: string;
    };

    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
  });
});
