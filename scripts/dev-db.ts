import { existsSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { DEV_DATABASE_DIR, DEV_DATABASE_URL } from "@/config/dev-database";

if (existsSync(".env")) {
  process.loadEnvFile();
}

// Fall back to the standard local dev URL so `pnpm db:local` works without a
// .env. Copying .env.example is still recommended; this just enables zero-config.
const databaseUrl = process.env.DATABASE_URL ?? DEV_DATABASE_URL;

const url = new URL(databaseUrl);
const user = decodeURIComponent(url.username) || "postgres";
const password = decodeURIComponent(url.password) || "password";
const port = Number(url.port) || 54_329;
const database = url.pathname.replace(/^\//, "") || "postgres";
// Reuses `.krova-postgres` when a pre-rename checkout has one, so existing
// local data keeps working. See config/dev-database.ts.
const dataDir = path.resolve(process.cwd(), DEV_DATABASE_DIR);

const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  password,
  persistent: true,
  port,
  user,
  // Force a UTF-8 cluster. Without this, initdb inherits the host OS locale —
  // on Windows that is a WIN1252 codepage (e.g. English_India.1252), and the
  // resulting database cannot store emoji or any non-Latin-1 character (task
  // titles, comments, workspace names), failing inserts at runtime. `--locale=C`
  // is encoding-agnostic and required so initdb accepts UTF8 regardless of host
  // locale. Only applied when the cluster is first initialised.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

async function main() {
  const alreadyInitialised = existsSync(path.join(dataDir, "PG_VERSION"));
  if (!alreadyInitialised) {
    console.log(`Initialising Postgres data directory at ${dataDir}`);
    await postgres.initialise();
  }

  await postgres.start();
  console.log(`Postgres running at ${databaseUrl}`);

  if (!alreadyInitialised && database !== "postgres") {
    try {
      await postgres.createDatabase(database);
      console.log(`Created database '${database}'`);
    } catch {
      // Database already exists.
    }
  }

  async function stop(signal: string) {
    console.log(`Received ${signal}; stopping Postgres`);
    await postgres.stop();
    process.exit(0);
  }

  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));
}

main().catch((error) => {
  console.error("Failed to start embedded Postgres:", error);
  process.exit(1);
});
