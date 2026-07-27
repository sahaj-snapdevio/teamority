# Amazon S3 Storage Setup

## Overview

**What it is:** cloud object storage for user-uploaded files — task attachments, comment images, user avatars, channel attachments.

**Why Kanbanica uses it:** the default `STORAGE_DRIVER=local` writes to a `./uploads` folder (or Docker volume), which isn't durable on ephemeral hosts or safe across multiple app instances. S3 (via `lib/storage.ts` → `lib/storage/s3.ts`, using `@aws-sdk/client-s3`) gives durable, centralized storage instead.

**Required or optional:** **optional**. Local storage works fine for a single persistent host — S3 (or [Cloudflare R2](./cloudflare-r2.md), which uses the exact same code path) is for production deployments that need durability independent of the app server, or that scale beyond one instance.

> **Note:** Kanbanica proxies all uploads through its own API routes (`app/api/tasks/[taskId]/attachments/route.ts` and similar) — files never upload directly from the browser to S3. That means you do **not** need to configure bucket CORS for uploads to work.

---

## Step-by-step setup

### 1. Create a bucket

1. Sign in to the [AWS Console](https://console.aws.amazon.com/s3/) → S3.
2. **Create bucket**.
3. **Bucket name:** must be globally unique (e.g. `yourcompany-kanbanica-uploads`).
4. **Region:** pick one close to your app server — you'll need this exact region string later.
5. Leave **Block all public access** ON (default). Kanbanica generates presigned/proxied URLs for serving files (`storage.url(key)`) — the bucket itself does not need to be public.
6. Create the bucket with default settings otherwise.

### 2. Create an IAM user with least-privilege access

Don't use your root AWS account credentials. Create a dedicated IAM user scoped to just this bucket:

1. **IAM → Users → Create user.** Name it something like `kanbanica-storage`.
2. Skip console access (this user only needs programmatic API access).
3. **Attach policy → Create inline policy** (or attach a custom managed policy) with:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
         "Resource": [
           "arn:aws:s3:::yourcompany-kanbanica-uploads",
           "arn:aws:s3:::yourcompany-kanbanica-uploads/*"
         ]
       }
     ]
   }
   ```

   Replace the bucket name with yours. This grants exactly what `lib/storage/s3.ts` needs (`PutObject`/`GetObject`/`DeleteObject`/`DeleteObjects`/`HeadObject`/`ListObjectsV2`) and nothing more.

4. **Security credentials tab → Create access key.** Choose "Application running outside AWS" (or "Other") as the use case. Copy the **Access key ID** and **Secret access key** immediately — the secret is shown once.

### 3. Set the environment variables

```bash
STORAGE_DRIVER=s3
S3_REGION=us-east-1              # your bucket's actual region
S3_BUCKET=yourcompany-kanbanica-uploads
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
# S3_ENDPOINT is NOT set for AWS S3 — leave it unset/commented out
```

Do **not** set `S3_ENDPOINT` for real AWS S3 — that variable exists for S3-compatible services (R2, MinIO) that need a custom endpoint URL. Setting it for AWS S3 will misroute requests.

Restart the app after editing `.env`.

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `STORAGE_DRIVER` | Set to `s3` | Selects the S3 adapter |
| `S3_REGION` | Yes | Must match the bucket's actual AWS region, e.g. `us-east-1` |
| `S3_BUCKET` | Yes | The bucket name from step 1 |
| `S3_ACCESS_KEY_ID` | Yes | From the IAM user's access key |
| `S3_SECRET_ACCESS_KEY` | Yes | From the IAM user's access key — keep secret |
| `S3_ENDPOINT` | Leave unset for AWS S3 | Only needed for R2/MinIO/other S3-compatible services |
| `S3_PUBLIC_URL` | Optional | Set this if you front the bucket with a CDN (e.g. CloudFront) and want served file URLs to use that domain instead |

---

## Verification

1. Restart the app after setting the variables.
2. Upload a file somewhere in the app — a task attachment or your own avatar are the quickest tests.
3. Check the S3 console — **your bucket → Objects** — a new object should appear under a key like `attachments/{workspaceId}/{taskId}/{uuid}/{filename}` or `avatars/{userId}/{uuid}.webp`.
4. Reload the page and confirm the uploaded file/image renders — this proves both the write path (upload) and the read path (`storage.url(key)` → `/api/files/[...key]`, or `S3_PUBLIC_URL` if set) work.
5. Delete the file/attachment in the app and confirm the object disappears from the bucket too (Kanbanica always deletes the storage object before the DB record — see `CLAUDE.md` → File Uploads).

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `AccessDenied` on upload | The IAM policy is missing `PutObject`, or the `Resource` ARNs don't match your actual bucket name exactly (including the `/*` suffix for object-level actions). |
| `AccessDenied` on delete | Missing `s3:DeleteObject` in the IAM policy. |
| Files upload but never display | Check `S3_REGION` matches the bucket's real region — a region mismatch causes read failures even when writes succeed (depends on the specific error surfaced, but this is the most common cause). |
| `The specified bucket does not exist` | Typo in `S3_BUCKET`, or the bucket is in a different AWS account than the IAM user's credentials. |
| Works in one environment, not another | Each deployment needs its **own** `S3_*` credentials in its own `.env` — nothing is shared or committed. Confirm you didn't copy dev credentials into a prod `.env` pointed at a bucket the prod IAM user can't reach (or vice versa). |
| Accidentally set `S3_ENDPOINT` for AWS S3 | Remove it entirely — leaving it blank (`S3_ENDPOINT=`) still counts as "set" in some shells; delete the line or comment it out. |

---

Using Cloudflare R2 instead? See [`cloudflare-r2.md`](./cloudflare-r2.md) — same code path, different account setup.
