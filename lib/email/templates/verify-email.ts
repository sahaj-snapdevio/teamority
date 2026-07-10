import { createElement } from "react";
import { PRODUCT_NAME } from "@/config/platform";
import { VerifyEmailEmail } from "@/lib/email/components/verify-email";
import { renderEmailTemplate } from "@/lib/email/renderer";

export async function verifyEmailTemplate({
  email,
  verifyUrl,
}: {
  email: string;
  verifyUrl: string;
}) {
  const html = await renderEmailTemplate(
    createElement(VerifyEmailEmail, {
      email,
      verifyUrl,
      productName: PRODUCT_NAME,
    })
  );

  // The URL must appear in the plaintext body: when SMTP is not configured,
  // `sendEmailViaSmtp` logs `text` (not `html`) to the console.
  const text = `Verify your email address for ${PRODUCT_NAME}

Confirm that ${email} belongs to you to finish setting up your account:
${verifyUrl}

This link expires in 1 hour. If you did not request this, ignore this email — your account is unchanged.`;

  return { html, text };
}
