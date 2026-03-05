"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";

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

const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const sectionIndexes = [1, 2, 3, 4, 5] as const;
const sectionNameMap: Record<number, string> = {
  1: "第一大节",
  2: "第二大节",
  3: "第三大节",
  4: "第四大节",
  5: "第五大节",
};

type SectionTimeMap = Record<number, string>;

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
    return {
      1: "8:00-9:40",
      2: "10:00-11:40",
      3: "14:30-16:10",
      4: "16:30-18:10",
      5: "19:30-21:10",
    };
  }

  return {
    1: "8:00-9:40",
    2: "10:00-11:40",
    3: "14:00-15:40",
    4: "16:00-17:40",
    5: "19:00-20:40",
  };
}

function sectionLabelWithTime(sectionIndex: number, timeMap: SectionTimeMap): string {
  const name = sectionNameMap[sectionIndex] ?? `第${sectionIndex}大节`;
  const time = timeMap[sectionIndex];
  return time ? `${name}（${time}）` : name;
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

  return `${ranges.join(",")}周`;
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

function detectLandscape(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(orientation: landscape)").matches || window.innerWidth > window.innerHeight;
}

function detectDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth >= 1024;
}

interface DayPanelProps {
  day: number;
  label: string;
  dayCourses: TimetableCourse[];
  sectionTimeMap: SectionTimeMap;
  onCourseClick: (course: TimetableCourse) => void;
}

