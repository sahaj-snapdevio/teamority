import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Zero-config defaults for the bundled local development database
 * (`pnpm db:local`). Never used in production, which always sets DATABASE_URL.
 *
 * The project was formerly named "Krova", and older checkouts have their
 * embedded-Postgres cluster in `.krova-postgres/` with matching credentials.
 * Renaming outright would orphan that data, so if the legacy directory is
 * present we keep using it, credentials and all. Fresh clones get the
 * Kanbanica-named directory. This keeps existing local databases working
 * untouched — do not "simplify" it away.
 */

const LEGACY_DATA_DIR = ".krova-postgres";
const LEGACY_DATABASE_URL = "postgresql://krova:krova@localhost:54329/krova";

const DEFAULT_DATA_DIR = ".kanbanica-postgres";
const DEFAULT_DATABASE_URL =
  "postgresql://kanbanica:kanbanica@localhost:54329/kanbanica";

/** True when this checkout still has a pre-rename local database. */
export const usingLegacyDevDatabase = existsSync(
  path.resolve(process.cwd(), LEGACY_DATA_DIR)
);

/** Directory the embedded Postgres cluster lives in. */
export const DEV_DATABASE_DIR = usingLegacyDevDatabase
  ? LEGACY_DATA_DIR
  : DEFAULT_DATA_DIR;

/** Connection string matching the credentials that cluster was created with. */
export const DEV_DATABASE_URL = usingLegacyDevDatabase
  ? LEGACY_DATABASE_URL
  : DEFAULT_DATABASE_URL;
