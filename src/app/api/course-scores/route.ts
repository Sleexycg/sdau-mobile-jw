import { NextResponse } from "next/server";

import { fetchCourseScores, fetchStudentProfile } from "@/lib/jw/client";
import { JwError } from "@/lib/jw/errors";
import { readSessionCookieHeader } from "@/lib/session/store";
import type { CourseScoreResponse } from "@/types/score";

export async function GET(request: Request): Promise<NextResponse> {
  const sessionCookieHeader = await readSessionCookieHeader();
  if (!sessionCookieHeader) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "请先登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const term = searchParams.get("term")?.trim() ?? "";

  try {
    const profile = await fetchStudentProfile(sessionCookieHeader);
    const scoreData = await fetchCourseScores(sessionCookieHeader, term || undefined);

    const data: CourseScoreResponse = {
      profile,
      selectedTerm: scoreData.selectedTerm,
      terms: scoreData.terms,
      records: scoreData.records,
      summary: scoreData.summary,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof JwError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : 503;
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status });
    }

    return NextResponse.json({ ok: false, code: "JW_UNAVAILABLE", message: "课程成绩拉取失败，请稍后再试" }, { status: 503 });
  }
}