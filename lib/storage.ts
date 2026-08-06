import path from "node:path";
import {
  type Body,
  type DownloadOptions,
  Files,
  type OperationOptions,
  type StoredFile,
  type UploadOptions,
  type UploadResult,
  type UrlOptions,
} from "files-sdk";
import { fs as fsAdapter } from "files-sdk/fs";
import { env } from "@/lib/env";
import {
  getStorageSettings,
  type StorageSettings,
} from "@/lib/integration-settings";

const APP_URL = env.APP_URL;

// Cloud driver (s3 / r2, sharing one adapter — see db/schema/integration-settings.ts)
// is lazily constructed via dynamic import so the local-disk (default) path
// never pulls in the AWS SDK — no added cold-start cost for deployments that
// don't use it. Cached by a signature of the resolved config (not "forever" —
// the driver/credentials can now change at runtime via Settings →
// Integrations, see lib/integration-settings.ts) so a settings change
// rebuilds the client on next use instead of needing a restart.
let cachedKey: string | null = null;
let cachedFiles: Files | null = null;

async function buildFiles(settings: StorageSettings): Promise<Files> {
  if (settings.driver === "local") {
    // Loud warning in production: with the local driver, uploads (avatars,
    // attachments) are written to the local disk of whichever instance
    // handled the request. On ephemeral or multi-instance hosts — serverless,
    // containers with no shared persistent volume, or horizontally-scaled
    // deployments — a later request to serve the file can land on a
    // different filesystem and 404, so an upload "works" immediately but
    // disappears on refresh. Use S3/R2 in prod.
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[storage] Using local disk storage in production: uploaded files are stored on " +
          "the local ./uploads filesystem and are NOT durable on ephemeral or " +
          "multi-instance hosts (they appear to upload but 404 after refresh/redeploy). " +
          "Configure S3/R2 in Settings → Integrations (or STORAGE_DRIVER=s3/r2), " +
          "or mount a single shared persistent volume at ./uploads."
      );
    }
    return new Files({
      adapter: fsAdapter({
        root: path.join(process.cwd(), "uploads"),
        urlBaseUrl: `${APP_URL}/api/files`,
      }),
    });
  }

  const { s3 } = await import("files-sdk/s3");
  return new Files({
    adapter: s3({
      bucket: settings.bucket,
      region: settings.region,
      endpoint: settings.endpoint, // R2 / MinIO / S3-compatible; omit for AWS S3
      forcePathStyle: !!settings.endpoint, // needed by MinIO and most S3-compatible services
      credentials:
        settings.accessKeyId && settings.secretAccessKey
          ? {
              accessKeyId: settings.accessKeyId,
              secretAccessKey: settings.secretAccessKey,
            }
          : undefined,
      publicBaseUrl: settings.publicUrl,
    }),
  });
}

async function getFiles(): Promise<Files> {
  const settings = await getStorageSettings();
  const key = JSON.stringify(settings);
  if (cachedFiles && cachedKey === key) {
    return cachedFiles;
  }
  cachedFiles = await buildFiles(settings);
  cachedKey = key;
  return cachedFiles;
}

export const storage = {
  async upload(
    key: string,
    body: Body,
    opts?: UploadOptions
  ): Promise<UploadResult> {
    const files = await getFiles();
    return files.upload(key, body, opts);
  },
  async download(key: string, opts?: DownloadOptions): Promise<StoredFile> {
    const files = await getFiles();
    return files.download(key, opts);
  },
  async delete(key: string, opts?: OperationOptions): Promise<void> {
    const files = await getFiles();
    return files.delete(key, opts);
  },
  async url(key: string, opts?: UrlOptions): Promise<string> {
    const files = await getFiles();
    return files.url(key, opts);
  },
};

/** Builds a client from candidate settings (not necessarily the saved ones)
 * and round-trips a throwaway object — backs the "Test Connection" button on
 * Settings → Integrations. For the local driver this just confirms the
 * ./uploads directory is writable. */
export async function testStorageConnection(
  settings: StorageSettings
): Promise<{ ok: true } | { error: string }> {
  const key = `_connection-test/${crypto.randomUUID()}.txt`;
  try {
    const files = await buildFiles(settings);
    await files.upload(key, Buffer.from("kanbanica connection test"), {
      contentType: "text/plain",
    });
    await files.delete(key);
    return { ok: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : "Could not connect to storage.",
    };
  }
}

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
]);

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
