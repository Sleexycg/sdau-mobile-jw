import { NextResponse } from "next/server";

import { fetchEmptyRoomContext } from "@/lib/jw/empty-room-client";
import { JwError } from "@/lib/jw/errors";
import { buildMockEmptyRoomContext } from "@/lib/mock/admin-data";
import { readSession } from "@/lib/session/store";

export async function GET(): Promise<NextResponse> {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "请先登录" }, { status: 401 });
  }

  if (session.mode === "mock") {
    return NextResponse.json({ ok: true, data: buildMockEmptyRoomContext() });
  }

  const sessionCookieHeader = session.cookieHeader;
  if (!sessionCookieHeader) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "请先登录" }, { status: 401 });
  }

  try {
    const data = await fetchEmptyRoomContext(sessionCookieHeader);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    if (error instanceof JwError) {
      const status = error.code === "UNAUTHORIZED" ? 401 : 503;
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status });
    }
    return NextResponse.json({ ok: false, code: "JW_UNAVAILABLE", message: "上下文加载失败" }, { status: 503 });
  }
}
