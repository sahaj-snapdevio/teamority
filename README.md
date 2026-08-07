<div align="center">

# Kanbanica

**Project management for teams — Workspaces, Projects, Sprints, and Tasks, self-hosted on your own infrastructure.**

[![CI](https://github.com/sahaj-snapdevio/Kanbanica/actions/workflows/ci.yml/badge.svg)](https://github.com/sahaj-snapdevio/Kanbanica/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)](https://www.postgresql.org/)

[Quick Start](#quick-start) · [Self-Hosting](#self-hosting) · [Documentation](#documentation) · [Contributing](#contributing)

</div>

---

## Overview

Kanbanica is a self-hostable, ClickUp-style project management app. Teams organize work in **Workspaces → Projects → Lists / Sprints → Tasks**, track it on Board, List, or Calendar, and collaborate in real time — comments, mentions, notifications, and live sync, all inside the task.

It's built for teams who want a complete, production-grade project tool without handing their data to a SaaS vendor: clone it, run it, extend it, and deploy it on infrastructure you control. MIT-licensed, no telemetry, no billing walls.

## Screenshots

![Kanbanica board view](docs/screenshots/demo.png)

More views (List, Sprint, Task detail, mobile) aren't captured yet — see
[`docs/screenshots/`](./docs/screenshots/) for the shot list if you'd like to contribute one.

## Key Features

**For your team**

- **Workspaces → Projects → Lists / Sprints → Tasks** — a flexible hierarchy for organizing any team's work, viewed as Board, List, or Calendar
- **Rich tasks** — assignees, due dates, priorities, subtasks/checklists, file attachments, and Tiptap-powered descriptions with a `/` command menu
- **Custom Fields** — Text, Number, Checkbox, Single/Multi Select, Date, and Person, scoped to a Workspace, Project, or List
- **Time tracking** — a live timer or manual log per task, with per-user history
- **Sprints** — sprint planning, story points, and automatic sprint close
- **My Tasks** — one cross-workspace view of everything assigned to you
- **Collaboration** — threaded comments, @mentions, emoji reactions, and a full activity feed on every task
- **Real-time sync** — live updates over Server-Sent Events as teammates make changes, no refresh needed
- **Keyboard shortcuts** for navigation and common actions (press `?` for the reference)

**For whoever runs it**

- **Two-level permissions** — workspace roles plus per-project access, with guests scoped to only the projects they're invited to
- **Flexible auth** — magic link, Google OAuth, or email + password, all converging on one account per email
- **Notifications** — in-app, email digests, and Web Push
- **Help Center & Support Tickets** — a self-serve article library plus a ticket-based support channel for your users
- **Admin panel** — user management, integration settings, and platform-wide visibility
- **Integrations from the UI** — configure SMTP, Google OAuth, S3/R2 storage, and Web Push from Settings → Integrations, no `.env` editing or restart required (Google OAuth is the one exception)
- **Your files, your storage** — local disk in dev, S3 or Cloudflare R2 in production, one setting
- **Docker self-hosting** — one command brings up Postgres, the app, and the background worker

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Better Auth (magic link / Google OAuth / password) |
| Styling | Tailwind CSS v4 + DaisyUI |
| Rich Text | Tiptap |
| State | SWR (server) + React state/context (client) |
| Real-time | Server-Sent Events (SSE) |
| Background Jobs | pg-boss worker |
| Email | Nodemailer (SMTP) |
| File Storage | files-sdk (local FS in dev → S3/R2 in prod) |

## Quick Start

Requires **Node.js 22** and **pnpm**. No separate database install needed — a local Postgres is bundled for development.

```bash
git clone https://github.com/sahaj-snapdevio/Kanbanica.git kanbanica
cd kanbanica
pnpm install
cp .env.example .env
pnpm db:local     # start the bundled dev database (leave running)
pnpm db:migrate   # create the tables (first time only)
pnpm dev          # start the web app + worker
```

Open <http://localhost:3000>. On a fresh database you land on the **first-run setup wizard** at `/setup` — enter a name, email, and password to create your administrator account and you're signed straight in. No separate terminal step needed.

> Prefer another way in? Sign in with a **magic link** (printed to your terminal when no SMTP is configured), or set `ALLOW_PASSWORD_SIGNUP=true` and register at `/signup`. To promote an existing account to admin, run `pnpm make:admin you@example.com`.

📖 Full walkthrough with troubleshooting: **[SETUP.md](./SETUP.md)**.

## Self-Hosting

Deploy Kanbanica for your team with Docker Compose — Postgres, the app, and the worker, one command:

```bash
cp .env.example .env   # set DATABASE_URL, APP_SECRET, APP_URL — everything else is optional
docker compose up -d --build
```

**Already have a PostgreSQL?** Point `DATABASE_URL` at it and add the overlay — the bundled database container is never started, and migrations still run automatically before the app boots.

```bash
docker compose -f docker-compose.yml -f docker-compose.external-db.yml up -d
```

Any PostgreSQL 16+ reachable over the network works — company cluster, RDS, Neon, Supabase, Railway, Render, DigitalOcean — there's no provider-specific code. Magic-link email works with any SMTP provider (Resend, Brevo, Postmark, SES, …), configurable via env vars or Settings → Integrations after your first boot.

Full production guide, HTTPS/reverse proxy setup, and backup/restore: **[DEPLOYMENT.md](./DEPLOYMENT.md)**. Step-by-step credential guides (Google OAuth, SMTP, Web Push, S3, Cloudflare R2): **[`docs/credentials/`](./docs/credentials/)**.

## Configuration

Only `DATABASE_URL`, `APP_SECRET`, and `APP_URL` are required in `.env`. Everything else — SMTP, Google OAuth, S3/R2 storage, Web Push — is optional and can be configured **from inside the app** instead: the `/setup` wizard's "Configure services" step, or any time after from **Settings → Integrations**. A value saved in the app always takes priority over its matching `.env` variable, so existing `.env`-only deployments keep working unchanged.

SMTP, storage, and Web Push changes apply immediately. Google OAuth is read once at process start, so a saved change needs an app restart to take effect. Secrets are encrypted at rest and never sent back to the browser after saving.

Full reference: **[docs/integrations.md](./docs/integrations.md)**.

## Documentation

| Topic | Document |
|-------|----------|
| Local development | [SETUP.md](./SETUP.md) |
| Self-hosting with Docker | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| How the system fits together | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Conventions & key decisions | [CLAUDE.md](./CLAUDE.md) |
| SMTP / OAuth / storage / push config | [docs/integrations.md](./docs/integrations.md) |
| Credential setup (Google, SMTP, S3, R2, Web Push) | [`docs/credentials/`](./docs/credentials/) |
| Authentication | [docs/authentication.md](./docs/authentication.md) |
| Permissions model | [docs/permission-model.md](./docs/permission-model.md) |
| Real-time sync | [docs/realtime.md](./docs/realtime.md) |
| Database schema | [docs/database-schema.md](./docs/database-schema.md) |
| All feature specs (tasks, sprints, notifications, search, and more) | [`docs/`](./docs) |
| Planned features & direction | [ROADMAP.md](./ROADMAP.md) |
| Release history | [CHANGELOG.md](./CHANGELOG.md) |

## Contributing

Contributions are welcome! **[CONTRIBUTING.md](./CONTRIBUTING.md)** covers project layout, coding conventions, and the pull-request process. Everyone taking part is expected to follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

Found a security problem? Please don't open a public issue — see **[SECURITY.md](./SECURITY.md)**.

## License

Kanbanica is open source under the [MIT License](./LICENSE).
