"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { LoadingPanel } from "@/components/loading-panel";
import type { CourseScoreResponse, ScoreRecord, ScoreTermOption, UsualScoreDetail } from "@/types/score";
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

interface UsualScoreSuccess {
  ok: true;
  data: UsualScoreDetail;
}

type ApiResult = ApiError | ApiSuccess;
type UsualScoreResult = ApiError | UsualScoreSuccess;

function isFailScore(score: string): boolean {
  const n = Number.parseFloat(score);
  return Number.isFinite(n) && n < 60;
}

function getScoreTone(score: string): "green" | "yellow" | "red" | "neutral" {
  const n = Number.parseFloat(score);
  if (!Number.isFinite(n)) return "neutral";
  if (n >= 80) return "green";
  if (n >= 60) return "yellow";
  return "red";
}

export function ScoresClient() {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const captureRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [switchingTerm, setSwitchingTerm] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [records, setRecords] = useState<ScoreRecord[]>([]);
  const [terms, setTerms] = useState<ScoreTermOption[]>([]);
  const [selectedTerm, setSelectedTerm] = useState("");
  const [termOpen, setTermOpen] = useState(false);

  const [avgScore, setAvgScore] = useState("-");
  const [avgCreditGpa, setAvgCreditGpa] = useState("-");
  const [courseCount, setCourseCount] = useState(0);
  const [totalCredits, setTotalCredits] = useState("-");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRecord, setDetailRecord] = useState<ScoreRecord | null>(null);
  const [detailData, setDetailData] = useState<UsualScoreDetail | null>(null);

  const selectedTermLabel = useMemo(
    () => terms.find((item) => item.value === selectedTerm)?.label ?? selectedTerm ?? "请选择",
    [terms, selectedTerm],
  );

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setTermOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function loadScoreData(term?: string, mode: "normal" | "refresh" | "switch" = "normal") {
    if (mode === "normal") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    if (mode === "switch") setSwitchingTerm(true);

    setError("");

    try {
      const params = term ? `?term=${encodeURIComponent(term)}` : "";
      const response = await fetch(`/api/course-scores${params}`, { cache: "no-store" });
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
      setRecords(result.data.records || []);
      setTerms(result.data.terms || []);
      setSelectedTerm(result.data.selectedTerm || "");
      setAvgScore(result.data.summary.avgScore || "-");
      setAvgCreditGpa(result.data.summary.avgCreditGpa || "-");
      setCourseCount(result.data.summary.courseCount || 0);
      setTotalCredits(result.data.summary.totalCredits || "-");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      if (mode === "normal") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
      if (mode === "switch") setSwitchingTerm(false);
    }
  }

  useEffect(() => {
    loadScoreData(undefined, "normal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  async function exportCurrentTermImage() {
    if (!captureRef.current || exportingImage) return;
    setExportingImage(true);
    try {
      document.body.classList.add("exporting-score-image");
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: "#ffffff",
        scale: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
        useCORS: true,
      });
      const safeTerm = (selectedTermLabel || selectedTerm || "term").replace(/[^\w\u4e00-\u9fa5-]/g, "_");
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `课程成绩-${safeTerm}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setError("导出图片失败，请稍后重试");
    } finally {
      document.body.classList.remove("exporting-score-image");
      setExportingImage(false);
    }
  }

  function closeDetailModal() {
    setDetailOpen(false);
    setDetailError("");
    setDetailRecord(null);
    setDetailData(null);
    setDetailLoading(false);
  }

  async function openUsualScoreDetail(record: ScoreRecord) {
    if (!record.studentIdRaw || !record.teachingTaskId || !record.scoreRecordId) {
      setDetailRecord(record);
      setDetailData(null);
      setDetailError("该课程缺少明细参数，暂时无法查询平时成绩");
      setDetailOpen(true);
      return;
    }

    setDetailRecord(record);
    setDetailData(null);
    setDetailError("");
    setDetailLoading(true);
    setDetailOpen(true);

    try {
      const response = await fetch("/api/course-scores/usual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xs0101id: record.studentIdRaw,
          jx0404id: record.teachingTaskId,
          cj0708id: record.scoreRecordId,
          zcj: record.score,
        }),
      });

      const result = (await response.json()) as UsualScoreResult;
      if (!result.ok) {
        if (result.code === "UNAUTHORIZED") {
          router.replace("/login");
          return;
        }
        setDetailError(result.message || "平时成绩查询失败");
        return;
      }

      setDetailData(result.data);
    } catch {
      setDetailError("网络异常，请稍后重试");
    } finally {
      setDetailLoading(false);
    }
  }

  if (loading) {
    return <LoadingPanel title="课程成绩加载中" subtitle="正在拉取课程成绩数据..." rows={5} />;
  }

  return (
    <>
      <div ref={captureRef} style={{ display: "grid", gap: 14 }}>
        <section className="glass-card rise-in" style={{ padding: 16, marginBottom: 14, position: "relative", zIndex: 30 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>课程成绩查询</p>
              <h2 style={{ margin: "2px 0 0", fontSize: 20 }}>{profile?.displayName ?? "-"}</h2>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={exportCurrentTermImage}
                className="timetable-icon-btn"
                aria-label="保存成绩图片"
                title={exportingImage ? "导出中" : "保存图片"}
                disabled={exportingImage}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" />
                  <path d="M8 11l4 4 4-4" />
                  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
              </button>
              <button
                onClick={() => loadScoreData(selectedTerm || undefined, "refresh")}
                className="timetable-icon-btn"
                aria-label="刷新成绩"
                title={refreshing ? "刷新中" : "刷新"}
                disabled={refreshing}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
              <button onClick={logout} className="timetable-icon-btn" aria-label="退出登录" title="退出">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <path d="M10 17l5-5-5-5" />
                  <path d="M15 12H3" />
                </svg>
              </button>
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

          <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)" }}>门数：{courseCount} · 总学分：{totalCredits}</p>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 13, color: "var(--muted)" }}>开课时间</label>
            <div ref={dropdownRef} style={{ position: "relative", marginTop: 6 }}>
              <button type="button" onClick={() => setTermOpen((open) => !open)} style={{ width: "100%", border: "1px solid #c8dce5", borderRadius: 10, padding: "10px 12px", fontSize: 14, background: "white", textAlign: "left" }}>
                {selectedTermLabel}
              </button>
              <div className={`term-dropdown-panel ${termOpen ? "open" : ""}`}>
                {terms.map((t) => (
                  <button key={t.value} type="button" onClick={() => { setTermOpen(false); loadScoreData(t.value, "switch"); }} style={{ display: "block", width: "100%", border: 0, borderBottom: "1px solid #eef3f6", background: t.value === selectedTerm ? "#eef8ff" : "white", textAlign: "left", padding: "10px 12px", fontSize: 14 }}>
                    {t.label}
                  </button>
                ))}
              </div>
              {switchingTerm ? <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>切换开课时间中...</p> : null}
            </div>
          </div>
        </section>

        {error ? <p className="error-text">{error}</p> : null}

        <section className="glass-card rise-in" style={{ padding: 14 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>课程成绩</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2.2fr .8fr .8fr .8fr", gap: 8, fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
            <div>课程代码</div><div>课程名</div><div>学分</div><div>总成绩</div><div>绩点</div>
          </div>

          {records.length === 0 ? (
            <div style={{ borderRadius: 12, background: "#f7fcff", padding: 12, fontSize: 14, color: "var(--muted)" }}>当前开课时间暂无成绩记录</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {records.map((record) => (
                <article key={record.id} style={{ borderRadius: 12, background: "#f7fcff", padding: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2.2fr .8fr .8fr .8fr", gap: 8, alignItems: "center" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{record.courseCode || "-"}</p>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{record.courseName || "-"}</p>
                    <p style={{ margin: 0, fontSize: 13 }}>{record.credit || "-"}</p>
                    <button type="button" onClick={() => openUsualScoreDetail(record)} style={{ margin: 0, fontSize: 13, color: isFailScore(record.score) ? "#d63b3b" : "#1d4352", fontWeight: isFailScore(record.score) ? 700 : 600, border: 0, background: "transparent", textAlign: "left", padding: 0, cursor: "pointer" }}>
                      {record.score || "-"}
                    </button>
                    <p style={{ margin: 0, fontSize: 13 }}>{record.gpa || "-"}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {detailOpen ? (
        <div className="score-compose-mask" onClick={closeDetailModal}>
          <section className="score-compose-modal" onClick={(event) => event.stopPropagation()}>
            <header className="score-compose-header">
              <div>
                <p className="score-compose-subtitle">成绩构成</p>
                <h3>{detailRecord ? `${detailRecord.courseName || "-"}-${detailRecord.courseCode || "-"}` : "-"}</h3>
              </div>
              <button type="button" onClick={closeDetailModal} className="score-compose-close">关闭</button>
            </header>

            {detailLoading ? (
              <p className="score-compose-status">正在查询平时成绩...</p>
            ) : detailError ? (
              <p className="error-text" style={{ margin: 0 }}>{detailError}</p>
            ) : (
              <>
                <article className="score-compose-item score-compose-item-total">
                  <span>总成绩</span>
                  <strong className={`score-compose-score score-compose-score--${getScoreTone(detailData?.totalScore || detailRecord?.score || "-")}`}>{detailData?.totalScore || detailRecord?.score || "-"}</strong>
                </article>
                <div className="score-compose-grid">
                  <article className="score-compose-item"><span>平时成绩</span><strong>{detailData?.usualScore || "-"}</strong></article>
                  <article className="score-compose-item"><span>平时占比</span><strong>{detailData?.usualRatio || "-"}</strong></article>
                  <article className="score-compose-item"><span>期末成绩</span><strong>{detailData?.finalScore || "-"}</strong></article>
                  <article className="score-compose-item"><span>期末占比</span><strong>{detailData?.finalRatio || "-"}</strong></article>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      <BottomNav active="course-scores" />
    </>
  );
}


