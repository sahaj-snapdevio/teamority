import { createElement } from "react";
import { PRODUCT_NAME } from "@/config/platform";
import { NotificationEmail } from "@/lib/email/components/notification";
import { renderEmailTemplate } from "@/lib/email/renderer";

export async function notificationTemplate({
  title,
  body,
  url,
  settingsUrl,
}: {
  title: string;
  body?: string | null;
  url: string;
  settingsUrl: string;
}) {
  const html = await renderEmailTemplate(
    createElement(NotificationEmail, {
      title,
      body,
      url,
      settingsUrl,
      productName: PRODUCT_NAME,
    })
  );

  // The URL must appear in the plaintext body: with no SMTP configured,
  // `sendEmailViaSmtp` logs `text` (not `html`) to the console.
  const text = `${title}
${body ? `\n${body}\n` : ""}
Open it in ${PRODUCT_NAME}:
${url}

Change what you receive: ${settingsUrl}`;

  return { html, text };
}
