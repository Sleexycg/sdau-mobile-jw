import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CommunityClient } from "@/components/community-client";
import { getSessionCookieName } from "@/lib/session/crypto";

export const metadata: Metadata = {
  title: "在线讨论区",
};

export default async function CommunityPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(getSessionCookieName())?.value;
  if (!session) redirect("/login");

  return (
    <main className="main-shell">
      <CommunityClient />
    </main>
  );
}
