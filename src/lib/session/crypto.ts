import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

import { getRequiredEnv } from "@/lib/env";

const SESSION_COOKIE_NAME = "jw_session";
const SESSION_TTL_SECONDS = 60 * 60 * 6;

export interface SessionPayload {
  cookieHeader: string;
  createdAt: number;
}

function getSessionKey(): Buffer {
  const secret = getRequiredEnv("SESSION_SECRET");
  return createHash("sha256").update(secret).digest();
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

export function getSessionTtlSeconds(): number {
  return SESSION_TTL_SECONDS;
}

export function encryptSession(payload: SessionPayload): string {
  const iv = randomBytes(12);
  const key = getSessionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptSession(token: string): SessionPayload | null {
  try {
    const [ivRaw, authTagRaw, ciphertextRaw] = token.split(".");
    if (!ivRaw || !authTagRaw || !ciphertextRaw) {
      return null;
    }

    const iv = Buffer.from(ivRaw, "base64url");
    const authTag = Buffer.from(authTagRaw, "base64url");
    const ciphertext = Buffer.from(ciphertextRaw, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", getSessionKey(), iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const parsed = JSON.parse(plaintext.toString("utf8")) as SessionPayload;

    if (!parsed.cookieHeader || typeof parsed.createdAt !== "number") {
      return null;
    }

    const age = Date.now() - parsed.createdAt;
    if (age > SESSION_TTL_SECONDS * 1000) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
