import { beforeEach, describe, expect, it, vi } from "vitest";
import { isSmtpConfigured, sendEmailViaSmtp } from "@/lib/smtp/client";

const { envMock, createTransportMock, sendMailMock } = vi.hoisted(() => ({
  envMock: {
    SMTP_HOST: undefined as string | undefined,
    SMTP_PORT: undefined as number | undefined,
    SMTP_USER: undefined as string | undefined,
    SMTP_PASS: undefined as string | undefined,
    EMAIL_FROM: undefined as string | undefined,
  },
  createTransportMock: vi.fn(),
  sendMailMock: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: envMock }));
vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}));

function setConfigured() {
  envMock.SMTP_HOST = "smtp.example.com";
  envMock.SMTP_PORT = undefined;
  envMock.SMTP_USER = "user";
  envMock.SMTP_PASS = "pass";
  envMock.EMAIL_FROM = "noreply@example.com";
}

function setUnconfigured() {
  envMock.SMTP_HOST = undefined;
  envMock.SMTP_PORT = undefined;
  envMock.SMTP_USER = undefined;
  envMock.SMTP_PASS = undefined;
  envMock.EMAIL_FROM = undefined;
}

beforeEach(() => {
  setUnconfigured();
  createTransportMock.mockReset();
  sendMailMock.mockReset();
  createTransportMock.mockReturnValue({ sendMail: sendMailMock });
  sendMailMock.mockResolvedValue({ messageId: "msg-1" });
});

describe("isSmtpConfigured", () => {
  it("is true only when host, user, pass, and from are all set", () => {
    setConfigured();
    expect(isSmtpConfigured()).toBe(true);
  });

  it("is false when SMTP_HOST is missing", () => {
    setConfigured();
    envMock.SMTP_HOST = undefined;
    expect(isSmtpConfigured()).toBe(false);
  });

  it("is false when SMTP_USER is missing", () => {
    setConfigured();
    envMock.SMTP_USER = undefined;
    expect(isSmtpConfigured()).toBe(false);
  });

  it("is false when SMTP_PASS is missing", () => {
    setConfigured();
    envMock.SMTP_PASS = undefined;
    expect(isSmtpConfigured()).toBe(false);
  });

  it("is false when EMAIL_FROM is missing", () => {
    setConfigured();
    envMock.EMAIL_FROM = undefined;
    expect(isSmtpConfigured()).toBe(false);
  });
});

describe("sendEmailViaSmtp — not configured (dev mode)", () => {
  it("logs and returns a 'logged' result without contacting nodemailer", async () => {
    setUnconfigured();
    const result = await sendEmailViaSmtp({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>hi</p>",
    });
    expect(result.status).toBe("logged");
    expect(result.id).toMatch(/^dev_/);
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it("uses the idempotency key as the dev id when provided", async () => {
    setUnconfigured();
    const result = await sendEmailViaSmtp({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>hi</p>",
      idempotencyKey: "abc123",
    });
    expect(result.id).toBe("dev_abc123");
  });
});

describe("sendEmailViaSmtp — configured", () => {
  it("creates a transport from env and sends via nodemailer", async () => {
    setConfigured();
    const result = await sendEmailViaSmtp({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>hi</p>",
    });
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ host: "smtp.example.com", port: 587 })
    );
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@example.com",
        to: "a@b.com",
        subject: "Hi",
        html: "<p>hi</p>",
      })
    );
    expect(result).toEqual({ id: "msg-1", status: "sent" });
  });

  it("joins an array of recipients with a comma", async () => {
    setConfigured();
    await sendEmailViaSmtp({
      to: ["a@b.com", "c@d.com"],
      subject: "Hi",
      html: "<p>hi</p>",
    });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "a@b.com, c@d.com" })
    );
  });

  it("sets the X-Idempotency-Key header only when an idempotency key is given", async () => {
    setConfigured();
    await sendEmailViaSmtp({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>hi</p>",
      idempotencyKey: "key-1",
    });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { "X-Idempotency-Key": "key-1" } })
    );
  });

  it("omits the idempotency header when no key is given", async () => {
    setConfigured();
    await sendEmailViaSmtp({ to: "a@b.com", subject: "Hi", html: "<p>hi</p>" });
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ headers: undefined })
    );
  });

  it("falls back to smtp_<timestamp> when the transporter doesn't return a messageId", async () => {
    setConfigured();
    sendMailMock.mockResolvedValue({});
    const result = await sendEmailViaSmtp({
      to: "a@b.com",
      subject: "Hi",
      html: "<p>hi</p>",
    });
    expect(result.id).toMatch(/^smtp_/);
    expect(result.status).toBe("sent");
  });
});
