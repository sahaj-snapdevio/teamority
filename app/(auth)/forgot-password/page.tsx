import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/authz";
import { getAuthMethods } from "@/lib/auth-config";
import { PRODUCT_NAME } from "@/config/platform";
import { AuthShell } from "../_components/auth-shell";
import { ForgotPasswordForm } from "../_components/forgot-password-form";

export const metadata = { title: `Reset your password — ${PRODUCT_NAME}` };

export default async function ForgotPasswordPage() {
  const session = await getCurrentSession();
  if (session) redirect("/post-auth");

  // Needs both: password auth must be on (otherwise nobody has a password to
  // reset), and SMTP must exist — without it `sendEmailViaSmtp` only
  // console-logs, so the flow would silently do nothing.
  const methods = getAuthMethods();
  if (!methods.passwordSignup || !methods.passwordReset) notFound();

  return (
    <AuthShell
      title="Reset your password"
      description="Enter the email you use to sign in and we'll send you a link to choose a new password."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
