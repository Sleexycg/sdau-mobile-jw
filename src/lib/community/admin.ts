import { createHash } from "node:crypto";

const ADMIN_HASH = "c515939366c12351e5abadaa59d399b4578eee2ecbda346f305e696192c9b802";
const PEPPER = process.env.COMMUNITY_ADMIN_PEPPER || "wesdau-community-admin-v1";

export function isCommunityAdmin(studentId: string): boolean {
  const raw = String(studentId || "").trim();
  if (!raw) return false;
  const digest = createHash("sha256").update(`${raw}|${PEPPER}`).digest("hex");
  return digest === ADMIN_HASH;
}
