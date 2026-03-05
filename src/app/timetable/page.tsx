import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { TimetableClient } from "@/components/timetable-client";
import { getSessionCookieName } from "@/lib/session/crypto";

export default async function TimetablePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(getSessionCookieName())?.value;

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="main-shell">
      <TimetableClient />
    </main>
  );
}
