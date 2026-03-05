import { cookies } from "next/headers";

import {
  decryptSession,
  encryptSession,
  getSessionCookieName,
  getSessionTtlSeconds,
} from "@/lib/session/crypto";

function resolveSecureCookieFlag(): boolean {
  if (process.env.SESSION_COOKIE_SECURE === "true") {
    return true;
  }
  if (process.env.SESSION_COOKIE_SECURE === "false") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

export async function saveSession(cookieHeader: string): Promise<void> {
  const token = encryptSession({
    cookieHeader,
    createdAt: Date.now(),
  });

  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: resolveSecureCookieFlag(),
    path: "/",
    maxAge: getSessionTtlSeconds(),
  });
}

export async function readSessionCookieHeader(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) {
    return null;
  }

  const session = decryptSession(token);
  if (!session) {
    return null;
  }

  return session.cookieHeader;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(getSessionCookieName());
}
