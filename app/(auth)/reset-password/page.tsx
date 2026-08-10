import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PRODUCT_NAME } from "@/config/platform";
import { getAuthMethods } from "@/lib/auth-config";
import { authErrorMessage } from "@/lib/auth-errors";
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
  const methods = await getAuthMethods();
  if (!methods.passwordSignup || !methods.passwordReset) {
    notFound();
  }

  const { token, error } = await searchParams;

  // Better Auth appends `?error=INVALID_TOKEN` when the link is bad or expired.
  if (error || !token) {
    return (
      <AuthShell
        description="Password reset links expire after 1 hour and can only be used once."
        title="Link no longer valid"
      >
        <Alert className="mb-5" variant="destructive">
          <AlertDescription>
            {authErrorMessage(error ?? "INVALID_TOKEN")}
          </AlertDescription>
        </Alert>
        <Link
          className="block text-center text-sm font-semibold text-base-content underline underline-offset-4 transition-opacity hover:opacity-80"
          href="/forgot-password"
        >
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      description="Pick something you haven't used before."
      title="Choose a new password"
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
