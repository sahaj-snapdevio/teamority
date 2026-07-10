import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { sanitizeDatabaseUrl } from "@/lib/pg-connection";

// TLS and prepared-statement behaviour are resolved from the connection string
// once, so that the app and the pg-boss worker agree. See lib/pg-connection.ts.
const { url, ssl, prepare } = sanitizeDatabaseUrl(env.DATABASE_URL);

export const dbClient = postgres(url, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
  ssl,
  prepare,
});

export const db = drizzle(dbClient, { schema });
