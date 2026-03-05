import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { GradeExamClient } from "@/components/grade-exam-client";
import { getSessionCookieName } from "@/lib/session/crypto";

export const metadata: Metadata = {
  title: "等级考试成绩查询",
};

export default async function GradeExamsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(getSessionCookieName())?.value;

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="main-shell">
      <GradeExamClient />
    </main>
  );
}
