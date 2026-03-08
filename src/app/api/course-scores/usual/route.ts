import { NextResponse } from "next/server";

import { fetchUsualScoreDetail } from "@/lib/jw/client";
import { JwError } from "@/lib/jw/errors";
import { buildMockUsualScoreDetail } from "@/lib/mock/admin-data";
import { readSession } from "@/lib/session/store";
import type { ApiErrorCode } from "@/types/api";

interface UsualScoreRequest {
  xs0101id?: string;
  jx0404id?: string;
  cj0708id?: string;
  zcj?: string;
}

function errorResponse(status: number, code: ApiErrorCode, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await readSession();
  if (!session) {
    return errorResponse(401, "UNAUTHORIZED", "请先登录");
  }

  let body: UsualScoreRequest;
  try {
    body = (await request.json()) as UsualScoreRequest;
  } catch {
    return errorResponse(400, "BAD_REQUEST", "请求体格式错误");
  }

  const xs0101id = body.xs0101id?.trim() ?? "";
  const jx0404id = body.jx0404id?.trim() ?? "";
  const cj0708id = body.cj0708id?.trim() ?? "";
  const zcj = body.zcj?.trim() ?? "";

  if (!xs0101id || !jx0404id || !cj0708id) {
    return errorResponse(400, "BAD_REQUEST", "成绩明细参数不完整");
  }

  if (session.mode === "mock") {
    return NextResponse.json({ ok: true, data: buildMockUsualScoreDetail(zcj) });
  }

  const sessionCookieHeader = session.cookieHeader;
  if (!sessionCookieHeader) {
    return errorResponse(401, "UNAUTHORIZED", "请先登录");
  }

  try {
    const data = await fetchUsualScoreDetail(sessionCookieHeader, { xs0101id, jx0404id, cj0708id, zcj });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof JwError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : 503;
      return errorResponse(status, error.code as ApiErrorCode, error.message);
    }
    return errorResponse(503, "JW_UNAVAILABLE", "平时成绩查询失败");
  }
}
