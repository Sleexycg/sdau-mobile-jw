import { NextResponse } from "next/server";

import {
  deleteGroupMemberByNickname,
  getGroupMemberByNickname,
  listGroupMembers,
  upsertGroupMember,
} from "@/lib/group-timetable/store";
import type { GroupMemberTimetable } from "@/types/group-timetable";

interface UpsertBody {
  member?: GroupMemberTimetable;
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname")?.trim();

  if (nickname) {
    const member = await getGroupMemberByNickname(nickname);
    if (!member) {
      return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "未找到该昵称的课程表" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: member });
  }

  const members = await listGroupMembers();
  return NextResponse.json({ ok: true, data: members });
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: UpsertBody;
  try {
    body = (await request.json()) as UpsertBody;
  } catch {
    return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "请求格式错误" }, { status: 400 });
  }

  const member = body.member;
  if (!member || !member.nickname || !Array.isArray(member.courses)) {
    return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "member 数据不完整" }, { status: 400 });
  }

  try {
    const saved = await upsertGroupMember(member);
    return NextResponse.json({ ok: true, data: saved });
  } catch (error) {
    if (error instanceof Error && error.message === "NICKNAME_REQUIRED") {
      return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "昵称不能为空" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, code: "STORE_FAILED", message: "保存失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const nickname = searchParams.get("nickname")?.trim();
  if (!nickname) {
    return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "nickname 不能为空" }, { status: 400 });
  }

  await deleteGroupMemberByNickname(nickname);
  return NextResponse.json({ ok: true });
}
