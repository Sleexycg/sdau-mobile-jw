import { getJwBaseUrl, getJwRetryCount, getJwTimeoutMs, getJwUserAgent } from "@/lib/env";

interface RequestOptions {
  method?: "GET" | "POST";
  body?: URLSearchParams;
  cookieHeader?: string;
  referer?: string;
}

export interface JwHttpResponse {
  status: number;
  text: string;
  cookieHeader: string;
  finalUrl: string;
}

function mergeCookies(currentHeader: string, setCookie: string[] | undefined): string {
  const jar = new Map<string, string>();

  const currentParts = currentHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const item of currentParts) {
    const [name, ...valueParts] = item.split("=");
    if (!name || valueParts.length === 0) {
      continue;
    }
    jar.set(name, valueParts.join("="));
  }

  for (const cookie of setCookie ?? []) {
    const firstPart = cookie.split(";")[0];
    const [name, ...valueParts] = firstPart.split("=");
    if (!name || valueParts.length === 0) {
      continue;
    }
    jar.set(name.trim(), valueParts.join("=").trim());
  }

  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function getSetCookieHeaders(res: Response): string[] {
  const maybeGetSetCookie = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof maybeGetSetCookie === "function") {
    return maybeGetSetCookie.call(res.headers);
  }

  const raw = res.headers.get("set-cookie");
  return raw ? raw.split(/, (?=[^;]+?=)/g) : [];
}

export async function jwRequest(path: string, options: RequestOptions = {}): Promise<JwHttpResponse> {
  const method = options.method ?? "GET";
  const baseUrl = getJwBaseUrl();
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
  const retries = getJwRetryCount();

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), getJwTimeoutMs());

      const res = await fetch(url, {
        method,
        body: options.body,
        headers: {
          "User-Agent": getJwUserAgent(),
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Content-Type": method === "POST" ? "application/x-www-form-urlencoded" : "text/plain",
          ...(options.cookieHeader ? { Cookie: options.cookieHeader } : {}),
          ...(options.referer ? { Referer: options.referer } : {}),
        },
        redirect: "follow",
        signal: controller.signal,
        cache: "no-store",
      });

      clearTimeout(timeout);

      const setCookie = getSetCookieHeaders(res);
      const cookieHeader = mergeCookies(options.cookieHeader ?? "", setCookie);
      return {
        status: res.status,
        text: await res.text(),
        cookieHeader,
        finalUrl: res.url,
      };
    } catch (error) {
      lastError = error;
      attempt += 1;
    }
  }

  throw lastError ?? new Error("JW request failed");
}
