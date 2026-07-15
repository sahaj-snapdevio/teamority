import { beforeEach, describe, expect, it, vi } from "vitest";
import { emailOutbox } from "@/db/schema";
import { handleEmailSend } from "@/lib/worker/handlers/email-send";
import { JOB_NAMES } from "@/lib/worker/job-types";

const { updateMock, updateSetSpy, sendEmailViaSmtpMock, enqueueJobMock } =
  vi.hoisted(() => ({
    updateMock: vi.fn(),
    updateSetSpy: vi.fn(),
    sendEmailViaSmtpMock: vi.fn(),
    enqueueJobMock: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({ db: { update: updateMock } }));
vi.mock("@/lib/smtp/client", () => ({
  sendEmailViaSmtp: sendEmailViaSmtpMock,
}));
vi.mock("@/lib/worker/enqueue", () => ({ enqueueJob: enqueueJobMock }));

interface UpdateChain extends PromiseLike<undefined> {
  returning: () => Promise<unknown[]>;
  where: () => UpdateChain;
}

function createUpdateChain(returningResult: unknown[]): UpdateChain {
  const chain: UpdateChain = {
    where: () => chain,
    returning: () => Promise.resolve(returningResult),
    // biome-ignore lint/suspicious/noThenProperty: mirrors Drizzle's own thenable query builder
    then: (onfulfilled, onrejected) =>
      Promise.resolve(undefined).then(onfulfilled, onrejected),
  };
  return chain;
}

function stubUpdate(claimedRow: unknown[]) {
  updateMock.mockImplementation((table: unknown) => ({
    set: (values: unknown) => {
      updateSetSpy(table, values);
      return createUpdateChain(claimedRow);
    },
  }));
}

function job(outboxId = "outbox-1") {
  return { data: { outboxId } } as never;
}

const basePayload = {
  to: "a@b.com",
  subject: "Hi",
  html: "<p>hi</p>",
  text: "hi",
};

beforeEach(() => {
  updateMock.mockReset();
  updateSetSpy.mockReset();
  sendEmailViaSmtpMock.mockReset();
  enqueueJobMock.mockReset();
});

describe("handleEmailSend", () => {
  it("does nothing when the outbox row cannot be claimed (already sending/sent)", async () => {
    stubUpdate([]);
    await handleEmailSend([job()]);
    expect(sendEmailViaSmtpMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("marks the email as sent on successful delivery", async () => {
    stubUpdate([
      {
        id: "outbox-1",
        attemptCount: 1,
        maxAttempts: 3,
        idempotencyKey: "idem-1",
        payload: basePayload,
      },
    ]);
    sendEmailViaSmtpMock.mockResolvedValue({
      id: "provider-1",
      status: "sent",
    });
    await handleEmailSend([job()]);
    expect(updateSetSpy).toHaveBeenLastCalledWith(
      emailOutbox,
      expect.objectContaining({
        status: "sent",
        providerMessageId: "provider-1",
      })
    );
    expect(enqueueJobMock).not.toHaveBeenCalled();
  });

  it("requeues with the first backoff tier on the first retryable failure", async () => {
    stubUpdate([
      {
        id: "outbox-1",
        attemptCount: 1,
        maxAttempts: 3,
        idempotencyKey: "idem-1",
        payload: basePayload,
      },
    ]);
    sendEmailViaSmtpMock.mockRejectedValue(new Error("smtp down"));
    await handleEmailSend([job()]);
    expect(updateSetSpy).toHaveBeenLastCalledWith(
      emailOutbox,
      expect.objectContaining({
        status: "queued",
        claimedAt: null,
        lastError: "smtp down",
      })
    );
    expect(enqueueJobMock).toHaveBeenCalledWith(
      JOB_NAMES.EMAIL_SEND,
      { outboxId: "outbox-1" },
      { startAfter: 60 }
    );
  });

  it("uses the second backoff tier on the second attempt", async () => {
    stubUpdate([
      {
        id: "outbox-1",
        attemptCount: 2,
        maxAttempts: 3,
        idempotencyKey: "idem-1",
        payload: basePayload,
      },
    ]);
    sendEmailViaSmtpMock.mockRejectedValue(new Error("smtp down"));
    await handleEmailSend([job()]);
    expect(enqueueJobMock).toHaveBeenCalledWith(
      JOB_NAMES.EMAIL_SEND,
      { outboxId: "outbox-1" },
      { startAfter: 300 }
    );
  });

  it("clamps to the last backoff tier beyond the configured number of tiers", async () => {
    stubUpdate([
      {
        id: "outbox-1",
        attemptCount: 5,
        maxAttempts: 10,
        idempotencyKey: "idem-1",
        payload: basePayload,
      },
    ]);
    sendEmailViaSmtpMock.mockRejectedValue(new Error("smtp down"));
    await handleEmailSend([job()]);
    expect(enqueueJobMock).toHaveBeenCalledWith(
      JOB_NAMES.EMAIL_SEND,
      { outboxId: "outbox-1" },
      { startAfter: 900 }
    );
  });

  it("marks the email as permanently failed when no attempts remain", async () => {
    stubUpdate([
      {
        id: "outbox-1",
        attemptCount: 3,
        maxAttempts: 3,
        idempotencyKey: "idem-1",
        payload: basePayload,
      },
    ]);
    sendEmailViaSmtpMock.mockRejectedValue(new Error("smtp down"));
    await handleEmailSend([job()]);
    expect(updateSetSpy).toHaveBeenLastCalledWith(
      emailOutbox,
      expect.objectContaining({ status: "failed", lastError: "smtp down" })
    );
    expect(enqueueJobMock).not.toHaveBeenCalled();
  });

  it("truncates a very long error message to 500 characters", async () => {
    stubUpdate([
      {
        id: "outbox-1",
        attemptCount: 3,
        maxAttempts: 3,
        idempotencyKey: "idem-1",
        payload: basePayload,
      },
    ]);
    sendEmailViaSmtpMock.mockRejectedValue(new Error("x".repeat(600)));
    await handleEmailSend([job()]);
    const [, values] = updateSetSpy.mock.calls[1] as [
      unknown,
      { lastError: string },
    ];
    expect(values.lastError).toHaveLength(500);
  });

  it("stringifies a non-Error rejection", async () => {
    stubUpdate([
      {
        id: "outbox-1",
        attemptCount: 3,
        maxAttempts: 3,
        idempotencyKey: "idem-1",
        payload: basePayload,
      },
    ]);
    sendEmailViaSmtpMock.mockRejectedValue("boom");
    await handleEmailSend([job()]);
    expect(updateSetSpy).toHaveBeenLastCalledWith(
      emailOutbox,
      expect.objectContaining({ lastError: "boom" })
    );
  });

  it("processes multiple jobs in the batch", async () => {
    stubUpdate([
      {
        id: "outbox-1",
        attemptCount: 1,
        maxAttempts: 3,
        idempotencyKey: "idem-1",
        payload: basePayload,
      },
    ]);
    sendEmailViaSmtpMock.mockResolvedValue({
      id: "provider-1",
      status: "sent",
    });
    await handleEmailSend([job("outbox-1"), job("outbox-2")]);
    expect(sendEmailViaSmtpMock).toHaveBeenCalledTimes(2);
  });
});
