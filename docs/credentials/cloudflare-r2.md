# Cloudflare R2 Storage Setup

## Overview

**What it is:** Cloudflare's S3-compatible object storage — an alternative to Amazon S3 for user-uploaded files (task attachments, comment images, avatars, channel attachments).

**Why Kanbanica uses it:** R2 is API-compatible with S3, so Kanbanica's storage layer (`lib/storage.ts`, `lib/storage/s3.ts`) uses the exact same code path for both — the only difference is which credentials and endpoint you configure. R2 is popular for self-hosters because it has **no egress fees**, unlike S3.

**Required or optional:** **optional**. The default `STORAGE_DRIVER=local` works fine for a single persistent host; R2 is for production deployments that want durable storage independent of the app server (or across multiple instances) without paying to serve files back out.

> **Note:** Kanbanica proxies all uploads through its own API routes — files never upload directly from the browser to R2. You do **not** need to configure bucket CORS for uploads to work.

---

## Step-by-step setup

### 1. Create an R2 bucket

1. Sign in to the [Cloudflare dashboard](https://dash.cloudflare.com/) → **R2 Object Storage** in the left sidebar. (If this is your first time using R2, Cloudflare will prompt you to enable it — R2 requires adding a payment method even though the free tier is generous, since usage-based billing applies beyond it.)
2. **Create bucket**. Name it something like `kanbanica-uploads`. Pick a location hint close to your app server (optional).
3. Leave the bucket private — Kanbanica generates its own serving URLs (`storage.url(key)` → `/api/files/[...key]`, or via `S3_PUBLIC_URL` if you set up a custom domain), so the bucket itself doesn't need to be public.

### 2. Get your Account ID

On the R2 overview page (or any Cloudflare dashboard page's right sidebar), copy your **Account ID** — a 32-character hex string. You'll need it to build the endpoint URL.

### 3. Create an API token scoped to R2

1. **R2 → Manage R2 API Tokens → Create API Token.**
2. **Permissions:** Object Read & Write.
3. **Bucket scope:** restrict to just the bucket you created (not "Apply to all buckets") — least privilege.
4. Create the token. Cloudflare shows you an **Access Key ID** and **Secret Access Key** — copy both immediately (the secret is shown once).

### 4. Set the environment variables

```bash
STORAGE_DRIVER=r2
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=kanbanica-uploads
S3_ACCESS_KEY_ID=<access key id from step 3>
S3_SECRET_ACCESS_KEY=<secret access key from step 3>
```

Replace `<account-id>` in `S3_ENDPOINT` with the Account ID from step 2. `S3_REGION=auto` is correct for R2 — it isn't a real AWS region, R2 just expects the literal string `auto`.

Restart the app after editing `.env`.

### 5. (Optional) Serve files through a custom domain

By default, files are served through Kanbanica's own `/api/files/[...key]` proxy regardless of storage driver. If you'd rather serve directly from R2 through a custom domain (lower load on your app server, R2's own CDN caching):

1. **R2 → your bucket → Settings → Public Access → Connect Domain**, and follow Cloudflare's steps to attach a subdomain (e.g. `files.yourdomain.com`).
2. Set `S3_PUBLIC_URL=https://files.yourdomain.com` in `.env`.

This is purely an optimization — skip it if you're not sure you need it.

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `STORAGE_DRIVER` | Set to `r2` (or `s3` — both select the same S3-compatible adapter) | |
| `S3_ENDPOINT` | Yes | `https://<account-id>.r2.cloudflarestorage.com` — **required** for R2, unlike AWS S3 where it's omitted |
| `S3_REGION` | Yes | Literally the string `auto` |
| `S3_BUCKET` | Yes | The bucket name from step 1 |
| `S3_ACCESS_KEY_ID` | Yes | From the R2 API token |
| `S3_SECRET_ACCESS_KEY` | Yes | From the R2 API token — keep secret |
| `S3_PUBLIC_URL` | Optional | Only if you set up a custom domain in step 5 |

---

## Verification

1. Restart the app after setting the variables.
2. Upload a file somewhere in the app — a task attachment or your own avatar are the quickest tests.
3. Check the Cloudflare dashboard — **R2 → your bucket → Objects** — a new object should appear under a key like `attachments/{workspaceId}/{taskId}/{uuid}/{filename}` or `avatars/{userId}/{uuid}.webp`.
4. Reload the page and confirm the uploaded file/image renders.
5. Delete the file/attachment in the app and confirm the object disappears from the bucket too.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Access Denied` or `SignatureDoesNotMatch` | Wrong Access Key ID/Secret, or the API token's bucket scope doesn't include the bucket you're targeting. |
| `getaddrinfo ENOTFOUND` or connection errors | `S3_ENDPOINT` is missing or malformed — R2, unlike AWS S3, **requires** this variable. Double-check the account ID is correct and there's no typo in `r2.cloudflarestorage.com`. |
| Files upload but never display | Confirm `S3_REGION=auto` exactly — a real AWS region string here will not work against R2's endpoint. |
| Bucket shows objects but the app can't read them back | If you set `S3_PUBLIC_URL` for a custom domain, confirm the domain is fully connected and active in R2's Public Access settings before relying on it — otherwise unset it and let Kanbanica's own `/api/files` proxy serve files instead. |
| Accidentally billed beyond free tier | R2's free tier is generous (10GB storage, 1M Class A / 10M Class B operations/month as of writing) but usage-based billing applies beyond it — check Cloudflare's current R2 pricing page if costs are a concern. |

---

Using AWS S3 instead? See [`storage-s3.md`](./storage-s3.md) — same code path, different account setup.
