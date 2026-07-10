import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthMethods } from "@/lib/auth-config";
import { authErrorMessage } from "@/lib/auth-errors";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PRODUCT_NAME } from "@/config/platform";
import { AuthShell } from "../_components/auth-shell";
import { ResetPasswordForm } from "../_components/reset-password-form";

export const metadata = { title: `Choose a new password — ${PRODUCT_NAME}` };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  // No session redirect here: `revokeSessionsOnPasswordReset` means a valid
  // reset link should still work if the user happens to be signed in elsewhere.
  const methods = getAuthMethods();
  if (!methods.passwordSignup || !methods.passwordReset) notFound();

  const { token, error } = await searchParams;

  // Better Auth appends `?error=INVALID_TOKEN` when the link is bad or expired.
  if (error || !token) {
    return (
      <AuthShell
        title="Link no longer valid"
        description="Password reset links expire after 1 hour and can only be used once."
      >
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{authErrorMessage(error ?? "INVALID_TOKEN")}</AlertDescription>
        </Alert>
        <Link
          href="/forgot-password"
          className="block text-center text-sm font-semibold text-foreground underline underline-offset-4 transition-opacity hover:opacity-80"
        >
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      description="Pick something you haven't used before."
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
