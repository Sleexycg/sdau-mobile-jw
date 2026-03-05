export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getJwBaseUrl(): string {
  return (process.env.JW_BASE_URL ?? "https://jw.sdau.edu.cn").replace(/\/$/, "");
}

export function getJwTimeoutMs(): number {
  const raw = process.env.JW_TIMEOUT_MS ?? "12000";
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : 12000;
}

export function getJwRetryCount(): number {
  const raw = process.env.JW_RETRY_COUNT ?? "1";
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : 1;
}

export function getJwUserAgent(): string {
  return (
    process.env.JW_USER_AGENT ??
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  );
}

export function getDaizongCampusCode(): string | null {
  return process.env.JW_CAMPUS_DAIZONG_CODE ?? "001";
}

export function getZhongyangCampusCode(): string | null {
  return process.env.JW_CAMPUS_ZHONGYANG_CODE ?? "002";
}

export function getXibeiCampusCode(): string | null {
  return process.env.JW_CAMPUS_XIBEI_CODE ?? "A5F850229661E843E0536685C2CAF624";
}
