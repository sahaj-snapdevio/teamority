import nodemailer from "nodemailer";
import { getSmtpSettings, isSmtpConfigured } from "@/lib/integration-settings";

export interface SmtpSendInput {
  html: string;
  idempotencyKey?: string;
  subject: string;
  text?: string;
  to: string | string[];
}

export interface SmtpSendResult {
  id: string;
  status: string;
}

export interface SmtpTestInput {
  host: string;
  pass: string;
  port: number;
  user: string;
}

export { isSmtpConfigured };

/** Opens (and immediately closes) a connection to verify SMTP credentials
 * work, without sending an email — backs the "Test Connection" button on
 * Settings → Integrations. */
export async function testSmtpConnection(
  input: SmtpTestInput
): Promise<{ ok: true } | { error: string }> {
  const transporter = nodemailer.createTransport({
    host: input.host,
    port: input.port,
    auth: { user: input.user, pass: input.pass },
    connectionTimeout: 8000,
  });

  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not connect to the SMTP server.",
    };
  }
}

export async function sendEmailViaSmtp(
  input: SmtpSendInput
): Promise<SmtpSendResult> {
  const smtp = await getSmtpSettings();
  if (!smtp) {
    console.log("[email:dev]", {
      subject: input.subject,
      text: input.text,
      to: input.to,
    });
    return {
      id: `dev_${input.idempotencyKey ?? Date.now()}`,
      status: "logged",
    };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  const info = await transporter.sendMail({
    from: smtp.from,
    to: Array.isArray(input.to) ? input.to.join(", ") : input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    headers: input.idempotencyKey
      ? { "X-Idempotency-Key": input.idempotencyKey }
      : undefined,
  });

  return {
    id: info.messageId ?? `smtp_${Date.now()}`,
    status: "sent",
  };
}