function DayPanel({ day, label, dayCourses, sectionTimeMap, onCourseClick }: DayPanelProps) {
  const weekendAllEmpty = day >= 6 && dayCourses.length === 0;

  if (weekendAllEmpty) {
    return (
      <div style={{ borderRadius: 10, background: "#f7fcff", padding: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>全天无课</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {sectionIndexes.map((sectionIndex) => {
        const slotCourses = coursesForSlot(dayCourses, sectionIndex);
        return (
          <div key={`${label}-${sectionIndex}`} style={{ borderRadius: 10, background: "#f7fcff", padding: 10 }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
              {sectionLabelWithTime(sectionIndex, sectionTimeMap)}
            </p>
            {slotCourses.length === 0 ? (
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>无课</p>
            ) : (
              <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                {slotCourses.map((course) => (
                  <button
                    key={`${course.id}-${sectionIndex}`}
                    onClick={() => onCourseClick(course)}
                    style={{ textAlign: "left", border: 0, borderRadius: 10, background: "#eef8ff", padding: "8px 10px" }}
                  >
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{course.name}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>老师：{course.teacher || "待定"}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--ink)", fontWeight: 700 }}>教室：{course.location || "待定"}</p>
                  </button>
                ))}
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
  const [error, setError] = useState("");
  const [term, setTerm] = useState("");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [week, setWeek] = useState(1);
  const [courses, setCourses] = useState<TimetableCourse[]>([]);
  const [selected, setSelected] = useState<TimetableCourse | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [sectionTimeMap, setSectionTimeMap] = useState<SectionTimeMap>(() => getSectionTimeMap(new Date()));
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [selectedDesktopDay, setSelectedDesktopDay] = useState<number>(todayWeekday() === 7 ? 1 : todayWeekday() + 1);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/timetable", { cache: "no-store" });
        const result = (await response.json()) as ApiResult;

        if (!result.ok) {
          if (result.code === "UNAUTHORIZED") {
            router.replace("/login");
            return;
          }
          setError(result.message || "课表加载失败");
          return;
        }

        if (!active) return;
        setTerm(result.data.term);
        setProfile(result.data.profile);
        setCourses(result.data.courses);
        setWeek(1);
      } catch {
        setError("网络异常，请稍后重试");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    const handleViewportChange = () => {
      setIsLandscape(detectLandscape());
      setIsDesktop(detectDesktop());
    };
    handleViewportChange();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setSectionTimeMap(getSectionTimeMap(new Date())), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

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

  if (loading) {
    return (
      <section className="glass-card rise-in" style={{ padding: 20 }}>
        课表加载中...
      </section>
    );
  }

  return (
    <>
      <section className="glass-card rise-in" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>当前学期</p>
            <h2 style={{ margin: "2px 0 0", fontSize: 20 }}>{term || "未识别"}</h2>
          </div>
          <button onClick={logout} style={{ border: "1px solid #c8dce5", background: "white", borderRadius: 10, padding: "8px 10px" }}>
            退出
          </button>
        </div>

        {profile ? (
          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              color: "var(--muted)",
              lineHeight: 1.5,
              display: "grid",
              gap: 2,
              gridTemplateColumns: isLandscape ? "1fr 1fr" : "1fr",
            }}
          >
            <div>{profile.displayName}</div>
            <div>班级：{profile.className || "-"}</div>
            <div>专业：{profile.major || "-"}</div>
            <div>学院：{profile.college || "-"}</div>
          </div>
        ) : null}

        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setWeek((value) => Math.max(1, value - 1))} style={smallBtn}>
            上一周
          </button>
          <div style={{ fontWeight: 700 }}>第 {week} 周</div>
          <button onClick={() => setWeek((value) => Math.min(maxWeek, value + 1))} style={smallBtn}>
            下一周
          </button>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      {isDesktop ? (
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="glass-card rise-in" style={{ padding: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>今日课表（{weekdays[currentWeekday - 1]}）</h3>
            <div style={{ marginTop: 10 }}>
              <DayPanel
                day={currentWeekday}
                label={weekdays[currentWeekday - 1]}
                dayCourses={todayCourses}
                sectionTimeMap={sectionTimeMap}
                onCourseClick={setSelected}
              />
            </div>
          </div>

          <div className="glass-card rise-in" style={{ padding: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>其他日期课表</h3>
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {otherDays.map(({ day, label }) => {
                const dayCourses = groupedByWeekday.get(day) ?? [];
                const active = selectedDesktopDay === day;
                const hint = day >= 6 && dayCourses.length === 0 ? "（空）" : "";
                return (
                  <button
                    key={label}
                    onClick={() => setSelectedDesktopDay(day)}
                    style={{
                      border: "1px solid #c8dce5",
                      borderRadius: 999,
                      background: active ? "#0d8e7f" : "white",
                      color: active ? "white" : "var(--ink)",
                      padding: "6px 12px",
                      fontSize: 13,
                    }}
                  >
                    {label}
                    {hint}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 12 }}>
              <DayPanel
                day={selectedDesktopDay}
                label={weekdays[selectedDesktopDay - 1]}
                dayCourses={groupedByWeekday.get(selectedDesktopDay) ?? []}
                sectionTimeMap={sectionTimeMap}
                onCourseClick={setSelected}
              />
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="glass-card rise-in" style={{ padding: 14, marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>今日课表（{weekdays[currentWeekday - 1]}）</h3>
            <div style={{ marginTop: 10 }}>
              <DayPanel
                day={currentWeekday}
                label={weekdays[currentWeekday - 1]}
                dayCourses={todayCourses}
                sectionTimeMap={sectionTimeMap}
                onCourseClick={setSelected}
              />
            </div>
          </section>

          <section style={{ display: "grid", gap: 10, gridTemplateColumns: isLandscape ? "repeat(2, minmax(0, 1fr))" : "1fr" }}>
            {otherDays.map(({ day, label }) => {
              const dayCourses = groupedByWeekday.get(day) ?? [];
              const emptyHint = day >= 6 && dayCourses.length === 0 ? " · 全天无课" : "";
              const expanded = openDay === day;

              return (
                <article key={label} className="glass-card rise-in" style={{ padding: 12 }}>
                  <button
                    type="button"
                    onClick={() => setOpenDay((prev) => (prev === day ? null : day))}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: 0,
                      background: "transparent",
                      padding: 0,
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                    {emptyHint}
                    <span style={{ float: "right", color: "var(--muted)", fontWeight: 500 }}>{expanded ? "收起" : "展开"}</span>
                  </button>
                  {expanded ? (
                    <div style={{ marginTop: 10 }}>
                      <DayPanel
                        day={day}
                        label={label}
                        dayCourses={dayCourses}
                        sectionTimeMap={sectionTimeMap}
                        onCourseClick={setSelected}
                      />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        </>
      )}

      <nav className="bottom-nav" aria-label="底部导航">
        <button className="active" type="button">
          课表
        </button>
        <button type="button" onClick={logout}>
          退出登录
        </button>
      </nav>

      {selected ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelected(null)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setSelected(null);
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "grid", placeItems: "center", padding: 16 }}
        >
          <div className="glass-card" style={{ width: "100%", maxWidth: 420, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>{selected.name}</h3>
            <p style={detailText}>任课教师：{selected.teacher || "待定"}</p>
            <p style={{ ...detailText, fontWeight: 700 }}>上课教室：{selected.location || "待定"}</p>
            <p style={detailText}>节次：{sectionRangeText(selected.startSection, selected.endSection, sectionTimeMap)}</p>
            <p style={detailText}>周次：{formatWeeks(selected.weeks)}</p>
            <button onClick={() => setSelected(null)} style={{ ...smallBtn, marginTop: 6 }}>
              关闭
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

const smallBtn: CSSProperties = {
  border: "1px solid #c8dce5",
  borderRadius: 10,
  background: "white",
  padding: "7px 10px",
  fontSize: 12,
};

const detailText: CSSProperties = {
  margin: "6px 0",
  color: "var(--ink)",
  fontSize: 14,
};
