import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { env } from "@/lib/env";

const ALGO = "aes-256-gcm";

// Derives a 32-byte key from the app-wide APP_SECRET (already used elsewhere
// in this app as the general-purpose secret — see lib/env.ts) rather than
// requiring a dedicated env var per feature that needs encryption at rest.
function getKey(): Buffer {
  return createHash("sha256").update(env.APP_SECRET).digest();
}

/** Encrypts a secret for storage (SMTP password, OAuth client secret, storage access keys, VAPID private key). */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("hex")).join(":");
}

/** Reverses encryptSecret(). */
export function decryptSecret(encrypted: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
