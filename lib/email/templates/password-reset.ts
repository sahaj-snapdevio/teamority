import { createElement } from "react";
import { PRODUCT_NAME } from "@/config/platform";
import { PasswordResetEmail } from "@/lib/email/components/password-reset";
import { renderEmailTemplate } from "@/lib/email/renderer";

export async function passwordResetTemplate({
  email,
  resetUrl,
}: {
  email: string;
  resetUrl: string;
}) {
  const html = await renderEmailTemplate(
    createElement(PasswordResetEmail, {
      email,
      resetUrl,
      productName: PRODUCT_NAME,
    })
  );

  // The URL must appear in the plaintext body: when SMTP is not configured,
  // `sendEmailViaSmtp` logs `text` (not `html`) to the console, and that log is
  // the only way a self-hoster can complete a reset.
  const text = `Reset your ${PRODUCT_NAME} password

We received a request to reset the password for ${email}.
Use this link to choose a new password:
${resetUrl}

This link expires in 1 hour and can only be used once.
If you did not request this, you can ignore this email — your password will not change.`;

  return { html, text };
}
