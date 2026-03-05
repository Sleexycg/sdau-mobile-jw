"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BottomNav } from "@/components/bottom-nav";
import type { CampusName, EmptyRoomItem, EmptyRoomResponse, EmptyRoomQuery, SectionCode } from "@/types/empty-room";

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

const weekdayOptions: Array<{ value: EmptyRoomQuery["weekday"]; label: string }> = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 7, label: "周日" },
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
const weekdayNameMap = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function roomGroupName(campus: CampusName, roomName: string): string {
  if (campus === "岱宗校区") {
    if (roomName.startsWith("5N")) return "5N教室";
    if (roomName.startsWith("5S")) return "5S教室";
    if (roomName.startsWith("北校12号楼")) return "12号楼";
    return "其他区域";
  }

  if (campus === "泮河校区") {
    return roomName.startsWith("19#") ? "东南片区" : "中央片区";
  }

  if (campus === "西北片区") {
    if (roomName.startsWith("21#")) return "21号楼";
    if (roomName.startsWith("22#")) return "22号楼";
    return "其他区域";
  }

  return "其他区域";
}

function roomGroupOrder(campus: CampusName): string[] {
  if (campus === "岱宗校区") return ["5N教室", "5S教室", "12号楼", "其他区域"];
  if (campus === "泮河校区") return ["东南片区", "中央片区"];
  if (campus === "西北片区") return ["21号楼", "22号楼", "其他区域"];
  return ["其他区域"];
}

function getTodayWeekday(): EmptyRoomQuery["weekday"] {
  const day = new Date().getDay();
  return (day === 0 ? 7 : day) as EmptyRoomQuery["weekday"];
}

function buildCurrentLabel(termWeek: { term: string; week: number } | null, todayWeekday: EmptyRoomQuery["weekday"]): string {
  const todayLabel = weekdayNameMap[todayWeekday - 1];
  if (termWeek) {
    return `${termWeek.term} 第${termWeek.week}周 ${todayLabel}`;
  }
  return `加载中... ${todayLabel}`;
}

export function EmptyRoomsClient() {
  const router = useRouter();
  const todayWeekday = useMemo(() => getTodayWeekday(), []);
  const [query, setQuery] = useState<EmptyRoomQuery>({
    weekday: todayWeekday,
    sectionCode: "0102",
    campus: "岱宗校区",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rooms, setRooms] = useState<EmptyRoomItem[]>([]);
  const [termWeek, setTermWeek] = useState<{ term: string; week: number } | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const groupedRooms = useMemo(() => {
    const map = new Map<string, EmptyRoomItem[]>();
    for (const item of rooms) {
      const key = roomGroupName(query.campus, item.roomName);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }

    const order = roomGroupOrder(query.campus);
    return order
      .filter((key) => map.has(key))
      .map((key) => [key, map.get(key) ?? []] as const);
  }, [rooms, query.campus]);

  useEffect(() => {
    if (groupedRooms.length === 0) {
      setOpenGroups({});
      return;
    }

    const next: Record<string, boolean> = {};
    groupedRooms.forEach(([groupName], index) => {
      next[groupName] = openGroups[groupName] ?? index === 0;
    });
    setOpenGroups(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedRooms.length, query.campus]);

  useEffect(() => {
    const loadContext = async () => {
      try {
        const response = await fetch("/api/empty-rooms/context", { cache: "no-store" });
        const result = (await response.json()) as
          | { ok: true; data: { term: string; week: number } }
          | { ok: false; code: string };
        if (result.ok) {
          setTermWeek(result.data);
        }
      } catch {
        // ignore context load errors; user can still query manually
      }
    };

    loadContext();
  }, []);

  async function onSearch() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/empty-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      <section className="glass-card rise-in" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>空教室查询</p>
            <h2 style={{ margin: "2px 0 0", fontSize: 20 }}>{buildCurrentLabel(termWeek, todayWeekday)}</h2>
          </div>
          <button onClick={logout} style={smallBtn}>
            退出
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <label style={labelStyle}>
            校区
            <select
              value={query.campus}
              onChange={(e) => {
                setQuery((q) => ({ ...q, campus: e.target.value as CampusName }));
                setRooms([]);
                setError("");
                setOpenGroups({});
              }}
              style={selectStyle}
            >
              {campusOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            星期几
            <select
              value={String(query.weekday)}
              onChange={(e) => setQuery((q) => ({ ...q, weekday: Number(e.target.value) as EmptyRoomQuery["weekday"] }))}
              style={selectStyle}
            >
              {weekdayOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            节次
            <select
              value={query.sectionCode}
              onChange={(e) => setQuery((q) => ({ ...q, sectionCode: e.target.value as SectionCode }))}
              style={selectStyle}
            >
              {sectionOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <button onClick={onSearch} disabled={loading} style={{ ...smallBtn, width: "100%" }}>
            {loading ? "查询中..." : "查询空教室"}
          </button>
        </div>
      </section>

      {error ? <p className="error-text">{error}</p> : null}

      <section className="glass-card rise-in" style={{ padding: 14 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>空教室（{rooms.length} 间）</h3>

        {rooms.length === 0 ? (
          <div style={{ borderRadius: 12, background: "#f7fcff", padding: 12, fontSize: 14, color: "var(--muted)" }}>
            当前条件下暂无空教室。
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {groupedRooms.map(([groupName, list]) => (
              <section key={groupName} style={{ borderRadius: 12, background: "#f7fcff", padding: 10 }}>
                <button
                  type="button"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }))}
                  style={{ width: "100%", border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer" }}
                >
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
                    {groupName}（{list.length} 间）
                    <span style={{ float: "right" }}>{openGroups[groupName] ? "收起" : "展开"}</span>
                  </p>
                </button>

                <div
                  style={{
                    display: "grid",
                    gap: 6,
                    marginTop: 8,
                    overflow: "hidden",
                    maxHeight: openGroups[groupName] ? 1200 : 0,
                    opacity: openGroups[groupName] ? 1 : 0,
                    transform: openGroups[groupName] ? "translateY(0)" : "translateY(-4px)",
                    transition: "max-height 280ms ease, opacity 220ms ease, transform 220ms ease",
                  }}
                >
                  {list.map((item, index) => (
                    <article key={item.id} style={{ borderRadius: 10, background: "white", padding: "8px 10px" }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>
                        {index + 1}. {item.roomName}
                      </span>
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

const selectStyle = {
  border: "1px solid #c8dce5",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  background: "white",
} as const;

const smallBtn = {
  border: "1px solid #c8dce5",
  borderRadius: 10,
  background: "white",
  padding: "8px 12px",
  fontSize: 12,
} as const;

