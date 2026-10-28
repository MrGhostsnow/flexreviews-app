import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM. Stored values look like "v1:<iv>:<auth tag>:<ciphertext>",
// each part base64-encoded.
const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  }
  return key;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split(":");
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported encrypted payload");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
