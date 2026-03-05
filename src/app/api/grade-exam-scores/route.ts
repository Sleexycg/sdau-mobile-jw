import { NextResponse } from "next/server";

import { fetchGradeExamScores, fetchStudentProfile } from "@/lib/jw/client";
import { JwError } from "@/lib/jw/errors";
import { readSessionCookieHeader } from "@/lib/session/store";
import type { GradeExamResponse } from "@/types/score";

export async function GET(): Promise<NextResponse> {
  const sessionCookieHeader = await readSessionCookieHeader();
  if (!sessionCookieHeader) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "请先登录" }, { status: 401 });
  }

  try {
    const profile = await fetchStudentProfile(sessionCookieHeader);
    const records = await fetchGradeExamScores(sessionCookieHeader);

    const data: GradeExamResponse = {
      profile,
      records,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof JwError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : 503;
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status });
    }

    return NextResponse.json({ ok: false, code: "JW_UNAVAILABLE", message: "等级考试成绩拉取失败，请稍后再试" }, { status: 503 });
  }
}