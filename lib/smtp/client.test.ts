import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSmtpConfigured,
  sendEmailViaSmtp,
  testSmtpConnection,
} from "@/lib/smtp/client";

const { createTransportMock, sendMailMock, verifyMock, getSmtpSettingsMock } =
  vi.hoisted(() => ({
    createTransportMock: vi.fn(),
    sendMailMock: vi.fn(),
    verifyMock: vi.fn(),
    getSmtpSettingsMock: vi.fn(),
  }));

vi.mock("@/lib/integration-settings", () => ({
  getSmtpSettings: getSmtpSettingsMock,
  isSmtpConfigured: async () => (await getSmtpSettingsMock()) !== null,
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}));

function setConfigured() {
  getSmtpSettingsMock.mockResolvedValue({
    host: "smtp.example.com",
    port: 587,
    user: "user",
    pass: "pass",
    from: "noreply@example.com",
  });
}

function setUnconfigured() {
  getSmtpSettingsMock.mockResolvedValue(null);
}

beforeEach(() => {
  createTransportMock.mockReset();
  sendMailMock.mockReset();
  verifyMock.mockReset();
  getSmtpSettingsMock.mockReset();
  setUnconfigured();
  createTransportMock.mockReturnValue({
    sendMail: sendMailMock,
    verify: verifyMock,
  });
  sendMailMock.mockResolvedValue({ messageId: "msg-1" });
  verifyMock.mockResolvedValue(true);
});

describe("isSmtpConfigured", () => {
  it("is true when getSmtpSettings resolves a config", async () => {
    setConfigured();
    expect(await isSmtpConfigured()).toBe(true);
  });

  it("is false when getSmtpSettings resolves null", async () => {
    setUnconfigured();
    expect(await isSmtpConfigured()).toBe(false);
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
  it("creates a transport from the resolved settings and sends via nodemailer", async () => {
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

describe("testSmtpConnection", () => {
  const input = {
    host: "smtp.example.com",
    port: 587,
    user: "user",
    pass: "pass",
  };

  it("returns ok when the transporter verifies successfully", async () => {
    const result = await testSmtpConnection(input);
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 587,
        auth: { user: "user", pass: "pass" },
      })
    );
    expect(verifyMock).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it("returns the error message when verify() rejects", async () => {
    verifyMock.mockRejectedValue(new Error("Invalid login"));
    const result = await testSmtpConnection(input);
    expect(result).toEqual({ error: "Invalid login" });
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    verifyMock.mockRejectedValue("boom");
    const result = await testSmtpConnection(input);
    expect(result).toEqual({ error: "Could not connect to the SMTP server." });
  });
});
