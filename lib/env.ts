import { z } from "zod";
import { DEV_DATABASE_URL } from "@/config/dev-database";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);

// Dev-only convenience defaults so a fresh clone runs for local development
// without hand-editing a .env first. In production these three remain REQUIRED
// and the app fails fast if any is missing — so runtime behavior for configured
// deployments (dev with .env, or production) is unchanged.
const isProduction = process.env.NODE_ENV === "production";
const DEV_APP_URL = "http://localhost:3000";

// `next build` evaluates this module while prerendering. The public URL is only
// needed at RUNTIME (nothing inlines it into the client bundle), so during the
// build phase we fall back to a placeholder rather than demanding a real value.
// This is what lets one prebuilt image serve any domain.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const envSchema = z.object({
  DATABASE_URL: isProduction
    ? z.string().min(1)
    : z.string().min(1).default(DEV_DATABASE_URL),
  APP_SECRET: isProduction
    ? z.string().min(1)
    : z.string().min(1).default("dev-only-insecure-app-secret-change-me"),
  // The public URL users hit. Read at runtime — see `appUrl` below.
  APP_URL: optionalString,
  /** @deprecated Use APP_URL. Kept so existing deployments keep working. */
  NEXT_PUBLIC_APP_URL: optionalString,
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.preprocess(
    (v) => (v ? Number(v) : undefined),
    z.number().optional()
  ),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  EMAIL_FROM: optionalString,
  EMAIL_WEBHOOK_SECRET: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  // Self-hosted bootstrap: when set to "true", the very first user to sign up
  // becomes the platform (Orbit) admin, so no manual CLI step is needed.
  // EXPLICIT OPT-IN — default false. Self-hosters set AUTO_PROMOTE_FIRST_ADMIN=true;
  // hosted SaaS leaves it unset and provisions admins with `pnpm create:admin`.
  AUTO_PROMOTE_FIRST_ADMIN: z.preprocess(
    (v) => v === "true" || v === "1",
    z.boolean()
  ),
  // Self-serve email+password registration. EXPLICIT OPT-IN — default false.
  // Kanbanica is invite-based, so leaving this unset keeps a deployment closed:
  // password sign-IN still works for anyone who has a password, but nobody can
  // create an account from the login page. Self-hosters set
  // ALLOW_PASSWORD_SIGNUP=true to allow open registration.
  ALLOW_PASSWORD_SIGNUP: z.preprocess(
    (v) => v === "true" || v === "1",
    z.boolean()
  ),
  STORAGE_DRIVER: z.enum(["local", "s3", "r2"]).default("local"),
  S3_ENDPOINT: z.string().min(1).default("http://localhost:9000"),
  S3_REGION: z.string().min(1).default("auto"),
  S3_BUCKET: z.string().min(1).default("kanbanica"),
  S3_ACCESS_KEY_ID: z.string().min(1).default("minioadmin"),
  S3_SECRET_ACCESS_KEY: z.string().min(1).default("minioadmin"),
  S3_PUBLIC_URL: optionalString,
  VAPID_PUBLIC_KEY: optionalString,
  VAPID_PRIVATE_KEY: optionalString,
  VAPID_SUBJECT: optionalString,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalString,
  // Optional branding overrides for self-hosters (defaults live in config/platform.ts).
  NEXT_PUBLIC_SUPPORT_EMAIL: optionalString,
  NEXT_PUBLIC_MARKETING_DOMAIN: optionalString,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.issues);
  throw new Error("Invalid environment variables");
}

// Resolve the public URL. `APP_URL` is canonical; `NEXT_PUBLIC_APP_URL` is the
// deprecated spelling and still honoured so existing deployments keep working.
// It is NOT baked into the build — every consumer reads it on the server at
// runtime — so the same image can serve any domain.
const parsedEnv = parsed.data;

function resolveAppUrl(): string {
  const configured = parsedEnv.APP_URL ?? parsedEnv.NEXT_PUBLIC_APP_URL;

  if (!configured) {
    // Dev and `next build` get a placeholder; a real production server does not.
    if (!isProduction || isBuildPhase) {
      return DEV_APP_URL;
    }
    throw new Error(
      "APP_URL is not set. In production you must set APP_URL to the public URL " +
        "users visit, e.g. APP_URL=https://tasks.yourcompany.com — it is used for " +
        "sign-in links, invite links, email content, and file URLs."
    );
  }

  const url = z.url().safeParse(configured);
  if (!url.success) {
    throw new Error(
      `APP_URL must be a valid absolute URL (got "${configured}"), e.g. https://tasks.yourcompany.com`
    );
  }
  // Trailing slashes would produce "https://host//invite/..." when concatenated.
  return url.data.replace(/\/+$/, "");
}

export const env = { ...parsedEnv, APP_URL: resolveAppUrl() };

// No "at least one auth provider" check here (SMTP/Google/ALLOW_PASSWORD_SIGNUP
// can now also come from the DB, which this eager, env-only parse can't see —
// see lib/integration-settings.ts). A deployment with none configured still
// boots fine: the first admin's password always works, and /setup or Settings
// → Integrations can configure one from the browser.
