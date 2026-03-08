"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import { ChevronIcon } from "@/components/chevron-icon";
import type { CampusName, EmptyRoomItem, EmptyRoomQuery, EmptyRoomResponse, SectionCode } from "@/types/empty-room";

interface ApiError {
  ok: false;
  code: string;
  message: string;
}

interface ApiSuccess {
  ok: true;
  data: EmptyRoomResponse;
}

type ApiResult = ApiError | ApiSuccess;
type OpenField = "campus" | "weekday" | "section" | null;

const weekdayOptions: Array<{ value: EmptyRoomQuery["weekday"]; label: string }> = [
  { value: 1, label: "星期一" },
  { value: 2, label: "星期二" },
  { value: 3, label: "星期三" },
  { value: 4, label: "星期四" },
  { value: 5, label: "星期五" },
  { value: 6, label: "星期六" },
  { value: 7, label: "星期日" },
];

const sectionOptions: Array<{ value: SectionCode; label: string }> = [
  { value: "0102", label: "第一大节（01-02）" },
  { value: "0304", label: "第二大节（03-04）" },
  { value: "中午", label: "中午" },
  { value: "0506", label: "第三大节（05-06）" },
  { value: "0708", label: "第四大节（07-08）" },
  { value: "0910", label: "第五大节（09-10）" },
  { value: "晚间", label: "晚间" },
];

const campusOptions: CampusName[] = ["岱宗校区", "泮河校区", "西北片区"];
const weekdayNameMap = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];

function roomGroupName(campus: CampusName, roomName: string): string {
  if (campus === "岱宗校区") {
    if (roomName.startsWith("5N")) return "5N教室";
    if (roomName.startsWith("5S")) return "5S教室";
    if (roomName.startsWith("北校12号楼")) return "12号楼";
    return "其他教室";
  }
  if (campus === "泮河校区") {
    return roomName.startsWith("19#") ? "东南片区" : "中央片区";
  }
  if (campus === "西北片区") {
    if (roomName.startsWith("21#")) return "21号楼";
    if (roomName.startsWith("22#")) return "22号楼";
    return "其他教室";
  }
  return "其他教室";
}

function roomGroupOrder(campus: CampusName): string[] {
  if (campus === "岱宗校区") return ["5N教室", "5S教室", "12号楼", "其他教室"];
  if (campus === "泮河校区") return ["中央片区", "东南片区"];
  if (campus === "西北片区") return ["21号楼", "22号楼", "其他教室"];
  return ["其他教室"];
}

function getTodayWeekday(): EmptyRoomQuery["weekday"] {
  const day = new Date().getDay();
  return (day === 0 ? 7 : day) as EmptyRoomQuery["weekday"];
}

function buildCurrentLabel(termWeek: { term: string; week: number } | null, todayWeekday: EmptyRoomQuery["weekday"]): string {
  const todayLabel = weekdayNameMap[todayWeekday - 1];
  if (termWeek) return `${termWeek.term} 第${termWeek.week}周 ${todayLabel}`;
  return `当前学期周次加载中... ${todayLabel}`;
}

