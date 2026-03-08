"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { ChevronIcon } from "@/components/chevron-icon";
import { LoadingPanel } from "@/components/loading-panel";
import type { TrainingPlanItem, TrainingPlanResponse } from "@/types/training-plan";
import type { StudentProfile } from "@/types/timetable";

interface ApiError {
  ok: false;
  code: string;
  message: string;
}

interface ApiSuccess {
  ok: true;
  data: TrainingPlanResponse;
}

type ApiResult = ApiError | ApiSuccess;

type ParsedSubject = {
  term: string;
  courseCode: string;
  courseName: string;
  credit: string;
  courseType: string;
  categoryCode: string;
  status: string;
  score: string;
};

const CATEGORY_ORDER = [
  "学科基础课组",
  "通识必修课",
  "实践教学环节",
  "专业核心课",
  "专业方向课",
  "艺术审美类",
  "耕读教育类",
  "体育健康类",
  "四史教育类",
] as const;

const SUBJECT_VISIBLE_CATEGORIES = new Set<string>([
  "专业方向课",
  "艺术审美类",
  "耕读教育类",
  "四史教育类",
  "体育健康类",
]);

const categoryColorMap: Record<string, string> = {
  专业方向课: "#0D8E7F",
  专业核心课: "#2F7FD6",
  学科基础课组: "#7A5AF8",
  实践教学环节: "#E07A1F",
  通识必修课: "#D94874",
  耕读教育类: "#16A34A",
  四史教育类: "#8B5CF6",
  体育健康类: "#0EA5A4",
  艺术审美类: "#D946EF",
};

function toNum(v: string): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function completionRate(item: TrainingPlanItem): number {
  const required = toNum(item.requiredCredits);
  const done = toNum(item.completedCredits) + toNum(item.currentCredits);
  if (required <= 0) return 0;
  return Math.max(0, Math.min(100, (done / required) * 100));
}

function isCategoryCompleted(item: TrainingPlanItem): boolean {
  const required = toNum(item.requiredCredits);
  const done = toNum(item.completedCredits) + toNum(item.currentCredits);
  const remaining = toNum(item.remainingCredits);
  if (required <= 0) return false;
  return remaining <= 0 || done >= required;
}

function colorByCategory(category: string): string {
  return categoryColorMap[category] ?? "#4F6B78";
}

function categoryMarks(category: string): string[] {
  if (category.includes("专业方向课")) return ["XF"];
  if (category.includes("实践教学环节")) return ["BS"];
  if (category.includes("艺术")) return ["XY"];
  if (category.includes("耕读教育")) return ["XZ", "XR", "XG"];
  if (category.includes("体育")) return ["XT"];
  if (category.includes("四史")) return ["XD"];
  return [];
}

function extractSubjects(item: TrainingPlanItem): string[] {
  return Array.isArray(item.subjects)
    ? item.subjects.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
}

function parseSubject(raw: string): ParsedSubject {
  try {
    const obj = JSON.parse(raw) as Partial<ParsedSubject>;
    if (obj && typeof obj === "object" && obj.courseName) {
      return {
        term: obj.term || "-",
        courseCode: obj.courseCode || "-",
        courseName: obj.courseName || "-",
        credit: obj.credit || "-",
        courseType: obj.courseType || "-",
        categoryCode: obj.categoryCode || "-",
        status: obj.status || "-",
        score: obj.score || "-",
      };
    }
  } catch {
    // 兼容旧格式：term | code | name | x学分 | status
  }

  const parts = raw.split("|").map((v) => v.trim());
  return {
    term: parts[0] || "-",
    courseCode: parts[1] || "-",
    courseName: parts[2] || raw,
    credit: (parts[3] || "-").replace("学分", ""),
    courseType: "-",
    categoryCode: "-",
    status: parts[4] || "-",
    score: "-",
  };
}

