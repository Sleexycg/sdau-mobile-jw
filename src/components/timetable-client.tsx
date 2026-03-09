"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { ChevronIcon } from "@/components/chevron-icon";
import { LoadingPanel } from "@/components/loading-panel";
import type { StudentProfile, TimetableCourse, TimetableResponse } from "@/types/timetable";

interface ApiError {
  ok: false;
  code: string;
  message: string;
}

interface ApiSuccess {
  ok: true;
  data: TimetableResponse;
}


type ApiResult = ApiError | ApiSuccess;
type SectionTimeMap = Record<number, string>;
type ChangelogEntry = {
  version: string;
  title?: string;
  publishedAt?: string;
  items?: string[];
};
type ChangelogData = {
  version: string;
  title?: string;
  publishedAt?: string;
  items?: string[];
  history?: ChangelogEntry[];
};

const weekdays = ["\u5468\u4e00", "\u5468\u4e8c", "\u5468\u4e09", "\u5468\u56db", "\u5468\u4e94", "\u5468\u516d", "\u5468\u65e5"];
const sectionIndexes = [1, 2, 3, 4, 5] as const;
const sectionNameMap: Record<number, string> = {
  1: "\u7b2c\u4e00\u5927\u8282",
  2: "\u7b2c\u4e8c\u5927\u8282",
  3: "\u7b2c\u4e09\u5927\u8282",
  4: "\u7b2c\u56db\u5927\u8282",
  5: "\u7b2c\u4e94\u5927\u8282",
};

const courseColorPalette = [
  { bg: "#EAF4FF", border: "#BCD9FF", text: "#1F3D63" },
  { bg: "#ECFFF4", border: "#BFEBD2", text: "#1F5A42" },
  { bg: "#FFF6EA", border: "#F2D9B0", text: "#6A4A1F" },
  { bg: "#F3EEFF", border: "#D6C8F7", text: "#4A346E" },
  { bg: "#FFEFF3", border: "#F5C6D5", text: "#6A2E44" },
  { bg: "#EEF9FB", border: "#BFE6ED", text: "#245766" },
] as const;

function isSummerSchedule(date: Date): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (month < 5 || month > 8) return false;
  if (month > 5 && month < 8) return true;
  if (month === 5) return day >= 1;
  return day <= 31;
}

function getSectionTimeMap(date: Date): SectionTimeMap {
  if (isSummerSchedule(date)) {
    return { 1: "8:00-9:40", 2: "10:00-11:40", 3: "14:30-16:10", 4: "16:30-18:10", 5: "19:30-21:10" };
  }
  return { 1: "8:00-9:40", 2: "10:00-11:40", 3: "14:00-15:40", 4: "16:00-17:40", 5: "19:00-20:40" };
}

function sectionLabelWithTime(sectionIndex: number, timeMap: SectionTimeMap): string {
  const name = sectionNameMap[sectionIndex] ?? `\u7b2c${sectionIndex}\u5927\u8282`;
  const time = timeMap[sectionIndex];
  return time ? `${name}\uff08${time}\uff09` : name;
}

function sectionRangeText(startSection: number, endSection: number, timeMap: SectionTimeMap): string {
  const start = sectionLabelWithTime(startSection, timeMap);
  const end = sectionLabelWithTime(endSection, timeMap);
  return startSection === endSection ? start : `${start}-${end}`;
}

