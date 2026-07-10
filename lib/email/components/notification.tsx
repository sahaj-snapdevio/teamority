import { Button, Link, Section, Text } from "react-email";
import { PRODUCT_NAME } from "@/config/platform";
import { EmailLayout, emailStyles } from "@/lib/email/components/layout";

export function NotificationEmail({
  title,
  body,
  url,
  settingsUrl,
  productName = PRODUCT_NAME,
}: {
  title: string;
  body?: string | null;
  url: string;
  settingsUrl: string;
  productName?: string;
}) {
  return (
    <EmailLayout preview={title} productName={productName}>
      <Text style={emailStyles.heading}>{title}</Text>
      {body ? <Text style={emailStyles.paragraph}>{body}</Text> : null}

      <Section style={{ margin: "24px 0" }}>
        <Button href={url} style={emailStyles.button}>
          View in {productName}
        </Button>
      </Section>

      <Text style={emailStyles.fallbackLink}>
        If the button does not work, paste this link into your browser:{" "}
        <Link href={url} style={emailStyles.link}>
          {url}
        </Link>
      </Text>

      <Text style={emailStyles.muted}>
        You received this because of your notification settings.{" "}
        <Link href={settingsUrl} style={emailStyles.link}>
          Change what you receive
        </Link>
        .
      </Text>
    </EmailLayout>
  );
}
