import { Button, Link, Section, Text } from "react-email";
import { PRODUCT_NAME } from "@/config/platform";
import { EmailLayout, emailStyles } from "@/lib/email/components/layout";

export function PasswordResetEmail({
  email,
  resetUrl,
  productName = PRODUCT_NAME,
}: {
  email: string;
  resetUrl: string;
  productName?: string;
}) {
  return (
    <EmailLayout
      preview={`Reset your ${productName} password`}
      productName={productName}
    >
      <Text style={emailStyles.heading}>Reset your password</Text>
      <Text style={emailStyles.paragraph}>
        We received a request to reset the password for{" "}
        <strong style={{ color: "#174D38" }}>{email}</strong>.
      </Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={resetUrl} style={emailStyles.button}>
          Reset Password
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        This link expires in 1 hour and can only be used once. Your current
        password stays active until you choose a new one.
      </Text>
      <Text style={emailStyles.fallbackLink}>
        If the button does not work, paste this link into your browser:{" "}
        <Link href={resetUrl} style={emailStyles.link}>
          {resetUrl}
        </Link>
      </Text>
    </EmailLayout>
  );
}
