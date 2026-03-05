import { NextResponse } from "next/server";

import { fetchStudentProfile, fetchTimetable } from "@/lib/jw/client";
import { JwError } from "@/lib/jw/errors";
import { readSessionCookieHeader } from "@/lib/session/store";
import type { TimetableResponse } from "@/types/timetable";

function resolveTerm(rawTerm: string | null): string {
  if (rawTerm && /^\d{4}-\d{4}-[12]$/.test(rawTerm)) {
    return rawTerm;
  }

  const now = new Date();
  const year = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const nextYear = year + 1;
  const termNo = now.getMonth() + 1 >= 2 && now.getMonth() + 1 <= 7 ? 2 : 1;
  return `${year}-${nextYear}-${termNo}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  const sessionCookieHeader = await readSessionCookieHeader();
  if (!sessionCookieHeader) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: "请先登录" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const term = resolveTerm(searchParams.get("term"));

  try {
    const profile = await fetchStudentProfile(sessionCookieHeader);
    const timetable = await fetchTimetable(sessionCookieHeader, term);

    const data: TimetableResponse = {
      term: timetable.term,
      generatedAt: new Date().toISOString(),
      profile,
      courses: timetable.courses,
    };

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof JwError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : 503;
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status });
    }

    return NextResponse.json(
      { ok: false, code: "JW_UNAVAILABLE", message: "课表拉取失败，请稍后再试" },
      { status: 503 },
    );
  }
}
