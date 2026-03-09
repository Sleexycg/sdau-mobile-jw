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
  const raw = String(score ?? "").trim();
  if (!raw) return "neutral";

  if (raw.includes("优秀") || raw.includes("良好")) return "green";
  if (raw.includes("中等") || raw.includes("及格")) return "yellow";
  if (raw.includes("不合格")) return "red";

  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return "neutral";
  if (n >= 80) return "green";
  if (n >= 60) return "yellow";
  return "red";
}

export function ScoresClient() {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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
    if (exportingImage) return;
    setExportingImage(true);
    try {
      const width = 1600;
      const padding = 44;
      const headerHeight = 170;
      const summaryHeight = 120;
      const tableTitleHeight = 48;
      const tableHeaderHeight = 56;
      const rowHeight = 68;
      const tableRows = Math.max(1, records.length);
      const tableHeight = tableHeaderHeight + tableRows * rowHeight;
      const height = padding * 2 + headerHeight + summaryHeight + tableTitleHeight + tableHeight;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const contentW = width - padding * 2;
      const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
      };

      const wrapText = (text: string, maxWidth: number): string[] => {
        const safe = String(text || "-");
        const chars = [...safe];
        const lines: string[] = [];
        let current = "";
        for (const ch of chars) {
          const next = `${current}${ch}`;
          if (ctx.measureText(next).width <= maxWidth) current = next;
          else {
            if (current) lines.push(current);
            current = ch;
          }
        }
        if (current) lines.push(current);
        return lines.length ? lines : ["-"];
      };

      ctx.fillStyle = "#f3f9fc";
      ctx.fillRect(0, 0, width, height);

      drawRoundRect(padding, padding, contentW, headerHeight, 24);
      const headerGradient = ctx.createLinearGradient(padding, padding, padding + contentW, padding + headerHeight);
      headerGradient.addColorStop(0, "#e8f8ff");
      headerGradient.addColorStop(1, "#f5efff");
      ctx.fillStyle = headerGradient;
      ctx.fill();

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#4f6b79";
      ctx.font = "600 24px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText("WeSDAU-成绩单", padding + 24, padding + 44);

      ctx.fillStyle = "#17333f";
      ctx.font = "700 40px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText(profile?.displayName || "-", padding + 24, padding + 98);

      ctx.fillStyle = "#577382";
      ctx.font = "500 24px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText(`学期：${selectedTermLabel || selectedTerm || "-"}`, padding + 24, padding + 136);

      let y = padding + headerHeight + 18;
      const summaryGap = 18;
      const summaryCardW = (contentW - summaryGap * 2) / 3;

      drawRoundRect(padding, y, summaryCardW, summaryHeight, 18);
      ctx.fillStyle = "#fff5f8";
      ctx.fill();
      ctx.fillStyle = "#6c8090";
      ctx.font = "500 22px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText("平均成绩", padding + 20, y + 38);
      ctx.fillStyle = "#F56C7E";
      ctx.font = "700 44px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText(avgScore || "-", padding + 20, y + 92);

      const gpaX = padding + summaryCardW + summaryGap;
      drawRoundRect(gpaX, y, summaryCardW, summaryHeight, 18);
      ctx.fillStyle = "#f5f4ff";
      ctx.fill();
      ctx.fillStyle = "#6c8090";
      ctx.font = "500 22px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText("平均学分绩点", gpaX + 20, y + 38);
      ctx.fillStyle = "#838CC7";
      ctx.font = "700 44px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText(avgCreditGpa || "-", gpaX + 20, y + 92);

      const metaX = gpaX + summaryCardW + summaryGap;
      drawRoundRect(metaX, y, summaryCardW, summaryHeight, 18);
      ctx.fillStyle = "#f7fcff";
      ctx.fill();
      ctx.fillStyle = "#5f7783";
      ctx.font = "500 22px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText("课程统计", metaX + 20, y + 38);
      ctx.fillStyle = "#1f3d4b";
      ctx.font = "600 28px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      const countText = `门数：${courseCount}`;
      ctx.fillText(countText, metaX + 20, y + 88);
      const countWidth = ctx.measureText(countText).width;
      ctx.font = "500 20px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText(`总学分：${totalCredits}`, metaX + 20 + countWidth + 22, y + 88);
      ctx.font = "600 28px 'Microsoft YaHei', 'PingFang SC', sans-serif";


      y += summaryHeight + 18;
      ctx.fillStyle = "#244656";
      ctx.font = "700 30px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText("课程成绩", padding + 2, y + 34);
      y += tableTitleHeight;

      const colRatios = [1.2, 2.3, 0.8, 0.8, 0.8];
      const ratioSum = colRatios.reduce((sum, n) => sum + n, 0);
      const colWidths = colRatios.map((n) => (contentW * n) / ratioSum);
      const headers = ["课程代码", "课程名", "学分", "总成绩", "绩点"];

      drawRoundRect(padding, y, contentW, tableHeaderHeight, 14);
      ctx.fillStyle = "#eaf4fa";
      ctx.fill();

      let xCursor = padding;
      ctx.fillStyle = "#506977";
      ctx.font = "600 21px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      headers.forEach((header, index) => {
        ctx.fillText(header, xCursor + 14, y + 35);
        xCursor += colWidths[index];
      });
      y += tableHeaderHeight;

      const rows: ScoreRecord[] = records.length > 0
        ? records
        : [{ id: "empty", courseCode: "-", courseName: "当前开课时间暂无成绩记录", credit: "-", score: "-", gpa: "-", studentIdRaw: "", teachingTaskId: "", scoreRecordId: "" }];

      rows.forEach((record, idx) => {
        const rowY = y + idx * rowHeight;
        drawRoundRect(padding, rowY + 3, contentW, rowHeight - 6, 12);
        ctx.fillStyle = idx % 2 === 0 ? "#ffffff" : "#f8fcff";
        ctx.fill();
        ctx.strokeStyle = "#e6eff4";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, rowY + rowHeight);
        ctx.lineTo(padding + contentW, rowY + rowHeight);
        ctx.stroke();

        const values = [record.courseCode || "-", record.courseName || "-", record.credit || "-", record.score || "-", record.gpa || "-"];
        let cellX = padding;
        values.forEach((value, col) => {
          const w = colWidths[col];
          if (col === 1) {
            ctx.fillStyle = "#193744";
            ctx.font = "600 22px 'Microsoft YaHei', 'PingFang SC', sans-serif";
            const lines = wrapText(value, w - 28).slice(0, 2);
            const lineHeight = 24;
            const startY = rowY + (lines.length === 2 ? 27 : 42);
            lines.forEach((line, lineIndex) => {
              ctx.fillText(line, cellX + 14, startY + lineIndex * lineHeight);
            });
          } else {
            const scoreTone = col === 3 ? getScoreTone(record.score) : "neutral";
            const color = col === 3
              ? (scoreTone === "green" ? "#1f9d57" : scoreTone === "yellow" ? "#c58a00" : scoreTone === "red" ? "#d63b3b" : "#1f3d4b")
              : "#1f3d4b";
            ctx.fillStyle = color;
            ctx.font = col === 0 ? "700 20px 'Microsoft YaHei', 'PingFang SC', sans-serif" : "600 22px 'Microsoft YaHei', 'PingFang SC', sans-serif";
            const line = wrapText(value, w - 28)[0];
            ctx.fillText(line, cellX + 14, rowY + 42);
          }
          cellX += w;
        });
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
      <div style={{ display: "grid", gap: 14 }}>
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







