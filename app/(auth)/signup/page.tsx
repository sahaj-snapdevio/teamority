import { notFound, redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PRODUCT_NAME } from "@/config/platform";
import { getAuthMethods } from "@/lib/auth-config";
import { authErrorMessage } from "@/lib/auth-errors";
import { getCurrentSession } from "@/lib/authz";
import { redirectToSetupIfNeeded } from "@/lib/setup";
import { AuthShell } from "../_components/auth-shell";
import { SignupForm } from "../_components/signup-form";

export const metadata = { title: `Create your account — ${PRODUCT_NAME}` };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await redirectToSetupIfNeeded();
  const session = await getCurrentSession();
  if (session) {
    redirect("/post-auth");
  }

  const methods = await getAuthMethods();
  // Registration is an explicit opt-in (ALLOW_PASSWORD_SIGNUP). When it's off
  // the route must not exist — the server rejects /sign-up/email regardless.
  if (!methods.passwordSignup) {
    notFound();
  }

  const { error } = await searchParams;

  return (
    <AuthShell
      description={`Set up your ${PRODUCT_NAME} account to start organizing work.`}
      title="Create your account"
    >
      {error && (
        <Alert className="mb-5" variant="destructive">
          <AlertDescription>{authErrorMessage(error)}</AlertDescription>
        </Alert>
      )}
      <SignupForm methods={methods} />
    </AuthShell>
  );
}
