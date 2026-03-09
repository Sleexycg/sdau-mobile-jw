"use client";

import { useEffect, useMemo, useState } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { LoadingPanel } from "@/components/loading-panel";
import type { CommunityStatus, CommunityTopic, CommunityType } from "@/types/community";

interface ApiError {
  ok: false;
  code: string;
  message: string;
}

interface ApiSuccess<T> {
  ok: true;
  data: T;
}

type TopicListResult = ApiError | ApiSuccess<{ topics: CommunityTopic[]; isAdmin: boolean; viewerId: string }>;
type FilterType = "all" | CommunityType;

const statusLabel: Record<CommunityStatus, string> = {
  open: "待处理",
  in_progress: "处理中",
  resolved: "已修复",
  closed: "已关闭",
};

const statusColor: Record<CommunityStatus, string> = {
  open: "#C58A00",
  in_progress: "#2D7FE6",
  resolved: "#1F9D57",
  closed: "#7A8891",
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function chipStyle(active: boolean) {
  return {
    border: "1px solid #d0e1ea",
    borderRadius: 999,
    background: active ? "#e8f7ff" : "#ffffff",
    color: active ? "#1a4b5d" : "#5e7784",
    padding: "7px 13px",
    fontSize: 13,
    fontWeight: active ? 700 : 600,
    cursor: "pointer",
  } as const;
}

function AdminBadge() {
  return <span style={{ background: "#e8f8ef", color: "#1f9d57", border: "1px solid #9fd9b8", borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>管理员</span>;
}

export function CommunityClient() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [topics, setTopics] = useState<CommunityTopic[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewerId, setViewerId] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [error, setError] = useState("");

  const [newType, setNewType] = useState<CommunityType>("bug");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const filteredTopics = useMemo(() => {
    if (filter === "all") return topics;
    return topics.filter((t) => t.type === filter);
  }, [topics, filter]);

  function topicAuthorText(topic: CommunityTopic): string {
    if (topic.authorName === "admin") return "admin";
    if (topic.anonymous) return topic.authorId;
    return topic.authorName;
  }

  async function loadTopics(nextFilter: FilterType = filter) {
    setError("");
    const params = nextFilter === "all" ? "" : `?type=${nextFilter}`;

    try {
      const response = await fetch(`/api/community${params}`, { cache: "no-store" });
      const result = (await response.json()) as TopicListResult;
      if (!result.ok) {
        setError(result.message || "讨论区加载失败");
        return;
      }
      setTopics(result.data.topics || []);
      setIsAdmin(Boolean(result.data.isAdmin));
      setViewerId(result.data.viewerId || "");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTopics("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createTopic() {
    const title = newTitle.trim();
    const content = newContent.trim();
    if (title.length < 2 || content.length < 2) {
      setError("标题和内容至少2个字");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_topic", type: newType, title, content, anonymous }),
      });

      const result = (await response.json()) as ApiError | ApiSuccess<CommunityTopic>;
      if (!result.ok) {
        setError(result.message || "发帖失败");
        return;
      }

      setNewTitle("");
      setNewContent("");
      setAnonymous(false);
      setShowCompose(false);
      await loadTopics(filter);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function addComment(topicId: string) {
    const content = (commentInputs[topicId] || "").trim();
    if (!content) return;

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_comment", topicId, content }),
      });
      const result = (await response.json()) as ApiError | ApiSuccess<unknown>;
      if (!result.ok) {
        setError(result.message || "评论失败");
        return;
      }

      setCommentInputs((prev) => ({ ...prev, [topicId]: "" }));
      await loadTopics(filter);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteCommentAction(topicId: string, commentId: string) {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_comment", topicId, commentId }),
      });
      const result = (await response.json()) as ApiError | ApiSuccess<unknown>;
      if (!result.ok) {
        setError(result.message || "删除评论失败");
        return;
      }
      await loadTopics(filter);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function adminDelete(topicId: string) {
    if (!window.confirm("确认删除该帖子？删除后不可恢复")) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "admin_delete", topicId }),
      });
      const result = (await response.json()) as ApiError | ApiSuccess<unknown>;
      if (!result.ok) {
        setError(result.message || "删除失败");
        return;
      }
      await loadTopics(filter);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function adminUpdate(topicId: string, payload: { status?: CommunityStatus; pinned?: boolean }) {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "admin_update", topicId, ...payload }),
      });
      const result = (await response.json()) as ApiError | ApiSuccess<unknown>;
      if (!result.ok) {
        setError(result.message || "更新失败");
        return;
      }
      await loadTopics(filter);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingPanel title="讨论区加载中" subtitle="正在同步反馈与讨论..." rows={5} />;

  return (
    <>
      <section className="glass-card rise-in" style={{ padding: 16, marginBottom: 12, background: "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(240,250,255,0.92))", boxShadow: "0 14px 38px rgba(19,62,84,0.12)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", letterSpacing: "0.06em" }}>Community</p>
            <h2 style={{ margin: "2px 0 0", fontSize: 21 }}>Bug反馈与交流</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setShowCompose(true)} style={{ border: "1px solid #c8dce5", borderRadius: 999, background: "#ffffff", color: "#224654", padding: "7px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>发布新帖</button>
            <button className="timetable-icon-btn" onClick={() => loadTopics(filter)} title="刷新">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {([ ["all", "全部"], ["bug", "Bug反馈"], ["chat", "交流讨论"] ] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setFilter(v as FilterType)} style={chipStyle(filter === v)}>{label}</button>
          ))}
        </div>
      </section>


      {error ? <p className="error-text" style={{ marginBottom: 12 }}>{error}</p> : null}

      {showCompose ? (
        <div className="score-compose-mask" onClick={() => setShowCompose(false)}>
          <section className="score-compose-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 720 }}>
            <header className="score-compose-header">
              <div>
                <p className="score-compose-subtitle">发布新帖</p>
                <h3 style={{ margin: 0 }}>社区发帖</h3>
              </div>
            </header>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <select value={newType} onChange={(e) => setNewType(e.target.value as CommunityType)} style={{ border: "1px solid #c8dce5", borderRadius: 10, padding: "9px 10px", fontSize: 14, background: "white" }}>
                  <option value="bug">Bug反馈</option>
                  <option value="chat">交流讨论</option>
                </select>
                <label style={{ border: "1px solid #c8dce5", borderRadius: 10, padding: "0 10px", display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#3a5663", background: "white" }}>
                  <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
                  匿名发布（仅显示学号）
                </label>
              </div>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="标题（2-80字）" style={{ border: "1px solid #c8dce5", borderRadius: 10, padding: "10px 12px", fontSize: 14 }} />
              <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="详细描述（2-2000字）" rows={6} style={{ border: "1px solid #c8dce5", borderRadius: 10, padding: "10px 12px", fontSize: 14, resize: "vertical" }} />
              <button onClick={createTopic} disabled={submitting} style={{ border: 0, borderRadius: 10, background: "linear-gradient(120deg, #0d8e7f, #15af8c)", color: "white", fontSize: 14, fontWeight: 700, padding: "10px 12px", cursor: "pointer", opacity: submitting ? 0.75 : 1 }}>
                发布
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <section className="glass-card rise-in" style={{ padding: 14, marginBottom: 84 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>帖子列表</h3>
        {filteredTopics.length === 0 ? (
          <div style={{ borderRadius: 12, background: "#f7fcff", padding: 12, color: "var(--muted)", fontSize: 14 }}>当前暂无帖子</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filteredTopics.map((topic) => (
              <article key={topic.id} style={{ borderRadius: 14, background: "linear-gradient(180deg,#fbfeff,#f4fbff)", border: "1px solid #e4f0f6", padding: 12, boxShadow: "0 6px 18px rgba(25,73,96,0.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                      {topic.type === "bug" ? "Bug反馈" : "交流讨论"}{topic.pinned ? " · 置顶" : ""}
                    </p>
                    <h4 style={{ margin: "4px 0 0", fontSize: 16, wordBreak: "break-word" }}>{topic.title}</h4>
                  </div>
                  <span style={{ fontSize: 12, color: statusColor[topic.status], border: `1px solid ${statusColor[topic.status]}44`, background: `${statusColor[topic.status]}11`, borderRadius: 999, padding: "4px 8px", whiteSpace: "nowrap" }}>{statusLabel[topic.status]}</span>
                </div>

                <p style={{ margin: "8px 0 0", fontSize: 14, color: "#244656", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{topic.content}</p>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {topicAuthorText(topic)}
                  {topic.authorName === "admin" ? <AdminBadge /> : null}
                  <span>· {formatTime(topic.createdAt)}</span>
                </p>

                {isAdmin ? (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(["open", "in_progress", "resolved", "closed"] as CommunityStatus[]).map((status) => (
                      <button key={status} type="button" onClick={() => adminUpdate(topic.id, { status })} style={chipStyle(topic.status === status)}>{statusLabel[status]}</button>
                    ))}
                    <button type="button" onClick={() => adminUpdate(topic.id, { pinned: !topic.pinned })} style={{ ...chipStyle(topic.pinned), background: topic.pinned ? "#fff2dc" : "#ffffff" }}>
                      {topic.pinned ? "取消置顶" : "置顶"}
                    </button>
                    <button type="button" onClick={() => adminDelete(topic.id)} style={{ ...chipStyle(false), background: "#fff1f1", color: "#b42318", borderColor: "#f7c6c6" }}>
                      删除帖子
                    </button>
                  </div>
                ) : null}

                <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                  {topic.comments.map((comment) => (
                    <div key={comment.id} style={{ borderRadius: 10, background: "white", border: "1px solid #e7f0f5", padding: "8px 10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <p style={{ margin: 0, fontSize: 13, color: "#244656", whiteSpace: "pre-wrap", wordBreak: "break-word", flex: 1 }}>{comment.content}</p>
                        {(isAdmin || comment.authorId === viewerId) ? (
                          <button type="button" onClick={() => deleteCommentAction(topic.id, comment.id)} style={{ border: "1px solid #f1c8c8", background: "#fff5f5", color: "#b42318", borderRadius: 8, padding: "3px 8px", fontSize: 12, cursor: "pointer" }}>
                            删除
                          </button>
                        ) : null}
                      </div>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {comment.authorName}
                        {comment.authorName === "admin" ? <AdminBadge /> : null}
                        <span>· {formatTime(comment.createdAt)}</span>
                      </p>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <input value={commentInputs[topic.id] || ""} onChange={(e) => setCommentInputs((prev) => ({ ...prev, [topic.id]: e.target.value }))} placeholder="写评论..." style={{ flex: 1, border: "1px solid #c8dce5", borderRadius: 10, padding: "8px 10px", fontSize: 13 }} />
                  <button onClick={() => addComment(topic.id)} disabled={submitting} style={{ border: 0, borderRadius: 10, background: "#0d8e7f", color: "white", fontSize: 13, fontWeight: 700, padding: "8px 10px", cursor: "pointer", opacity: submitting ? 0.75 : 1 }}>发送</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <BottomNav />
    </>
  );
}

