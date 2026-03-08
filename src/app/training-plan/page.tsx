import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { TrainingPlanClient } from "@/components/training-plan-client";
import { getSessionCookieName } from "@/lib/session/crypto";

export const metadata: Metadata = {
  title: "培养方案查看",
};

export default async function TrainingPlanPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(getSessionCookieName())?.value;

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="main-shell">
      <TrainingPlanClient />
    </main>
  );
}
