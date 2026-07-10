import { env } from "@/lib/env";
import { isSmtpConfigured } from "@/lib/smtp/client";

/**
 * Which authentication methods this deployment actually has configured.
 *
 * The login UI is env-gated server-side (see `lib/auth.ts`), so the client must
 * be told what to render — otherwise a self-host without Google shows a Google
 * button that can only ever fail.
 */
export type AuthMethods = {
  /** Google OAuth is registered (both client id + secret present). */
  google: boolean;
  /** Magic links can actually be delivered (or console-logged in dev). */
  magicLink: boolean;
  /** Self-serve email + password registration is enabled. */
  passwordSignup: boolean;
  /** Password reset needs a working mail path — SMTP. */
  passwordReset: boolean;
  /**
   * Mirrors `emailAndPassword.requireEmailVerification` in `lib/auth.ts`. When
   * true a new sign-up is NOT auto-signed-in; it must confirm its email first.
   */
  requiresEmailVerification: boolean;
};

export function getAuthMethods(): AuthMethods {
  const smtp = isSmtpConfigured();
  return {
    google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    // In development magic links are printed to the console by `sendMagicLink`,
    // so they remain usable without SMTP.
    magicLink: smtp || env.NODE_ENV !== "production",
    passwordSignup: env.ALLOW_PASSWORD_SIGNUP,
    passwordReset: smtp,
    requiresEmailVerification: smtp,
  };
}
