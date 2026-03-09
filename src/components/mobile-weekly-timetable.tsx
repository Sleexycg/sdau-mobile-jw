"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { LoadingPanel } from "@/components/loading-panel";
import type { TimetableCourse, TimetableResponse } from "@/types/timetable";

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

interface WeekContextResponse {
  ok: boolean;
  data?: { week?: number };
}

const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const sections = [{ idx: 1 }, { idx: 2 }, { idx: 3 }, { idx: 4 }, { idx: 5 }];

function getMonday(base: Date): Date {
  const d = new Date(base);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function cloneWithOffset(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function maxWeekFromCourses(courses: TimetableCourse[]): number {
  return courses.reduce((max, course) => Math.max(max, ...course.weeks), 1);
}

function normalizeWeeklyCourses(courses: TimetableCourse[]): TimetableCourse[] {
  const grouped = new Map<number, TimetableCourse[]>();
  for (const course of courses) {
    const arr = grouped.get(course.weekday) ?? [];
    arr.push(course);
    grouped.set(course.weekday, arr);
  }

  const merged: TimetableCourse[] = [];
  for (const [, dayCourses] of grouped) {
    const sorted = [...dayCourses].sort((a, b) => a.startSection - b.startSection || a.endSection - b.endSection);
    const stack: TimetableCourse[] = [];

    for (const current of sorted) {
      const last = stack[stack.length - 1];
      if (!last) {
        stack.push({ ...current, weeks: [...current.weeks] });
        continue;
      }

      const lastWeeks = [...last.weeks].sort((a, b) => a - b);
      const currentWeeks = [...current.weeks].sort((a, b) => a - b);
      const sameWeeks = lastWeeks.length === currentWeeks.length && lastWeeks.every((w, idx) => w === currentWeeks[idx]);
      const sameIdentity =
        last.weekday === current.weekday &&
        last.name === current.name &&
        (last.teacher || "") === (current.teacher || "") &&
        (last.location || "") === (current.location || "") &&
        (last.term || "") === (current.term || "") &&
        sameWeeks;

      if (sameIdentity && current.startSection <= last.endSection + 1) {
        last.endSection = Math.max(last.endSection, current.endSection);
      } else {
        stack.push({ ...current, weeks: [...current.weeks] });
      }
    }

    merged.push(...stack);
  }

  return merged;
}

function findCourseForCell(courses: TimetableCourse[], weekday: number, section: number): TimetableCourse | null {
  return (
    courses.find(
      (course) =>
        course.weekday === weekday &&
        section >= course.startSection &&
        section <= course.endSection,
    ) ?? null
  );
}

function compactName(name: string): [string, string] {
  const plain = (name || "").trim();
  if (!plain) return ["-", ""];
  const first = plain.slice(0, 3);
  const remain = plain.slice(3);
  if (!remain) return [first, ""];
  if (plain.length <= 5) return [first, remain];
  return [first, `${plain.slice(3, 5)}...`];
}

function compactLocation(location: string): [string, string] {
  const raw = (location || "").trim();
  if (!raw) return ["@待定", ""];

  const inParen = raw.match(/[（(]([^（）()]+)[）)]/);
  if (inParen?.[1]) {
    const token = inParen[1].trim();
    if (token) return [`@${token}`, ""];
  }

  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return [`@${raw}`, ""];
  return [`@${parts[0]}`, parts.slice(1).join(" ")];
}

function weekRangeText(weeks: number[]): string {
  if (!weeks.length) return "-";
  const sorted = [...new Set(weeks)].sort((a, b) => a - b);
  return `${sorted[0]}-${sorted[sorted.length - 1]}周`;
}

function smallSectionRange(start: number, end: number): string {
  const s = (start - 1) * 2 + 1;
  const e = end * 2;
  return `${s}-${e}`;
}

function detailLocation(location: string): string {
  const raw = (location || "").trim();
  if (!raw) return "待定";
  const inParen = raw.match(/[（(]([^（）()]+)[）)]/);
  if (!inParen?.[1]) return raw;
  const room = inParen[1].trim();
  const prefix = raw.replace(/[（(][^（）()]+[）)]/, "").trim();
  if (!prefix) return room;
  return `${prefix}-${room}`;
}

function colorFromCourse(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 37 + name.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return {
    bg: `hsl(${hue} 88% 95%)`,
    border: `hsl(${hue} 52% 72%)`,
    text: `hsl(${hue} 52% 23%)`,
  };
}

interface MobileWeeklyTimetableProps {
  mode?: "page" | "modal";
  onClose?: () => void;
}

export function MobileWeeklyTimetable({ mode = "page", onClose }: MobileWeeklyTimetableProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [term, setTerm] = useState("");
  const [courses, setCourses] = useState<TimetableCourse[]>([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [week, setWeek] = useState(1);
  const [selected, setSelected] = useState<TimetableCourse | null>(null);

  const maxWeek = useMemo(() => maxWeekFromCourses(courses), [courses]);

  const handleBack = () => {
    if (mode === "modal") {
      onClose?.();
      return;
    }
    router.back();
  };

  async function loadData(mode: "normal" | "refresh" = "normal") {
    if (mode === "normal") setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const [tbRes, ctxRes] = await Promise.all([
        fetch("/api/timetable", { cache: "no-store" }),
        fetch("/api/empty-rooms/context", { cache: "no-store" }),
      ]);
      const tbJson = (await tbRes.json()) as ApiResult;
      if (!tbJson.ok) {
        if (tbJson.code === "UNAUTHORIZED") {
          router.replace("/login");
          return;
        }
        setError(tbJson.message || "课表加载失败");
        return;
      }

      const ctxJson = (await ctxRes.json()) as WeekContextResponse;
      const ctxWeek = Number(ctxJson?.data?.week ?? 1);
      const resolvedCurrentWeek = Number.isFinite(ctxWeek) && ctxWeek > 0 ? ctxWeek : 1;
      const resolvedMaxWeek = maxWeekFromCourses(tbJson.data.courses || []);

      setTerm(tbJson.data.term);
      setCourses(tbJson.data.courses || []);
      setCurrentWeek(resolvedCurrentWeek);
      setWeek(Math.max(1, Math.min(resolvedMaxWeek, resolvedCurrentWeek)));
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      if (mode === "normal") setLoading(false);
      else setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData("normal");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monday = useMemo(() => {
    const baseMonday = getMonday(new Date());
    const offsetWeeks = week - currentWeek;
    return cloneWithOffset(baseMonday, offsetWeeks * 7);
  }, [week, currentWeek]);

  const inWeekCourses = useMemo(
    () => normalizeWeeklyCourses(courses.filter((course) => course.weeks.includes(week))),
    [courses, week],
  );

  if (loading) {
    return <LoadingPanel title="周课表加载中" subtitle="正在整理每周课程信息..." rows={6} />;
  }

  return (
    <>
      <section className="glass-card rise-in weekly-mobile-shell">
        <header className="weekly-mobile-head">
          <button className="weekly-mobile-back" onClick={handleBack} aria-label="返回">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="weekly-mobile-term">{term || "-"}</div>
        </header>

        {error ? <p className="error-text" style={{ marginTop: 8 }}>{error}</p> : null}

        <div className="weekly-mobile-grid-wrap">
          <table className="weekly-mobile-grid">
            <thead>
              <tr>
                <th className="section-head"><span className="section-week-no">{week}</span></th>
                {weekdays.map((day, idx) => {
                  const date = cloneWithOffset(monday, idx);
                  return (
                    <th key={day}>
                      <div className="weekday-title">{day}</div>
                      <div className="weekday-date">{date.getMonth() + 1}/{date.getDate()}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <tr key={section.idx}>
                  <td className="section-col">
                    <div className="section-no">{section.idx}</div>
                  </td>
                  {weekdays.map((_, dayIndex) => {
                    const day = dayIndex + 1;
                    const course = findCourseForCell(inWeekCourses, day, section.idx);

                    if (!course) {
                      return <td key={`${section.idx}-${day}`} className="course-cell empty" />;
                    }

                    if (section.idx > course.startSection) {
                      return null;
                    }

                    const rowSpan = Math.max(1, course.endSection - course.startSection + 1);
                    const [n1, n2] = compactName(course.name);
                    const [l1, l2] = compactLocation(course.location);
                    const color = colorFromCourse(course.name);

                    return (
                      <td key={`${section.idx}-${day}`} className="course-cell" rowSpan={rowSpan}>
                        <button
                          className="course-cell-btn"
                          onClick={() => setSelected(course)}
                          style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}
                        >
                          <span className="course-name-line">{n1}</span>
                          {n2 ? <span className="course-name-line">{n2}</span> : null}
                          <span className="course-location-line">{l1}</span>
                          {l2 ? <span className="course-location-line">{l2}</span> : null}
                          <span className="course-teacher-line">{course.teacher || "待定"}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="weekly-mobile-actions">
          <button onClick={() => setWeek((v) => Math.max(1, v - 1))} aria-label="上一周" title="上一周">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button onClick={() => loadData("refresh")} disabled={refreshing} aria-label="刷新" title={refreshing ? "刷新中" : "刷新"}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
          </button>
          <button onClick={() => setWeek((v) => Math.min(maxWeek, v + 1))} aria-label="下一周" title="下一周">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </section>

      {selected ? (
        <div className="weekly-detail-mask" role="button" tabIndex={0} onClick={() => setSelected(null)} onKeyDown={(event) => { if (event.key === "Escape") setSelected(null); }}>
          <section className="weekly-detail-modal" onClick={(event) => event.stopPropagation()}>
            <header className="weekly-detail-head">
              <h3>{selected.name}</h3>
              <button className="weekly-detail-close" onClick={() => setSelected(null)} aria-label="关闭" title="关闭">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </header>
            <div className="weekly-detail-grid">
              <div className="weekly-detail-item">
                <span>上课地点</span>
                <strong>{detailLocation(selected.location)}</strong>
              </div>
              <div className="weekly-detail-item">
                <span>节次与周次</span>
                <strong>{smallSectionRange(selected.startSection, selected.endSection)} ｜ {weekRangeText(selected.weeks)}</strong>
              </div>
              <div className="weekly-detail-item">
                <span>任课教师</span>
                <strong>{selected.teacher || "待定"}</strong>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}












