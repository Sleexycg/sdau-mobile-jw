import { NextResponse } from "next/server";

import { loginToJw } from "@/lib/jw/client";
import { JwError } from "@/lib/jw/errors";
import { isAdminCredential } from "@/lib/mock/admin-data";
import { saveMockSession, saveSession } from "@/lib/session/store";

interface LoginRequestBody {
  studentId?: string;
  password?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: LoginRequestBody;

  try {
    body = (await request.json()) as LoginRequestBody;
  } catch {
    return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "请求体格式不正确" }, { status: 400 });
  }

  const studentId = body.studentId?.trim();
  const password = body.password?.trim();

  if (!studentId || !password) {
    return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "学号和密码不能为空" }, { status: 400 });
  }

  if (isAdminCredential(studentId, password)) {
    await saveMockSession("admin");
    return NextResponse.json({ ok: true });
  }

  try {
    const result = await loginToJw(studentId, password);
    await saveSession(result.cookieHeader);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof JwError) {
      const status = error.code === "JW_UNAVAILABLE" ? 503 : 401;
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status });
    }

    return NextResponse.json({ ok: false, code: "JW_UNAVAILABLE", message: "教务系统暂时不可用，请稍后重试" }, { status: 503 });
  }
}
