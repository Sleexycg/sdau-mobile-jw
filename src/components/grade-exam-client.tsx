"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import type { GradeExamRecord, GradeExamResponse } from "@/types/score";
import type { StudentProfile } from "@/types/timetable";

interface ApiError {
  ok: false;
  code: string;
  message: string;
}

interface ApiSuccess {
  ok: true;
  data: GradeExamResponse;
}

type ApiResult = ApiError | ApiSuccess;

export function GradeExamClient() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [records, setRecords] = useState<GradeExamRecord[]>([]);

  async function loadData(mode: "normal" | "refresh" = "normal") {
    if (mode === "normal") setLoading(true);
    else setRefreshing(true);

    setError("");

    try {
      const response = await fetch("/api/grade-exam-scores", { cache: "no-store" });
      const result = (await response.json()) as ApiResult;

      if (!result.ok) {
        if (result.code === "UNAUTHORIZED") {
          router.replace("/login");
          return;
        }
        setError(result.message || "等级考试成绩加载失败");
        return;
      }

      setProfile(result.data.profile);
      setRecords(result.data.records || []);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      if (mode === "normal") setLoading(false);
      else setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <section className="glass-card rise-in" style={{ padding: 20 }}>
        等级考试成绩加载中...
      </section>
    );
  }

  return (
    <>
      <section className="glass-card rise-in" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>等级考试成绩查询</p>
            <h2 style={{ margin: "2px 0 0", fontSize: 20 }}>{profile?.displayName ?? "-"}</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => loadData("refresh")} style={smallBtn} disabled={refreshing}>
              {refreshing ? "刷新中..." : "刷新"}
            </button>
            <button onClick={logout} style={smallBtn}>退出</button>
          </div>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="glass-card rise-in" style={{ padding: 14 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>等级考试成绩</h3>
        <div style={{ display: "grid", gridTemplateColumns: ".6fr 2.4fr .8fr 1.2fr", gap: 8, fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
          <div>序号</div>
          <div>考级课程(等级)</div>
          <div>成绩</div>
          <div>考试时间</div>
        </div>

        {records.length === 0 ? (
          <div style={{ borderRadius: 12, background: "#f7fcff", padding: 12, fontSize: 14, color: "var(--muted)" }}>
            暂无等级考试成绩
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {records.map((record) => (
              <article key={record.id} style={{ borderRadius: 12, background: "#f7fcff", padding: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: ".6fr 2.4fr .8fr 1.2fr", gap: 8, alignItems: "center" }}>
                  <p style={{ margin: 0, fontSize: 13 }}>{record.sequence || "-"}</p>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{record.examCourse || "-"}</p>
                  <p style={{ margin: 0, fontSize: 13 }}>{record.score || "-"}</p>
                  <p style={{ margin: 0, fontSize: 13 }}>{record.examTime || "-"}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <BottomNav active="grade-exams" />
    </>
  );
}

const smallBtn = {
  border: "1px solid #c8dce5",
  borderRadius: 10,
  background: "white",
  padding: "8px 12px",
  fontSize: 12,
} as const;