export function TrainingPlanClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [items, setItems] = useState<TrainingPlanItem[]>([]);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState({
    requiredCredits: "0.0",
    completedCredits: "0.0",
    currentCredits: "0.0",
    remainingCredits: "0.0",
  });

  const donePercent = useMemo(() => {
    const required = toNum(summary.requiredCredits);
    const done = toNum(summary.completedCredits) + toNum(summary.currentCredits);
    if (required <= 0) return 0;
    return Math.max(0, Math.min(100, (done / required) * 100));
  }, [summary]);

  async function loadData(mode: "normal" | "refresh" = "normal") {
    if (mode === "normal") setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const response = await fetch("/api/training-plan", { cache: "no-store" });
      const result = (await response.json()) as ApiResult;

      if (!result.ok) {
        if (result.code === "UNAUTHORIZED") {
          router.replace("/login");
          return;
        }
        setError(result.message || "培养方案加载失败");
        return;
      }

      setProfile(result.data.profile);
      const rank = new Map<string, number>(CATEGORY_ORDER.map((name, idx) => [name, idx]));
      const cleaned = (result.data.items || []).filter((item) => item.category !== "其它");
      cleaned.sort((a, b) => (rank.get(a.category) ?? 999) - (rank.get(b.category) ?? 999));
      setItems(cleaned);
      setSummary(result.data.summary);
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
    return <LoadingPanel title="培养方案加载中" subtitle="正在读取各类别学分完成情况..." rows={6} />;
  }

  return (
    <>
      <section className="glass-card rise-in" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>培养方案查看</p>
            <h2 style={{ margin: "2px 0 0", fontSize: 20 }}>{profile?.displayName ?? "-"}</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => loadData("refresh")}
              className="timetable-icon-btn"
              aria-label="刷新培养方案"
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

        <div style={{ marginTop: 12, borderRadius: 12, background: "#f7fcff", border: "1px solid #e4eff4", padding: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--muted)" }}>总体完成度</span>
            <strong style={{ color: "#173845" }}>{donePercent.toFixed(1)}%</strong>
          </div>
          <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "#e9f2f6", overflow: "hidden" }}>
            <div style={{ width: `${donePercent}%`, height: "100%", background: "linear-gradient(90deg, #0d8e7f, #2da6d8)" }} />
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
            要求 {summary.requiredCredits} · 已修 {summary.completedCredits} · 正修 {summary.currentCredits} · 未修 {summary.remainingCredits}
          </p>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="glass-card rise-in" style={{ padding: 14 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>培养方案学分结构</h3>

        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => {
            const rate = completionRate(item);
            const color = colorByCategory(item.category);
            const marks = categoryMarks(item.category);
            const canExpandSubjects = SUBJECT_VISIBLE_CATEGORIES.has(item.category);
            const subjects = canExpandSubjects ? extractSubjects(item) : [];
            const expanded = Boolean(openMap[item.id]);
            const completed = isCategoryCompleted(item);

            return (
              <article key={item.id} style={{ borderRadius: 12, background: "#f8fcff", border: "1px solid #e4eff4", padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.category}</p>
                    {marks.map((mark) => (
                      <span key={`${item.id}-${mark}`} style={{ fontSize: 10, lineHeight: 1, color, border: `1px solid ${color}55`, background: `${color}12`, borderRadius: 999, padding: "2px 5px", flexShrink: 0 }}>
                        {mark}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {completed ? <span style={{ fontSize: 10, fontWeight: 800, color: "#FFF", background: "#16A34A", borderRadius: 999, padding: "3px 7px", lineHeight: 1 }}>已完成</span> : null}
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color }}>{rate.toFixed(1)}%</p>
                  </div>
                </div>

                <div style={{ marginTop: 8, height: 7, borderRadius: 999, background: "#e9f2f6", overflow: "hidden" }}>
                  <div style={{ width: `${rate}%`, height: "100%", background: color }} />
                </div>

                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
                  <div style={metricBox}><span style={metricLabel}>要求</span><strong style={metricValue}>{item.requiredCredits}</strong></div>
                  <div style={metricBox}><span style={metricLabel}>已修</span><strong style={metricValue}>{item.completedCredits}</strong></div>
                  <div style={metricBox}><span style={metricLabel}>正修</span><strong style={metricValue}>{item.currentCredits}</strong></div>
                  <div style={metricBox}><span style={metricLabel}>未修</span><strong style={metricValue}>{item.remainingCredits}</strong></div>
                </div>

                {canExpandSubjects ? (
                  <>
                    <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        aria-label={expanded ? "收起课程明细" : "展开课程明细"}
                        title={expanded ? "收起课程明细" : "展开课程明细"}
                        onClick={() => setOpenMap((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                        style={{ width: 34, height: 34, border: "1px solid #d8e8ef", borderRadius: 999, background: "white", display: "grid", placeItems: "center", color: "#35515d", cursor: "pointer" }}
                      >
                        <ChevronIcon expanded={expanded} color="currentColor" />
                      </button>
                    </div>

                    <div style={{ marginTop: 8, overflow: "hidden", maxHeight: expanded ? 560 : 0, opacity: expanded ? 1 : 0, transform: expanded ? "translateY(0)" : "translateY(-4px)", transition: "max-height 360ms ease, opacity 240ms ease, transform 240ms ease" }}>
                      {subjects.length > 0 ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          {subjects.map((raw) => {
                            const subject = parseSubject(raw);
                            return (
                              <div key={`${item.id}-${subject.term}-${subject.courseCode}-${subject.courseName}`} style={{ borderRadius: 10, background: "#ffffff", border: "1px solid #e7eff3", padding: "10px 10px 9px" }}>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#16323f" }}>{subject.courseName}</p>
                                <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  <span style={subjectTagStyle}>{subject.courseCode}</span>
                                  <span style={subjectTagStyle}>{subject.term}</span>
                                  <span style={subjectTagStyle}>{subject.credit} 学分</span>
                                  {subject.courseType !== "-" ? <span style={subjectTagStyle}>{subject.courseType}</span> : null}
                                </div>
                                <div style={{ marginTop: 7, display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
                                  <div style={subjectMetricBox}>
                                    <span style={subjectMetricLabel}>修读状态</span>
                                    <strong style={subjectMetricValue}>{subject.status}</strong>
                                  </div>
                                  <div style={subjectMetricBox}>
                                    <span style={subjectMetricLabel}>成绩</span>
                                    <strong style={subjectMetricValue}>{subject.score || "-"}</strong>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ borderRadius: 8, background: "#ffffff", border: "1px solid #e7eff3", padding: "8px 10px", fontSize: 13, color: "var(--muted)" }}>
                          暂无该类课程明细
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </article>
            );
          })}

          <article style={{ borderRadius: 12, background: "#eef7fb", padding: 10, border: "1px solid #d7eaf2" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>合计</p>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
              <div style={metricBox}><span style={metricLabel}>要求</span><strong style={metricValue}>{summary.requiredCredits}</strong></div>
              <div style={metricBox}><span style={metricLabel}>已修</span><strong style={metricValue}>{summary.completedCredits}</strong></div>
              <div style={metricBox}><span style={metricLabel}>正修</span><strong style={metricValue}>{summary.currentCredits}</strong></div>
              <div style={metricBox}><span style={metricLabel}>未修</span><strong style={metricValue}>{summary.remainingCredits}</strong></div>
            </div>
          </article>
        </div>
      </section>

      <BottomNav />
    </>
  );
}

const metricBox = {
  borderRadius: 10,
  background: "white",
  border: "1px solid #e5eef3",
  padding: "8px 6px",
  display: "grid",
  justifyItems: "center",
  gap: 3,
} as const;

const metricLabel = {
  fontSize: 12,
  color: "var(--muted)",
} as const;

const metricValue = {
  fontSize: 14,
  color: "#173845",
} as const;

const subjectTagStyle = {
  fontSize: 11,
  color: "#2f4f5c",
  border: "1px solid #dbe9ef",
  background: "#f7fbfe",
  borderRadius: 999,
  padding: "2px 7px",
  lineHeight: 1.3,
} as const;

const subjectMetricBox = {
  borderRadius: 8,
  border: "1px solid #e8eff3",
  background: "#fbfdff",
  padding: "6px 7px",
  display: "grid",
  gap: 2,
} as const;

const subjectMetricLabel = {
  fontSize: 11,
  color: "var(--muted)",
} as const;

const subjectMetricValue = {
  fontSize: 13,
  color: "#16323f",
} as const;

