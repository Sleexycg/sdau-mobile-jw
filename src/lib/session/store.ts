import { cookies } from "next/headers";

import {
  decryptSession,
  encryptSession,
  getSessionCookieName,
  getSessionTtlSeconds,
  type SessionPayload,
} from "@/lib/session/crypto";

function resolveSecureCookieFlag(): boolean {
  if (process.env.SESSION_COOKIE_SECURE === "true") return true;
  if (process.env.SESSION_COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

async function writeSession(payload: SessionPayload): Promise<void> {
  const token = encryptSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: resolveSecureCookieFlag(),
    path: "/",
    maxAge: getSessionTtlSeconds(),
  });
}

export async function saveSession(cookieHeader: string): Promise<void> {
  await writeSession({ mode: "jw", cookieHeader, createdAt: Date.now() });
}

export async function saveMockSession(userId = "admin"): Promise<void> {
  await writeSession({ mode: "mock", userId, createdAt: Date.now() });
}

export async function readSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) return null;
  return decryptSession(token);
}

export async function readSessionCookieHeader(): Promise<string | null> {
  const session = await readSession();
  if (!session || session.mode !== "jw") return null;
  return session.cookieHeader ?? null;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(getSessionCookieName());
}
