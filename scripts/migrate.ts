import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { sanitizeDatabaseUrl } from "@/lib/pg-connection";

// Production-safe migration runner.
//
// `drizzle-kit` is a devDependency and is absent from --prod images, so we run
// migrations with the runtime `drizzle-orm` migrator against ./db/migrations.
// This is what the docker-compose `migrate` service invokes (via the worker
// image, which already bundles db/migrations + tsx + drizzle-orm).
//
// With the bundled Postgres container, compose gates this on
// `postgres: {condition: service_healthy}`. With an EXTERNAL database there is
// no such gate — the database may be briefly unreachable or cold-starting — so
// we wait for it ourselves before giving up.

if (existsSync(".env")) {
  process.loadEnvFile();
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Cannot run migrations.");
  process.exit(1);
}

const MAX_ATTEMPTS = 10;

// Arbitrary but stable application-level key. Any other process running these
// migrations against the same database blocks here rather than racing us —
// Drizzle's migrator has no locking of its own.
const MIGRATION_LOCK_ID = 4_314_112;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Block until the database answers, with exponential backoff (2s → 30s). */
async function waitForDatabase(client: postgres.Sql) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await client`select 1`;
      return;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        throw error;
      }
      const delay = Math.min(2000 * 2 ** (attempt - 1), 30_000);
      console.error(
        `[migrate] database unreachable (${attempt}/${MAX_ATTEMPTS}); retrying in ${
          delay / 1000
        }s`
      );
      await sleep(delay);
    }
  }
}

async function main() {
  const { url, ssl } = sanitizeDatabaseUrl(databaseUrl as string);

  // A dedicated single-connection client that closes when done. The advisory
  // lock below is session-scoped, so it MUST stay on this one connection.
  const client = postgres(url, { max: 1, ssl });

  try {
    await waitForDatabase(client);

    await client`select pg_advisory_lock(${MIGRATION_LOCK_ID})`;
    try {
      console.log("[migrate] applying migrations from ./db/migrations …");
      await migrate(drizzle(client), { migrationsFolder: "./db/migrations" });
      console.log("[migrate] done.");
    } finally {
      await client`select pg_advisory_unlock(${MIGRATION_LOCK_ID})`;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[migrate] failed:", error);
  process.exit(1);
});
