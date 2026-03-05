import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { EmptyRoomsClient } from "@/components/empty-rooms-client";
import { getSessionCookieName } from "@/lib/session/crypto";

export const metadata: Metadata = {
  title: "空教室查询",
};

export default async function EmptyRoomsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(getSessionCookieName())?.value;

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="main-shell">
      <EmptyRoomsClient />
    </main>
  );
}