export function EmptyRoomsClient() {
  const router = useRouter();
  const dropdownRootRef = useRef<HTMLDivElement | null>(null);

  const todayWeekday = useMemo(() => getTodayWeekday(), []);
  const [query, setQuery] = useState<EmptyRoomQuery>({ weekday: todayWeekday, sectionCode: "0102", campus: "岱宗校区" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rooms, setRooms] = useState<EmptyRoomItem[]>([]);
  const [termWeek, setTermWeek] = useState<{ term: string; week: number } | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [openField, setOpenField] = useState<OpenField>(null);

  const weekdayLabel = weekdayOptions.find((i) => i.value === query.weekday)?.label ?? "星期一";
  const sectionLabel = sectionOptions.find((i) => i.value === query.sectionCode)?.label ?? "第一大节（01-02）";

  const groupedRooms = useMemo(() => {
    const map = new Map<string, EmptyRoomItem[]>();
    for (const item of rooms) {
      const key = roomGroupName(query.campus, item.roomName);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    const order = roomGroupOrder(query.campus);
    return order.filter((k) => map.has(k)).map((k) => [k, map.get(k) ?? []] as const);
  }, [rooms, query.campus]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const [name] of groupedRooms) next[name] = openGroups[name] ?? true;
    setOpenGroups(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedRooms.length, query.campus]);

  useEffect(() => {
    const handle = (event: MouseEvent) => {
      if (dropdownRootRef.current && !dropdownRootRef.current.contains(event.target as Node)) setOpenField(null);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    async function loadContext() {
      try {
        const response = await fetch("/api/empty-rooms/context", { cache: "no-store" });
        const result = (await response.json()) as { ok: boolean; data?: { term: string; week: number } };
        if (result.ok && result.data) setTermWeek({ term: result.data.term, week: result.data.week });
      } catch {
        // ignore
      }
    }
    loadContext();
  }, []);

  function clearResults() {
    setRooms([]);
    setError("");
  }

  async function onSearch() {
    setLoading(true);
    setError("");
    setOpenField(null);
    try {
      const response = await fetch("/api/empty-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(query),
      });
      const result = (await response.json()) as ApiResult;
      if (!result.ok) {
        if (result.code === "UNAUTHORIZED") {
          router.replace("/login");
          return;
        }
        setError(result.message || "查询失败");
        return;
      }
      setTermWeek({ term: result.data.term, week: result.data.week });
      setRooms(result.data.rooms);
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <section className="glass-card rise-in" style={{ padding: 16, marginBottom: 14, position: "relative", zIndex: 50 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>空教室查询</p>
            <h2 style={{ margin: "2px 0 0", fontSize: 20 }}>{buildCurrentLabel(termWeek, todayWeekday)}</h2>
          </div>
          <button onClick={logout} className="timetable-icon-btn" aria-label="退出登录" title="退出">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
            </svg>
          </button>
        </div>

        <div ref={dropdownRootRef} style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <label style={labelStyle}>校区
            <div className="inline-select-wrap">
              <button type="button" className="inline-select-trigger" onClick={() => setOpenField((v) => (v === "campus" ? null : "campus"))}>
                <span>{query.campus}</span>
                <ChevronIcon expanded={openField === "campus"} className="inline-select-arrow" />
              </button>
              <div className={`inline-select-panel ${openField === "campus" ? "open" : ""}`}>
                {campusOptions.map((item) => (
                  <button key={item} type="button" className={`inline-select-option ${item === query.campus ? "active" : ""}`} onClick={() => { setQuery((q) => ({ ...q, campus: item })); clearResults(); setOpenField(null); }}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </label>

          <label style={labelStyle}>星期
            <div className="inline-select-wrap">
              <button type="button" className="inline-select-trigger" onClick={() => setOpenField((v) => (v === "weekday" ? null : "weekday"))}>
                <span>{weekdayLabel}</span>
                <ChevronIcon expanded={openField === "weekday"} className="inline-select-arrow" />
              </button>
              <div className={`inline-select-panel ${openField === "weekday" ? "open" : ""}`}>
                {weekdayOptions.map((item) => (
                  <button key={item.value} type="button" className={`inline-select-option ${item.value === query.weekday ? "active" : ""}`} onClick={() => { setQuery((q) => ({ ...q, weekday: item.value })); clearResults(); setOpenField(null); }}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </label>

          <label style={labelStyle}>节次
            <div className="inline-select-wrap">
              <button type="button" className="inline-select-trigger" onClick={() => setOpenField((v) => (v === "section" ? null : "section"))}>
                <span>{sectionLabel}</span>
                <ChevronIcon expanded={openField === "section"} className="inline-select-arrow" />
              </button>
              <div className={`inline-select-panel ${openField === "section" ? "open" : ""}`}>
                {sectionOptions.map((item) => (
                  <button key={item.value} type="button" className={`inline-select-option ${item.value === query.sectionCode ? "active" : ""}`} onClick={() => { setQuery((q) => ({ ...q, sectionCode: item.value })); clearResults(); setOpenField(null); }}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </label>

          <button onClick={onSearch} disabled={loading} style={{ ...smallBtn, width: "100%" }}>{loading ? "查询中..." : "查询空教室"}</button>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="glass-card rise-in" style={{ padding: 14 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>空教室（{rooms.length} 间）</h3>

        {rooms.length === 0 ? (
          <div style={{ borderRadius: 12, background: "#f7fcff", padding: 12, fontSize: 14, color: "var(--muted)" }}>当前条件下暂无空教室。</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {groupedRooms.map(([groupName, list]) => (
              <section key={groupName} data-expand-state={openGroups[groupName] ? "open" : "closed"} style={{ borderRadius: 12, background: "#f7fcff", padding: 10 }}>
                <button type="button" onClick={() => setOpenGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }))} style={{ width: "100%", border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer" }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
                    {groupName}（{list.length} 间）
                    <ChevronIcon expanded={openGroups[groupName]} style={{ float: "right" }} />
                  </p>
                </button>

                <div style={{ display: "grid", gap: 6, marginTop: 8, overflow: "hidden", maxHeight: openGroups[groupName] ? 1200 : 0, opacity: openGroups[groupName] ? 1 : 0, transform: openGroups[groupName] ? "translateY(0)" : "translateY(-4px)", transition: "max-height 460ms ease, opacity 360ms ease, transform 360ms ease" }}>
                  {list.map((item, index) => (
                    <article key={item.id} style={{ borderRadius: 10, background: "white", padding: "8px 10px" }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{index + 1}. {item.roomName}</span>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <BottomNav active="empty-rooms" />
    </>
  );
}

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  color: "var(--muted)",
} as const;

const smallBtn = {
  border: "1px solid #c8dce5",
  borderRadius: 10,
  background: "white",
  padding: "8px 12px",
  fontSize: 13,
  cursor: "pointer",
} as const;