function formatWeeks(weeks: number[]): string {
  if (weeks.length === 0) return "-";
  const sorted = [...new Set(weeks)].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (current === end + 1) {
      end = current;
      continue;
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    start = current;
    end = current;
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return `${ranges.join(",")}\u5468`;
}

function weeksToCsvText(weeks: number[]): string {
  if (weeks.length === 0) return "-";
  const sorted = [...new Set(weeks)].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (current === end + 1) {
      end = current;
      continue;
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    start = current;
    end = current;
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(",");
}

function csvField(value: string | number): string {
  const raw = String(value ?? "");
  return `"${raw.replace(/"/g, '""')}"`;
}
function todayWeekday(): number {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

function maxWeekFromCourses(courses: TimetableCourse[]): number {
  return courses.reduce((max, course) => Math.max(max, ...course.weeks), 1);
}

function coursesForSlot(courses: TimetableCourse[], sectionIndex: number): TimetableCourse[] {
  return courses.filter((course) => sectionIndex >= course.startSection && sectionIndex <= course.endSection);
}

function detectDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth >= 920;
}

function courseColorByName(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return courseColorPalette[hash % courseColorPalette.length];
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}


function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [];
  const chars = [...text];
  const lines: string[] = [];
  let current = "";
  for (const ch of chars) {
    const next = `${current}${ch}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = ch;
  }
  if (current) lines.push(current);
  return lines;
}
interface DayPanelProps {
  day: number;
  dayCourses: TimetableCourse[];
  sectionTimeMap: SectionTimeMap;
  onCourseClick: (course: TimetableCourse) => void;
}

function DayPanel({ day, dayCourses, sectionTimeMap, onCourseClick }: DayPanelProps) {
  const weekendAllEmpty = day >= 6 && dayCourses.length === 0;
  if (weekendAllEmpty) {
    return (
      <div style={{ borderRadius: 10, background: "#f7fcff", padding: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{"\u5168\u5929\u65e0\u8bfe"}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {sectionIndexes.map((sectionIndex) => {
        const slotCourses = coursesForSlot(dayCourses, sectionIndex);
        return (
          <div key={`${day}-${sectionIndex}`} style={{ borderRadius: 10, background: "#f7fcff", padding: 10 }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>{sectionLabelWithTime(sectionIndex, sectionTimeMap)}</p>
            {slotCourses.length === 0 ? (
              <div style={{ height: 16, marginTop: 4 }} />
            ) : (
              <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                {slotCourses.map((course) => {
                  const color = courseColorByName(course.name);
                  return (
                    <button key={`${course.id}-${sectionIndex}`} onClick={() => onCourseClick(course)} style={{ textAlign: "left", borderRadius: 10, border: `1px solid ${color.border}`, background: color.bg, color: color.text, padding: "8px 10px" }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{course.name}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12 }}>{"\u8001\u5e08\uff1a"}{course.teacher || "\u5f85\u5b9a"}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 700 }}>{"\u6559\u5ba4\uff1a"}{course.location || "\u5f85\u5b9a"}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TimetableClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [term, setTerm] = useState("");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [week, setWeek] = useState(1);
  const [courses, setCourses] = useState<TimetableCourse[]>([]);
  const [selected, setSelected] = useState<TimetableCourse | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [sectionTimeMap, setSectionTimeMap] = useState<SectionTimeMap>(() => getSectionTimeMap(new Date()));
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [selectedDesktopDay, setSelectedDesktopDay] = useState<number>(todayWeekday() === 7 ? 1 : todayWeekday() + 1);
  const [changelog, setChangelog] = useState<ChangelogData | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [checkingChangelog, setCheckingChangelog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  async function fetchChangelog(autoOpen: boolean) {
    const url = process.env.NEXT_PUBLIC_CHANGELOG_URL;
    if (!url) return;

    try {
      setCheckingChangelog(true);
      const bustUrl = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
      const response = await fetch(bustUrl, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as ChangelogData;
      if (!data?.version) return;
      setChangelog(data);

      if (!autoOpen || typeof window === "undefined") return;
      const viewedKey = `wesdau_changelog_seen_${data.version}`;
      const hasSeen = window.localStorage.getItem(viewedKey) === "1";
      if (!hasSeen) setShowChangelog(true);
    } catch {
      // Ignore changelog errors.
    } finally {
      setCheckingChangelog(false);
    }
  }

  function closeChangelog() {
    if (changelog?.version && typeof window !== "undefined") {
      window.localStorage.setItem(`wesdau_changelog_seen_${changelog.version}`, "1");
    }
    setShowChangelog(false);
    setShowHistory(false);
  }

  async function loadTimetable(options: { resetWeek?: boolean; silent?: boolean } = {}) {
    const { resetWeek = false, silent = false } = options;
    if (silent) setRefreshing(true); else setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/timetable", { cache: "no-store" });
      const result = (await response.json()) as ApiResult;
      if (!result.ok) {
        if (result.code === "UNAUTHORIZED") {
          router.replace("/login");
          return;
        }
        setError(result.message || "\u8bfe\u8868\u52a0\u8f7d\u5931\u8d25");
        return;
      }
      setTerm(result.data.term);
      setProfile(result.data.profile);
      setCourses(result.data.courses);
      if (resetWeek) {
        const maxWeekFromData = maxWeekFromCourses(result.data.courses || []);
        let initialWeek = 1;

        try {
          const ctxRes = await fetch("/api/empty-rooms/context", { cache: "no-store" });
          if (ctxRes.ok) {
            const ctxJson = (await ctxRes.json()) as { ok?: boolean; data?: { week?: number } };
            const ctxWeek = Number(ctxJson?.data?.week ?? 0);
            if (Number.isFinite(ctxWeek) && ctxWeek > 0) {
              initialWeek = ctxWeek;
            }
          }
        } catch {
          // ignore context failure and fallback to week 1
        }

        setWeek(Math.max(1, Math.min(maxWeekFromData, initialWeek)));
      }
    } catch {
      setError("\u7f51\u7edc\u5f02\u5e38\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5");
    } finally {
      if (silent) setRefreshing(false); else setLoading(false);
    }
  }

  useEffect(() => {
    loadTimetable({ resetWeek: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onResize = () => setIsDesktop(detectDesktop());
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const updateSectionTime = () => setSectionTimeMap(getSectionTimeMap(new Date()));
    const onVisibilityOrFocus = () => updateSectionTime();

    updateSectionTime();
    const timer = window.setInterval(updateSectionTime, 60 * 1000);
    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
    };
  }, []);

  useEffect(() => {
    fetchChangelog(true);
  }, []);
  useEffect(() => {
    if (!showExportMenu) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!exportMenuRef.current) return;
      if (!exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showExportMenu]);

  const groupedByWeekday = useMemo(() => {
    const map = new Map<number, TimetableCourse[]>();
    for (let i = 1; i <= 7; i += 1) map.set(i, []);
    for (const course of courses) {
      if (!course.weeks.includes(week)) continue;
      const list = map.get(course.weekday) ?? [];
      list.push(course);
      map.set(course.weekday, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.startSection - b.startSection);
    return map;
  }, [courses, week]);

  const maxWeek = useMemo(() => maxWeekFromCourses(courses), [courses]);
  const currentWeekday = todayWeekday();
  const nextWeekday = currentWeekday === 7 ? 1 : currentWeekday + 1;
  const todayCourses = groupedByWeekday.get(currentWeekday) ?? [];
  const otherDays = weekdays.map((label, index) => ({ day: index + 1, label })).filter((item) => item.day !== currentWeekday);

  useEffect(() => {
    setSelectedDesktopDay(nextWeekday);
    if (!isDesktop) setOpenDay(null);
  }, [nextWeekday, isDesktop]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }


  function exportTimetableCsv() {
    const headers = ["课程名称", "星期", "开始节数", "结束节数", "老师", "地点", "周数"];
    const sorted = [...courses].sort((a, b) => {
      if (a.weekday !== b.weekday) return a.weekday - b.weekday;
      if (a.startSection !== b.startSection) return a.startSection - b.startSection;
      if (a.endSection !== b.endSection) return a.endSection - b.endSection;
      return a.name.localeCompare(b.name, "zh-CN");
    });

    const rows = sorted.map((course) => [
      course.name || "-",
      course.weekday,
      (course.startSection - 1) * 2 + 1,
      course.endSection * 2,
      course.teacher || "-",
      course.location || "-",
      weeksToCsvText(course.weeks),
    ]);

    const csvText = [
      headers.map(csvField).join(","),
      ...rows.map((row) => row.map(csvField).join(",")),
    ].join("\r\n");

    const blob = new Blob([`\uFEFF${csvText}`], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `课表-${term || "unknown"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  function exportTimetableImage() {
    const width = 2200;
    const height = 1280;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const padding = 44;
    const titleH = 118;
    const tableTop = padding + titleH;
    const tableH = height - tableTop - padding;
    const sectionW = 210;
    const dayW = Math.floor((width - padding * 2 - sectionW) / 7);
    const rowH = Math.floor(tableH / 6);

    ctx.fillStyle = "#f3fbff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#16323f";
    ctx.font = "bold 54px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.fillText("WeSDAU-课程表", padding, padding + 58);

    ctx.fillStyle = "#5d7480";
    ctx.font = "32px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.fillText(`${term || "-"}  第${week}周`, padding, padding + 102);

    ctx.fillStyle = "#ffffff";
    drawRoundRect(ctx, padding, tableTop, sectionW + dayW * 7, rowH * 6, 18);
    ctx.fill();
    ctx.strokeStyle = "#cfe2ec";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#eff7fb";
    drawRoundRect(ctx, padding + 2, tableTop + 2, sectionW + dayW * 7 - 4, rowH - 4, 14);
    ctx.fill();

    ctx.strokeStyle = "#d8e8f0";
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 7; i += 1) {
      const x = padding + sectionW + i * dayW;
      ctx.beginPath();
      ctx.moveTo(x, tableTop);
      ctx.lineTo(x, tableTop + rowH * 6);
      ctx.stroke();
    }
    for (let i = 1; i <= 6; i += 1) {
      const y = tableTop + i * rowH;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + sectionW + dayW * 7, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#2f5060";
    ctx.font = "bold 30px 'Microsoft YaHei', 'PingFang SC', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("节次", padding + sectionW / 2, tableTop + rowH / 2);
    weekdays.forEach((day, idx) => {
      const x = padding + sectionW + idx * dayW + dayW / 2;
      ctx.fillText(day, x, tableTop + rowH / 2);
    });

    sectionIndexes.forEach((section, rowIdx) => {
      const y = tableTop + (rowIdx + 1) * rowH + rowH / 2;
      ctx.fillStyle = "#3f5d6a";
      ctx.font = "bold 34px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText(`第${section}大节`, padding + sectionW / 2, y - 16);
      ctx.fillStyle = "#67818e";
      ctx.font = "24px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillText(sectionTimeMap[section], padding + sectionW / 2, y + 22);
    });

    ctx.textAlign = "left";
    for (let day = 1; day <= 7; day += 1) {
      const dayCourses = groupedByWeekday.get(day) ?? [];
      for (let section = 1; section <= 5; section += 1) {
        const slot = coursesForSlot(dayCourses, section);
        if (!slot.length) continue;
        const course = slot[0];
        const x = padding + sectionW + (day - 1) * dayW + 8;
        const y = tableTop + section * rowH + 8;
        const w = dayW - 16;
        const h = rowH - 16;
        const color = courseColorByName(course.name);

        drawRoundRect(ctx, x, y, w, h, 12);
        ctx.fillStyle = color.bg;
        ctx.fill();
        ctx.strokeStyle = color.border;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = color.text;
        const textLeftX = x + 10;
        const maxTextWidth = w - 20;
        const teacher = course.teacher || "待定";
        const loc = `@${course.location || "待定教室"}`;
        let nameFontSize = 24;
        let infoFontSize = 20;
        let nameLineHeight = 30;
        let infoLineHeight = 26;
        let groupGap = 12;
        let nameLines: string[] = [];
        let teacherLines: string[] = [];
        let locLines: string[] = [];

        for (let i = 0; i < 4; i += 1) {
          ctx.font = `bold ${nameFontSize}px 'Microsoft YaHei', 'PingFang SC', sans-serif`;
          nameLines = wrapLines(ctx, course.name, maxTextWidth);
          ctx.font = `${infoFontSize}px 'Microsoft YaHei', 'PingFang SC', sans-serif`;
          teacherLines = wrapLines(ctx, teacher, maxTextWidth);
          locLines = wrapLines(ctx, loc, maxTextWidth);

          const totalHeight =
            nameLines.length * nameLineHeight +
            teacherLines.length * infoLineHeight +
            locLines.length * infoLineHeight +
            groupGap * 2;
          if (totalHeight <= h - 14) break;

          nameFontSize = Math.max(20, nameFontSize - 1);
          infoFontSize = Math.max(16, infoFontSize - 1);
          nameLineHeight = Math.max(24, nameLineHeight - 1);
          infoLineHeight = Math.max(20, infoLineHeight - 1);
          groupGap = Math.max(8, groupGap - 1);
        }

        let cursorY = y + 26;
        ctx.font = `bold ${nameFontSize}px 'Microsoft YaHei', 'PingFang SC', sans-serif`;
        nameLines.forEach((line) => {
          ctx.fillText(line, textLeftX, cursorY);
          cursorY += nameLineHeight;
        });
        cursorY += groupGap;

        ctx.font = `${infoFontSize}px 'Microsoft YaHei', 'PingFang SC', sans-serif`;
        teacherLines.forEach((line) => {
          ctx.fillText(line, textLeftX, cursorY);
          cursorY += infoLineHeight;
        });
        cursorY += groupGap;

        locLines.forEach((line) => {
          ctx.fillText(line, textLeftX, cursorY);
          cursorY += infoLineHeight;
        });
      }
    }

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `课表-${term || "unknown"}-第${week}周.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  if (loading) {
    return <LoadingPanel title="课表加载中" subtitle="正在整理本周课程安排..." rows={6} />;
  }

  return (
    <>
      <section className="glass-card rise-in" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>{"\u4e2a\u4eba\u4fe1\u606f\u53ca\u8bfe\u7a0b\u8868"}</p>
            <h2 style={{ margin: "2px 0 0", fontSize: 20 }}>{term || "\u672a\u8bc6\u522b"}</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>            <div className="export-menu-wrap" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="timetable-icon-btn"
                aria-label="导出课表"
                title="导出课表"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" />
                  <path d="M8 11l4 4 4-4" />
                  <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
              </button>
              {showExportMenu ? (
                <div className="export-menu-panel">
                  <button type="button" onClick={() => { exportTimetableCsv(); setShowExportMenu(false); }}>导出 CSV</button>
                  <button type="button" onClick={() => { exportTimetableImage(); setShowExportMenu(false); }}>导出图片</button>
                </div>
              ) : null}
            </div>
            <button
              onClick={() => loadTimetable({ silent: true })}
              className="timetable-icon-btn"
              aria-label="刷新课表"
              title={refreshing ? "刷新中" : "刷新"}
              disabled={refreshing}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>
            <button
              onClick={logout}
              className="timetable-icon-btn"
              aria-label="\u9000\u51FA\u767B\u5F55"
              title="\u9000\u51FA"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
              </svg>
            </button>
          </div>
        </div>

        {profile ? (
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)", lineHeight: 1.5, display: "grid", gap: 2, gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr" }}>
            <div>{profile.displayName}</div>
            <div>{"\u73ed\u7ea7\uff1a"}{profile.className || "-"}</div>
            <div>{"\u4e13\u4e1a\uff1a"}{profile.major || "-"}</div>
            <div>{"\u5b66\u9662\uff1a"}{profile.college || "-"}</div>
          </div>
        ) : null}

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <div className="timetable-week-switch">
            <button onClick={() => setWeek((v) => Math.max(1, v - 1))} style={chipBtn}>{"\u4e0a\u4e00\u5468"}</button>
            <div className="timetable-week-badge">{"\u7b2c"}{week}{"\u5468"}</div>
            <button onClick={() => setWeek((v) => Math.min(maxWeek, v + 1))} style={chipBtn}>{"\u4e0b\u4e00\u5468"}</button>
          </div>

          <div className="timetable-action-row">
            <button onClick={() => router.push("/community")} style={chipBtn}>{"\u8BA8\u8BBA\u533A"}</button>
            <button onClick={() => router.push("/training-plan")} style={primaryBtn}>{"\u57F9\u517B\u65B9\u6848"}</button>
            <button
              onClick={async () => {
                await fetchChangelog(false);
                setShowChangelog(true);
              }}
              style={chipBtn}
              disabled={checkingChangelog}
            >
              {checkingChangelog ? "\u8BFB\u53D6\u4E2D..." : "\u66F4\u65B0\u65E5\u5FD7"}
            </button>
          </div>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      {isDesktop ? (
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="glass-card rise-in" style={{ padding: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>{"\u4eca\u65e5\u8bfe\u8868\uff08"}{weekdays[currentWeekday - 1]}{"\uff09"}</h3>
            <div style={{ marginTop: 10 }}><DayPanel day={currentWeekday} dayCourses={todayCourses} sectionTimeMap={sectionTimeMap} onCourseClick={setSelected} /></div>
          </div>
          <div className="glass-card rise-in" style={{ padding: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>{"\u5176\u4ed6\u65e5\u671f\u8bfe\u8868"}</h3>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {otherDays.map(({ day, label }) => {
                const active = selectedDesktopDay === day;
                return (
                  <button key={label} onClick={() => setSelectedDesktopDay(day)} style={{ border: "1px solid #c8dce5", borderRadius: 999, background: active ? "#0d8e7f" : "white", color: active ? "white" : "var(--ink)", padding: "6px 12px", fontSize: 13 }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 12 }}>
              <DayPanel day={selectedDesktopDay} dayCourses={groupedByWeekday.get(selectedDesktopDay) ?? []} sectionTimeMap={sectionTimeMap} onCourseClick={setSelected} />
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="glass-card rise-in" style={{ padding: 14, marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>{"\u4eca\u65e5\u8bfe\u8868\uff08"}{weekdays[currentWeekday - 1]}{"\uff09"}</h3>
            <div style={{ marginTop: 10 }}><DayPanel day={currentWeekday} dayCourses={todayCourses} sectionTimeMap={sectionTimeMap} onCourseClick={setSelected} /></div>
          </section>

          <section style={{ display: "grid", gap: 10 }}>
            {otherDays.map(({ day, label }) => {
              const dayCourses = groupedByWeekday.get(day) ?? [];
              const expanded = openDay === day;
              return (
                <article key={label} className="glass-card rise-in" data-expand-state={expanded ? "open" : "closed"} style={{ padding: 12 }}>
                  <button type="button" onClick={() => setOpenDay((prev) => (prev === day ? null : day))} style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", padding: 0, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                    {label}
                    <ChevronIcon expanded={expanded} color="var(--muted)" style={{ float: "right" }} />
                  </button>
                  {expanded ? <div style={{ marginTop: 10 }}><DayPanel day={day} dayCourses={dayCourses} sectionTimeMap={sectionTimeMap} onCourseClick={setSelected} /></div> : null}
                </article>
              );
            })}
          </section>

        </>
      )}

      <BottomNav active="timetable" />
      {selected ? (
        <div role="button" tabIndex={0} onClick={() => setSelected(null)} onKeyDown={(event) => { if (event.key === "Escape") setSelected(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "grid", placeItems: "center", padding: 16, zIndex: 1250 }}>
          <div className="glass-card" style={{ width: "100%", maxWidth: 420, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>{selected.name}</h3>
            <p style={detailText}>{"\u4efb\u8bfe\u6559\u5e08\uff1a"}{selected.teacher || "\u5f85\u5b9a"}</p>
            <p style={{ ...detailText, fontWeight: 700 }}>{"\u4e0a\u8bfe\u6559\u5ba4\uff1a"}{selected.location || "\u5f85\u5b9a"}</p>
            <p style={detailText}>{"\u8282\u6b21\uff1a"}{sectionRangeText(selected.startSection, selected.endSection, sectionTimeMap)}</p>
            <p style={detailText}>{"\u5468\u6b21\uff1a"}{formatWeeks(selected.weeks)}</p>
          </div>
        </div>
      ) : null}
      {showChangelog ? (
        <div className="update-mask" role="button" tabIndex={0} onClick={closeChangelog} onKeyDown={(event) => { if (event.key === "Escape") closeChangelog(); }}>
          <div className="update-modal" onClick={(event) => event.stopPropagation()}>
            <div className="update-modal-glow" />
            <p className="update-kicker">WeSDAU · 更新日志</p>
            <div className="update-modal-header">
              <h3>{changelog?.title || "更新日志"}</h3>
              <span className="update-version">{changelog?.version || "-"}</span>
            </div>
            <p className="update-time">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v4l3 2" />
              </svg>
              {changelog?.publishedAt || "发布时间未提供"}
            </p>
            <div className="update-content">
              {changelog?.items && changelog.items.length > 0 ? (
                <ul className="update-list">
                  {changelog.items.map((item, idx) => (
                    <li key={`${item}-${idx}`}>
                      <span className="update-list-index">{idx + 1}</span>
                      <span className="update-list-text">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>暂无更新内容</p>
              )}
            </div>
                        {changelog?.history && changelog.history.length > 0 ? (
              <div className="update-history-wrap">
                <button
                  className={`update-history-toggle ${showHistory ? "open" : ""}`}
                  onClick={() => setShowHistory((v) => !v)}
                >
                  历史版本
                  <ChevronIcon expanded={showHistory} color="currentColor" />
                </button>
                <div className={`update-history-panel ${showHistory ? "open" : ""}`}>
                  {changelog.history.map((entry) => (
                    <article key={`${entry.version}-${entry.publishedAt || ""}`} className="update-history-item">
                      <div className="update-history-head">
                        <p>{entry.title || "更新日志"}</p>
                        <span>{entry.version}</span>
                      </div>
                      <p className="update-history-time">{entry.publishedAt || "-"}</p>
                      {entry.items && entry.items.length > 0 ? (
                        <ul>
                          {entry.items.map((item, idx) => (
                            <li key={`${entry.version}-${idx}`}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="update-history-empty">暂无详细内容</p>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ) : null}            <button className="update-close-btn" onClick={closeChangelog}>知道了</button>
          </div>
        </div>
      ) : null}
    </>
  );
}


const chipBtn: CSSProperties = {
  border: "1px solid #c8dce5",
  borderRadius: 999,
  background: "white",
  padding: "8px 12px",
  fontSize: 13,
  color: "#21414d",
  whiteSpace: "nowrap",
};

const primaryBtn: CSSProperties = {
  border: "1px solid #1ea08f",
  borderRadius: 999,
  background: "linear-gradient(120deg, #0d8e7f, #15af8c)",
  color: "#ffffff",
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 700,
  whiteSpace: "nowrap",
};


const detailText: CSSProperties = {
  margin: "6px 0",
  color: "var(--ink)",
  fontSize: 14,
};












































































