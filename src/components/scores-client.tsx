"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { LoadingPanel } from "@/components/loading-panel";
import type { CourseScoreResponse, ScoreRecord, ScoreTermOption } from "@/types/score";
import type { StudentProfile } from "@/types/timetable";

interface ApiError {
  ok: false;
  code: string;
  message: string;
}

interface ApiSuccess {
  ok: true;
  data: CourseScoreResponse;
}

type ApiResult = ApiError | ApiSuccess;

function isFailScore(score: string): boolean {
  const raw = score.trim();
  if (!raw) return false;
  const num = Number.parseFloat(raw);
  if (!Number.isFinite(num)) return false;
  return num < 60;
}

export function ScoresClient() {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [switchingTerm, setSwitchingTerm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [terms, setTerms] = useState<ScoreTermOption[]>([]);
  const [selectedTerm, setSelectedTerm] = useState("");
  const [termOpen, setTermOpen] = useState(false);
  const [records, setRecords] = useState<ScoreRecord[]>([]);
  const [avgScore, setAvgScore] = useState("-");
  const [avgCreditGpa, setAvgCreditGpa] = useState("-");
  const [courseCount, setCourseCount] = useState(0);
  const [totalCredits, setTotalCredits] = useState("-");

  const selectedTermLabel = useMemo(
    () => terms.find((item) => item.value === selectedTerm)?.label ?? selectedTerm ?? "请选择",
    [terms, selectedTerm],
  );

  async function loadScoreData(term?: string, mode: "normal" | "switch" | "refresh" = "normal") {
    if (mode === "normal") setLoading(true);
    if (mode === "switch") setSwitchingTerm(true);
    if (mode === "refresh") setRefreshing(true);

    setError("");

    try {
      const query = term ? `?term=${encodeURIComponent(term)}` : "";
      const response = await fetch(`/api/course-scores${query}`, { cache: "no-store" });
      const result = (await response.json()) as ApiResult;

      if (!result.ok) {
        if (result.code === "UNAUTHORIZED") {
          router.replace("/login");
          return;
        }
        setError(result.message || "课程成绩加载失败");
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

  useEffect(() => {
    if (!termOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setTermOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [termOpen]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  async function handleSelectTerm(term: string) {
    setSelectedTerm(term);
    setTermOpen(false);
    await loadScoreData(term, "switch");
  }

  if (loading) {
    return <LoadingPanel title="课程成绩加载中" subtitle="正在汇总课程成绩与统计信息..." rows={5} />;
  }

  return (
    <>
      <section className="glass-card rise-in" style={{ padding: 16, marginBottom: 14, position: "relative", zIndex: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>课程成绩查询</p>
            <h2 style={{ margin: "2px 0 0", fontSize: 20 }}>{profile?.displayName ?? "-"}</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => loadScoreData(selectedTerm || undefined, "refresh")} style={smallBtn} disabled={refreshing}>
              {refreshing ? "刷新中..." : "刷新"}
            </button>
            <button onClick={logout} style={smallBtn}>退出</button>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
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
          门数：{courseCount} · 总学分：{totalCredits}
        </p>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <label style={{ fontSize: 13, color: "var(--muted)" }}>开课时间</label>
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setTermOpen((open) => !open)}
              style={{ width: "100%", border: "1px solid #c8dce5", borderRadius: 10, padding: "10px 12px", fontSize: 14, background: "white", textAlign: "left" }}
            >
              <span>{selectedTermLabel}</span>
              <span style={{ float: "right", color: "var(--muted)" }}>{termOpen ? "收起" : "展开"}</span>
            </button>

            <div className={`term-dropdown-panel ${termOpen ? "open" : ""}`}>
              {terms.map((termOption) => {
                const active = termOption.value === selectedTerm;
                return (
                  <button
                    key={termOption.value}
                    type="button"
                    onClick={() => handleSelectTerm(termOption.value)}
                    style={{ display: "block", width: "100%", border: 0, borderBottom: "1px solid #eef3f6", background: active ? "#eef8ff" : "white", textAlign: "left", padding: "10px 12px", fontSize: 14, color: active ? "#0d8e7f" : "var(--ink)" }}
                  >
                    {termOption.label}
                  </button>
                );
              })}
            </div>
          </div>

          {switchingTerm ? <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>切换开课时间中...</p> : null}
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="glass-card rise-in" style={{ padding: 14 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>课程成绩</h3>
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
                  <p style={{ margin: 0, fontSize: 13, color: isFailScore(record.score) ? "#d63b3b" : undefined, fontWeight: isFailScore(record.score) ? 700 : 500 }}>
                    {record.score || "-"}
                  </p>
                  <p style={{ margin: 0, fontSize: 13 }}>{record.gpa || "-"}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <BottomNav active="course-scores" />
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
