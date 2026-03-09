import { NextResponse } from "next/server";

import { isCommunityAdmin } from "@/lib/community/admin";
import { addComment, createTopic, deleteComment, deleteTopic, getComment, listTopics, updateTopic } from "@/lib/community/store";
import { fetchStudentProfile } from "@/lib/jw/client";
import { JwError } from "@/lib/jw/errors";
import { getMockProfile } from "@/lib/mock/admin-data";
import { readSession } from "@/lib/session/store";
import type { CommunityStatus, CommunityType } from "@/types/community";

interface UserIdentity {
  id: string;
  name: string;
  isAdmin: boolean;
}

const typeSet = new Set<CommunityType>(["bug", "chat"]);
const statusSet = new Set<CommunityStatus>(["open", "in_progress", "resolved", "closed"]);

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

function formatAuthor(identity: UserIdentity): string {
  if (identity.isAdmin) return "admin";
  return `${identity.name}-${identity.id}`;
}

async function resolveIdentity(): Promise<UserIdentity | null> {
  const session = await readSession();
  if (!session) return null;

  if (session.mode === "mock") {
    const profile = getMockProfile();
    const id = String(session.userId || profile.studentId || "");
    const name = String(profile.name || "同学");
    return { id, name, isAdmin: isCommunityAdmin(id) };
  }

  const cookieHeader = session.cookieHeader;
  if (!cookieHeader) return null;

  try {
    const profile = await fetchStudentProfile(cookieHeader);
    const id = String(profile.studentId || "");
    const name = String(profile.name || "同学");
    return { id, name, isAdmin: isCommunityAdmin(id) };
  } catch (error) {
    if (error instanceof JwError && error.code === "UNAUTHORIZED") return null;
    return null;
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const identity = await resolveIdentity();
  if (!identity) return errorResponse(401, "UNAUTHORIZED", "请先登录");

  const { searchParams } = new URL(request.url);
  const rawType = (searchParams.get("type") || "").trim() as CommunityType;
  const type = typeSet.has(rawType) ? rawType : undefined;

  const topics = await listTopics(type);
  return NextResponse.json({ ok: true, data: { topics, isAdmin: identity.isAdmin, viewerId: identity.id } });
}

export async function POST(request: Request): Promise<NextResponse> {
  const identity = await resolveIdentity();
  if (!identity) return errorResponse(401, "UNAUTHORIZED", "请先登录");

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, "BAD_REQUEST", "请求体格式错误");
  }

  const action = String(body.action || "").trim();

  if (action === "create_topic") {
    const type = String(body.type || "").trim() as CommunityType;
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const anonymous = Boolean(body.anonymous);

    if (!typeSet.has(type)) return errorResponse(400, "BAD_REQUEST", "帖子类型无效");
    if (!title || title.length < 2 || title.length > 80) return errorResponse(400, "BAD_REQUEST", "标题长度需在2-80字");
    if (!content || content.length < 2 || content.length > 2000) return errorResponse(400, "BAD_REQUEST", "内容长度需在2-2000字");

    const topic = await createTopic({
      type,
      title,
      content,
      authorName: formatAuthor(identity),
      authorId: identity.id,
      anonymous,
    });

    return NextResponse.json({ ok: true, data: topic });
  }

  if (action === "add_comment") {
    const topicId = String(body.topicId || "").trim();
    const content = String(body.content || "").trim();

    if (!topicId) return errorResponse(400, "BAD_REQUEST", "topicId 不能为空");
    if (!content || content.length < 1 || content.length > 1000) return errorResponse(400, "BAD_REQUEST", "评论长度需在1-1000字");

    try {
      const comment = await addComment({
        topicId,
        content,
        authorName: identity.isAdmin ? "admin" : `${identity.name}-${identity.id}`,
        authorId: identity.id,
      });
      return NextResponse.json({ ok: true, data: comment });
    } catch {
      return errorResponse(404, "NOT_FOUND", "帖子不存在");
    }
  }

  if (action === "delete_comment") {
    const topicId = String(body.topicId || "").trim();
    const commentId = String(body.commentId || "").trim();
    if (!topicId || !commentId) return errorResponse(400, "BAD_REQUEST", "topicId/commentId 不能为空");

    try {
      const comment = await getComment(topicId, commentId);
      if (!identity.isAdmin && comment.authorId !== identity.id) {
        return errorResponse(403, "FORBIDDEN", "仅管理员或评论作者可删除");
      }
      await deleteComment(topicId, commentId);
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = String((error as Error)?.message || "");
      if (message === "TOPIC_NOT_FOUND" || message === "COMMENT_NOT_FOUND") {
        return errorResponse(404, "NOT_FOUND", "评论不存在");
      }
      return errorResponse(503, "JW_UNAVAILABLE", "删除评论失败");
    }
  }

  if (action === "admin_delete") {
    if (!identity.isAdmin) return errorResponse(403, "FORBIDDEN", "仅管理员可操作");
    const topicId = String(body.topicId || "").trim();
    if (!topicId) return errorResponse(400, "BAD_REQUEST", "topicId 不能为空");

    try {
      await deleteTopic(topicId);
      return NextResponse.json({ ok: true });
    } catch {
      return errorResponse(404, "NOT_FOUND", "帖子不存在");
    }
  }

  if (action === "admin_update") {
    if (!identity.isAdmin) return errorResponse(403, "FORBIDDEN", "仅管理员可操作");

    const topicId = String(body.topicId || "").trim();
    const statusRaw = String(body.status || "").trim();
    const pinnedRaw = body.pinned;

    if (!topicId) return errorResponse(400, "BAD_REQUEST", "topicId 不能为空");

    const status = statusSet.has(statusRaw as CommunityStatus) ? (statusRaw as CommunityStatus) : undefined;
    const pinned = typeof pinnedRaw === "boolean" ? pinnedRaw : undefined;

    if (!status && typeof pinned !== "boolean") {
      return errorResponse(400, "BAD_REQUEST", "未提供可更新字段");
    }

    try {
      const topic = await updateTopic({ topicId, status, pinned });
      return NextResponse.json({ ok: true, data: topic });
    } catch {
      return errorResponse(404, "NOT_FOUND", "帖子不存在");
    }
  }

  return errorResponse(400, "BAD_REQUEST", "未知操作类型");
}
