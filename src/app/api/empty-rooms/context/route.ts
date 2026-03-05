import { NextResponse } from "next/server";

import { fetchEmptyRoomContext } from "@/lib/jw/empty-room-client";
import { JwError } from "@/lib/jw/errors";
import { readSessionCookieHeader } from "@/lib/session/store";

export async function GET(): Promise<NextResponse> {
  const sessionCookieHeader = await readSessionCookieHeader();
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
