# ── Kanbanica web app (Next.js) ───────────────────────────────────────────────
# Multi-stage build producing a lean standalone server (see next.config.mjs
# `output: "standalone"`). The background worker uses Dockerfile.worker instead.

FROM node:22-bookworm-slim AS deps

WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile


FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

# Nothing deployment-specific is baked into this image — no domain, no secrets,
# no VAPID key. APP_URL is read on the server at runtime, and the client fetches
# the VAPID public key from /api/push/vapid-public-key. One published image
# therefore serves any domain, and changing your domain needs no rebuild.

# Placeholders so build-time env validation (lib/env.ts) passes. These are NOT
# used at runtime — real values are injected when the container starts.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV APP_SECRET="build-time-placeholder-value-000000000000"
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build


FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# uid/gid 1001 is deliberate and must not change: existing `uploads` volumes are
# owned by it, so a redeploy keeps write access. Only the account name changed.
RUN groupadd --system --gid 1001 kanbanica \
  && useradd --system --uid 1001 --gid kanbanica kanbanica

# Standalone output: server + minimal node_modules, plus static assets & public/.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Local-storage uploads live here; mount a volume to persist across redeploys.
RUN mkdir -p /app/uploads && chown -R kanbanica:kanbanica /app/uploads

USER kanbanica
EXPOSE 3000

CMD ["node", "server.js"]
