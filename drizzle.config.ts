import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";
import { DEV_DATABASE_URL } from "./config/dev-database";

// drizzle-kit does not load .env on its own (unlike Next.js and the tsx-based
// scripts, which all call process.loadEnvFile). Without this, `pnpm db:migrate`
// ignores DATABASE_URL from .env and falls back to DEV_DATABASE_URL — which can
// point at the wrong local cluster/credentials. Mirror the scripts' pattern so
// the config honors .env exactly like the rest of the app.
if (existsSync(".env")) {
  process.loadEnvFile();
}

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Falls back to the local dev database so migrations run without a .env.
    // Production always sets DATABASE_URL explicitly.
    url: process.env.DATABASE_URL ?? DEV_DATABASE_URL,
  },
});
