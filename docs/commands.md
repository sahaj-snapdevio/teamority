# Commands

Quick start:

```bash
pnpm install
cp .env.example .env
pnpm db:local     # bundled dev database (leave running)
pnpm db:migrate   # first time only
pnpm dev          # app + worker
```

See [SETUP.md](../SETUP.md) for the full walkthrough.

## Development

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Start the web app and background worker together (color-coded logs) |
| `pnpm dev:next` | Start only the web app (no worker) |
| `pnpm worker` | Start only the worker, restarting on file changes |
| `pnpm worker:start` | Start the worker once, no watch (used in production/Docker) |

## Build & type checking

| Command | What it does |
|---------|--------------|
| `pnpm build` | Production build (`next build`) |
| `pnpm start` | Run the production build (`next start`) — run `pnpm build` first |
| `pnpm typecheck` | Type-check the project with `tsc --noEmit`. Required CI gate. |

## Linting & formatting

| Command | What it does |
|---------|--------------|
| `pnpm lint` | Check code style with Biome. Advisory in CI (not yet a required gate — see `.github/workflows/ci.yml`). |
| `pnpm lint:fix` | Same as `lint`, but auto-fixes what it can |
| `pnpm format` | Format changed files with Biome |

## Testing

| Command | What it does |
|---------|--------------|
| `pnpm test` | Run the Vitest suite once. Required CI gate. |
| `pnpm test:watch` | Run Vitest in watch mode |

## Database

| Command | What it does |
|---------|--------------|
| `pnpm db:local` | Start the bundled local Postgres (development only — keep it running in its own terminal) |
| `pnpm db:generate` | Generate a Drizzle migration from schema changes in `db/schema/` |
| `pnpm db:push` | Push schema changes straight to the database without a migration file (dev convenience) |
| `pnpm db:migrate` | Apply migrations via `drizzle-kit` (development) |
| `pnpm db:migrate:prod` | Apply migrations without `drizzle-kit`. This is what the Docker `migrate` service and `docker compose exec ... scripts/migrate.ts` run in production — it waits for the database and takes an advisory lock. |
| `pnpm db:reset` | ⚠️ Wipe the database and re-apply all migrations |

## Admin bootstrap

| Command | What it does |
|---------|--------------|
| `pnpm make:admin <email>` | Promote an existing user (already signed in via magic link) to platform admin |
| `pnpm create:admin <email> <password> [name]` | Create a new platform admin account directly, with a password — for environments where SMTP/magic-link isn't set up yet |

## Docker / Docker Compose

Build the worker image directly (used by the `worker` and `migrate` services):

```bash
docker build -f Dockerfile.worker -t kanbanica-worker .
```

Bring the full stack up (Postgres, migrate, app, worker):

```bash
docker compose up -d
docker compose up -d --build   # rebuild images first
```

Everyday operations:

```bash
docker compose ps                    # service status
docker compose logs -f app           # tail app logs (or worker / migrate / postgres)
docker compose stop app worker       # stop without removing containers
docker compose exec worker node_modules/.bin/tsx scripts/make-admin.ts you@example.com
```

Using an external/managed Postgres instead of the bundled container:

```bash
docker compose -f docker-compose.yml -f docker-compose.external-db.yml up -d
```

Full deployment, backup/restore, and troubleshooting details: [DEPLOYMENT.md](../DEPLOYMENT.md).

## Production (bare process, no Docker)

```bash
pnpm build
pnpm start          # web app
pnpm worker:start   # background worker, separate process
```

Both processes need the same environment variables and point at the same `DATABASE_URL`.
