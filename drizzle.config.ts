import { defineConfig } from "drizzle-kit";
import { DEV_DATABASE_URL } from "./config/dev-database";

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
