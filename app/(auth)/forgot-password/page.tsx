import { notFound, redirect } from "next/navigation";
import { PRODUCT_NAME } from "@/config/platform";
import { getAuthMethods } from "@/lib/auth-config";
import { getCurrentSession } from "@/lib/authz";
import { AuthShell } from "../_components/auth-shell";
import { ForgotPasswordForm } from "../_components/forgot-password-form";

export const metadata = { title: `Reset your password — ${PRODUCT_NAME}` };

export default async function ForgotPasswordPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/post-auth");
  }

  // Needs both: password auth must be on (otherwise nobody has a password to
  // reset), and SMTP must exist — without it `sendEmailViaSmtp` only
  // console-logs, so the flow would silently do nothing.
  const methods = await getAuthMethods();
  if (!methods.passwordSignup || !methods.passwordReset) {
    notFound();
  }

  return (
    <AuthShell
      description="Enter the email you use to sign in and we'll send you a link to choose a new password."
      title="Reset your password"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
