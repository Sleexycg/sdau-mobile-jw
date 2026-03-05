import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { TimetableClient } from "@/components/timetable-client";
import { getSessionCookieName } from "@/lib/session/crypto";

export const metadata: Metadata = {
  title: "个人信息及课程表",
};

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
