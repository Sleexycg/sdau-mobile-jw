"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import type { ScoreRecord, ScoreResponse, ScoreTermOption } from "@/types/score";
import type { StudentProfile } from "@/types/timetable";

interface ApiError {
  ok: false;
  code: string;
  message: string;
}

interface ApiSuccess {
  ok: true;
  data: ScoreResponse;
}

type ApiResult = ApiError | ApiSuccess;

export function ScoresClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [switchingTerm, setSwitchingTerm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [terms, setTerms] = useState<ScoreTermOption[]>([]);
  const [selectedTerm, setSelectedTerm] = useState("");
  const [records, setRecords] = useState<ScoreRecord[]>([]);
  const [avgScore, setAvgScore] = useState("-");
  const [avgCreditGpa, setAvgCreditGpa] = useState("-");
  const [courseCount, setCourseCount] = useState(0);
  const [totalCredits, setTotalCredits] = useState("-");

  async function loadScoreData(term?: string, mode: "normal" | "switch" | "refresh" = "normal") {
    if (mode === "normal") setLoading(true);
    if (mode === "switch") setSwitchingTerm(true);
    if (mode === "refresh") setRefreshing(true);

    setError("");

    try {
      const query = term ? `?term=${encodeURIComponent(term)}` : "";
      const response = await fetch(`/api/scores${query}`, { cache: "no-store" });
      const result = (await response.json()) as ApiResult;

      if (!result.ok) {
        if (result.code === "UNAUTHORIZED") {
          router.replace("/login");
          return;
        }
        setError(result.message || "成绩加载失败");
        return;
      }

      setProfile(result.data.profile);
      setTerms(result.data.terms);
      setSelectedTerm(result.data.selectedTerm);
      setRecords(result.data.records);
      setAvgScore(result.data.summary.avgScore || "-");
      setAvgCreditGpa(result.data.summary.avgCreditGpa || "-");
      setCourseCount(result.data.summary.courseCount || 0);
      setTotalCredits(result.data.summary.totalCredits || "-");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      if (mode === "normal") setLoading(false);
      if (mode === "switch") setSwitchingTerm(false);
      if (mode === "refresh") setRefreshing(false);
    }
  }

  useEffect(() => {
    loadScoreData();
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
        成绩加载中...
      </section>
    );
  }

  return (
    <>
      <section className="glass-card rise-in" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>成绩查询</p>
            <h2 style={{ margin: "2px 0 0", fontSize: 20 }}>{profile?.displayName ?? "-"}</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => loadScoreData(selectedTerm || undefined, "refresh")} style={smallBtn} disabled={refreshing}>
              {refreshing ? "刷新中..." : "刷新"}
            </button>
            <button onClick={logout} style={smallBtn}>退出</button>
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          }}
        >
          <div style={{ borderRadius: 12, background: "#fff7f7", padding: 10 }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>平均成绩</p>
            <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800, color: "#F56C7E" }}>{avgScore}</p>
          </div>
          <div style={{ borderRadius: 12, background: "#faf5ff", padding: 10 }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>平均学分绩点</p>
            <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800, color: "#838CC7" }}>{avgCreditGpa}</p>
          </div>
        </div>

        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)" }}>
          门数：{courseCount} ｜ 总学分：{totalCredits}
        </p>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <label style={{ fontSize: 13, color: "var(--muted)" }} htmlFor="score-term-select">开课时间</label>
          <select
            id="score-term-select"
            value={selectedTerm}
            onChange={(event) => {
              const term = event.target.value;
              setSelectedTerm(term);
              loadScoreData(term, "switch");
            }}
            style={{
              border: "1px solid #c8dce5",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 14,
              background: "white",
            }}
          >
            {terms.map((termOption) => (
              <option key={termOption.value} value={termOption.value}>{termOption.label}</option>
            ))}
          </select>
          {switchingTerm ? <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>切换开课时间中...</p> : null}
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="glass-card rise-in" style={{ padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2.2fr .8fr .8fr .8fr", gap: 8, fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
          <div>课程代码</div>
          <div>课程名</div>
          <div>学分</div>
          <div>成绩</div>
          <div>绩点</div>
        </div>

        {records.length === 0 ? (
          <div style={{ borderRadius: 12, background: "#f7fcff", padding: 12, fontSize: 14, color: "var(--muted)" }}>
            当前开课时间暂无成绩记录
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {records.map((record) => (
              <article key={record.id} style={{ borderRadius: 12, background: "#f7fcff", padding: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2.2fr .8fr .8fr .8fr", gap: 8, alignItems: "center" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{record.courseCode || "-"}</p>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{record.courseName || "-"}</p>
                  <p style={{ margin: 0, fontSize: 13 }}>{record.credit || "-"}</p>
                  <p style={{ margin: 0, fontSize: 13 }}>{record.score || "-"}</p>
                  <p style={{ margin: 0, fontSize: 13 }}>{record.gpa || "-"}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <BottomNav active="scores" />
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