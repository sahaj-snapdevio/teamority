/**
 * Generic PostgreSQL connection-string normalisation.
 *
 * Kanbanica talks to Postgres through two different drivers:
 *   - `postgres.js` — the app (`lib/db.ts`) and the migration runner
 *   - `pg`          — pg-boss (`lib/worker/boss.ts`, `lib/worker/enqueue.ts`)
 *
 * They disagree about connection-string query parameters, which makes a URL
 * copied from a managed provider work with one and fail with the other:
 *
 *   1. `postgres.js` forwards any query param it doesn't recognise to the server
 *      as a *startup parameter*. Client-only params such as `channel_binding`
 *      are not server settings, so the connection is rejected.
 *
 *   2. `sslmode=require` means "encrypt, don't verify the certificate" to
 *      `postgres.js`, but "encrypt and verify strictly" to `pg`. The same URL
 *      can therefore connect in the app and fail TLS in the worker.
 *
 *   3. `pg` lets a parsed connection string OVERRIDE an explicit `ssl` option
 *      (see pg/lib/connection-parameters.js), so TLS can only be controlled
 *      consistently once `sslmode` is removed from the URL.
 *
 * `sanitizeDatabaseUrl` resolves all three: it strips client-only parameters,
 * turns `sslmode` into an explicit `ssl` config both drivers honour, and reports
 * whether prepared statements must be disabled.
 *
 * This is deliberately provider-agnostic — it reasons only about standard
 * PostgreSQL/libpq connection parameters. No hostname or port sniffing, and no
 * per-provider branches: any valid connection string should work anywhere.
 */

/** TLS config accepted by both `postgres.js` and `pg`. */
export type PgSslConfig = boolean | { rejectUnauthorized: boolean };

export interface NormalizedPgConnection {
  /** Connection string with client-only params removed. Safe for either driver. */
  url: string;
  /** Pass explicitly to the driver — `sslmode` has been stripped from `url`. */
  ssl: PgSslConfig;
  /**
   * `false` when the URL declares a transaction-mode connection pooler.
   * `postgres.js` uses named prepared statements by default, which pgbouncer
   * in transaction mode cannot support. (pg-boss is unaffected: it only takes
   * transaction-scoped `pg_advisory_xact_lock`s.)
   */
  prepare: boolean;
}

/**
 * Query params consumed by the *client* that are not PostgreSQL server settings.
 * Left in place, `postgres.js` would send them in the startup packet and the
 * server would reject the connection.
 *
 * `application_name`, `options` and `connect_timeout` are deliberately NOT in
 * this list: they are genuine startup/driver parameters that both drivers
 * already handle correctly.
 */
const CLIENT_ONLY_PARAMS = [
  "sslmode", // re-expressed as the `ssl` config below
  "channel_binding",
  "sslcert",
  "sslkey",
  "sslrootcert",
  "sslpassword",
  "uselibpqcompat",
  "pgbouncer", // widely-used convention; re-expressed as `prepare` below
] as const;

/** Rewrite the `postgres://` alias to the canonical `postgresql://` scheme. */
export function normalizePgConnectionString(url: string): string {
  return url.replace(/^postgres:\/\//, "postgresql://");
}

/**
 * Map libpq's `sslmode` onto a TLS config that means the same thing to both
 * drivers. Absent `sslmode` means no TLS, which is what the bundled Postgres
 * container (plaintext on the internal Docker network) expects.
 */
function sslFromMode(mode: string | null): PgSslConfig {
  switch (mode) {
    case null:
    case "":
    case "disable":
      return false;
    // Encrypt, but do not verify the server certificate.
    case "allow":
    case "prefer":
    case "require":
    case "no-verify":
      return { rejectUnauthorized: false };
    // Encrypt and verify against the system CA store.
    case "verify-ca":
    case "verify-full":
      return true;
    default:
      // Unknown mode: encrypt without verification rather than silently
      // downgrading to plaintext.
      return { rejectUnauthorized: false };
  }
}

/**
 * Normalise a PostgreSQL connection string for use with either driver.
 *
 * A URL with no query parameters comes back unchanged (beyond the scheme alias)
 * with `ssl: false` — so the bundled-Postgres path behaves exactly as before.
 */
export function sanitizeDatabaseUrl(rawUrl: string): NormalizedPgConnection {
  const normalized = normalizePgConnectionString(rawUrl);

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    // Not a URL we can parse (e.g. a libpq key/value DSN). Hand it back as-is
    // and let the driver decide — better than throwing at import time.
    return { url: normalized, ssl: false, prepare: true };
  }

  const params = url.searchParams;
  const sslMode = params.get("sslmode");
  const pgBouncer = params.get("pgbouncer") === "true";

  for (const param of CLIENT_ONLY_PARAMS) {
    params.delete(param);
  }

  return {
    url: url.toString(),
    ssl: sslFromMode(sslMode),
    prepare: !pgBouncer,
  };
}
