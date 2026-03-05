import { NextResponse } from "next/server";

import { fetchEmptyRooms } from "@/lib/jw/empty-room-client";
import { JwError } from "@/lib/jw/errors";
import { readSessionCookieHeader } from "@/lib/session/store";
import type { ApiErrorCode } from "@/types/api";
import type { CampusName, EmptyRoomQuery, SectionCode } from "@/types/empty-room";

interface EmptyRoomRequestBody {
  weekday?: number;
  sectionCode?: SectionCode;
  campus?: CampusName;
}

const campusSet = new Set<CampusName>(["岱宗校区", "泮河校区", "西北片区"]);
const sectionCodeSet = new Set<SectionCode>(["0102", "0304", "中午", "0506", "0708", "0910", "晚间"]);

function errorResponse(status: number, code: ApiErrorCode, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const sessionCookieHeader = await readSessionCookieHeader();
  if (!sessionCookieHeader) {
    return errorResponse(401, "UNAUTHORIZED", "请先登录");
  }

  let body: EmptyRoomRequestBody;
  try {
    body = (await request.json()) as EmptyRoomRequestBody;
  } catch {
    return errorResponse(400, "BAD_REQUEST", "请求体格式错误");
  }

  const weekday = Number(body.weekday);
  const sectionCode = body.sectionCode;
  const campus = body.campus;

  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    return errorResponse(400, "BAD_REQUEST", "星期参数无效");
  }
  if (!sectionCode || !sectionCodeSet.has(sectionCode)) {
    return errorResponse(400, "BAD_REQUEST", "节次参数无效");
  }
  if (!campus || !campusSet.has(campus)) {
    return errorResponse(400, "BAD_REQUEST", "校区参数无效");
  }

  const query: EmptyRoomQuery = {
    weekday: weekday as EmptyRoomQuery["weekday"],
    sectionCode,
    campus,
  };

  try {
    const data = await fetchEmptyRooms(sessionCookieHeader, query);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof JwError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : error.code === "BAD_REQUEST" ? 400 : 503;
      const code = error.code as ApiErrorCode;
      return errorResponse(status, code, error.message);
    }

    return errorResponse(503, "JW_UNAVAILABLE", "空教室查询失败");
  }
}


