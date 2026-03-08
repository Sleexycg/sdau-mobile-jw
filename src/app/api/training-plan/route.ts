import { NextResponse } from "next/server";

import { fetchStudentProfile, fetchTrainingPlan } from "@/lib/jw/client";
import { JwError } from "@/lib/jw/errors";
import { buildMockTrainingPlanResponse } from "@/lib/mock/admin-data";
import { readSession } from "@/lib/session/store";
import type { TrainingPlanResponse } from "@/types/training-plan";

export async function GET(): Promise<NextResponse> {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "请先登录" }, { status: 401 });
  }

  if (session.mode === "mock") {
    return NextResponse.json({ ok: true, data: buildMockTrainingPlanResponse() });
  }

  const sessionCookieHeader = session.cookieHeader;
  if (!sessionCookieHeader) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "请先登录" }, { status: 401 });
  }

  try {
    const profile = await fetchStudentProfile(sessionCookieHeader);
    const plan = await fetchTrainingPlan(sessionCookieHeader);

    const data: TrainingPlanResponse = {
      profile,
      items: plan.items,
      summary: plan.summary,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof JwError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : 503;
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status });
    }

    return NextResponse.json({ ok: false, code: "JW_UNAVAILABLE", message: "培养方案拉取失败，请稍后重试" }, { status: 503 });
  }
}
