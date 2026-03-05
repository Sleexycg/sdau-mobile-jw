import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ScoresClient } from "@/components/scores-client";
import { getSessionCookieName } from "@/lib/session/crypto";

export default async function ScoresPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(getSessionCookieName())?.value;

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="main-shell">
      <ScoresClient />
    </main>
  );
}