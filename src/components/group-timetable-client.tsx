"use client";

import { useEffect, useMemo, useState } from "react";

import type { GroupMemberTimetable } from "@/types/group-timetable";

type ImportApiResult =
  | { ok: true; data: GroupMemberTimetable }
  | { ok: false; code: string; message: string };

const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const sections = [1, 2, 3, 4, 5] as const;
const sectionTimeMap: Record<number, string> = {
  1: "08:00-09:40",
  2: "10:00-11:40",
  3: "14:00-15:40",
  4: "16:00-17:40",
  5: "19:00-20:40",
};

function toColor(seed: string) {
  const colors = ["#eaf4ff", "#ecfff4", "#fff6ea", "#f3eeff", "#ffeff3", "#eef9fb"];
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
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
    if (lines.length >= maxLines) break;
  }

  if (lines.length < maxLines && current) lines.push(current);

  if (lines.length === maxLines && chars.join("") !== lines.join("")) {
    const ellipsis = "…";
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}${ellipsis}`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last}${ellipsis}`;
  }

  return lines.slice(0, maxLines);
}

function sectionTimeRange(startSection: number, endSection: number): string {
  const start = sectionTimeMap[startSection] || "";
  const end = sectionTimeMap[endSection] || "";
  if (!start && !end) return "";
  if (startSection === endSection) return start || end;
  const startPart = start.split("-")[0] || "";
  const endPart = end.split("-")[1] || "";
  if (startPart && endPart) return `${startPart}-${endPart}`;
  return start || end;
}


function parseSemesterStart(input: string): { month: number; day: number } | null {
  const value = input.trim();
  const match = value.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const month = Number.parseInt(match[1], 10);
  const day = Number.parseInt(match[2], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

function getAcademicWeekFromSemesterStart(input: string): number | null {
  const parsed = parseSemesterStart(input);
  if (!parsed) return null;

  const now = new Date();
  const year = now.getFullYear();
  const candidateCurrent = new Date(year, parsed.month - 1, parsed.day);
  const candidatePrev = new Date(year - 1, parsed.month - 1, parsed.day);
  const startDate = candidateCurrent <= now ? candidateCurrent : candidatePrev;

  const diffDays = Math.floor((now.getTime() - startDate.getTime()) / 86400000);
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}
function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekDaysByWeekOffset(weekOffset: number, enableTodayHighlight: boolean) {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diffToMonday + weekOffset * 7);

  return weekdays.map((label, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const isToday = enableTodayHighlight && d.toDateString() === now.toDateString();
    return { label, isToday };
  });
}

export function GroupTimetableClient() {
  const [nickname, setNickname] = useState("");
  const [shareText, setShareText] = useState("");
  const [semesterStart, setSemesterStart] = useState("");
  const [members, setMembers] = useState<GroupMemberTimetable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [exportMemberId, setExportMemberId] = useState("__all__");

  const semesterStartForWeek = useMemo(() => {
    const input = semesterStart.trim();
    if (parseSemesterStart(input)) return input;
    const fromMembers = members.find((m) => m.semesterStart && parseSemesterStart(m.semesterStart))?.semesterStart;
    return fromMembers ?? "";
  }, [semesterStart, members]);

  const currentWeek = useMemo(() => {
    const academicWeek = semesterStartForWeek ? getAcademicWeekFromSemesterStart(semesterStartForWeek) : null;
    return academicWeek ?? getIsoWeek(new Date());
  }, [semesterStartForWeek]);


  async function loadStoredMembers(): Promise<GroupMemberTimetable[]> {
    const res = await fetch("/api/group-timetable/members", { cache: "no-store" });
    const json = (await res.json()) as { ok: boolean; data?: GroupMemberTimetable[]; message?: string };
    if (!json.ok) throw new Error(json.message || "读取本地课程表失败");
    return json.data || [];
  }

  async function saveMember(member: GroupMemberTimetable): Promise<GroupMemberTimetable> {
    const res = await fetch("/api/group-timetable/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member }),
    });
    const json = (await res.json()) as { ok: boolean; data?: GroupMemberTimetable; message?: string };
    if (!json.ok || !json.data) throw new Error(json.message || "保存本地课程表失败");
    return json.data;
  }

  async function pullByNickname(targetNickname: string): Promise<GroupMemberTimetable | null> {
    const key = targetNickname.trim();
    if (!key) return null;
    const res = await fetch(`/api/group-timetable/members?nickname=${encodeURIComponent(key)}`, { cache: "no-store" });
    const json = (await res.json()) as { ok: boolean; data?: GroupMemberTimetable };
    if (!json.ok) return null;
    return json.data ?? null;
  }

  useEffect(() => {
    loadStoredMembers()
      .then((list) => setMembers(list))
      .catch((e) => setError(e instanceof Error ? e.message : "读取本地课程表失败"))
      .finally(() => setMembersLoaded(true));
  }, []);

  const maxWeek = useMemo(() => {
    const all = members.flatMap((m) => m.courses.flatMap((c) => c.weeks));
    return all.length > 0 ? Math.max(...all) : currentWeek;
  }, [members, currentWeek]);

  useEffect(() => {
    if (!membersLoaded || selectedWeek !== null) return;
    setSelectedWeek(Math.max(1, Math.min(maxWeek, currentWeek)));
  }, [membersLoaded, selectedWeek, maxWeek, currentWeek]);

  useEffect(() => {
    setSelectedWeek(null);
  }, [semesterStartForWeek]);

  useEffect(() => {
    if (selectedWeek === null) return;
    if (selectedWeek > maxWeek) setSelectedWeek(maxWeek);
    if (selectedWeek < 1) setSelectedWeek(1);
  }, [selectedWeek, maxWeek]);


  useEffect(() => {
    if (exportMemberId === "__all__") return;
    if (!members.some((m) => m.id === exportMemberId)) {
      setExportMemberId("__all__");
    }
  }, [members, exportMemberId]);
  const week = selectedWeek ?? Math.max(1, Math.min(maxWeek, currentWeek));
  const weekDays = useMemo(
    () => getWeekDaysByWeekOffset(week - currentWeek, week === currentWeek),
    [week, currentWeek],
  );

  const grid = useMemo(() => {
    return sections.map((section) => {
      return weekdays.map((_, idx) => {
        const day = idx + 1;
        return members.flatMap((member) =>
          member.courses
            .filter(
              (c) =>
                c.weekday === day &&
                c.startSection <= section &&
                c.endSection >= section &&
                c.weeks.includes(week),
            )
            .map((c) => ({ member, course: c })),
        );
      });
    });
  }, [members, week]);

  async function importWakeup() {
    const normalizedStart = semesterStart.trim();
    if (normalizedStart && !parseSemesterStart(normalizedStart)) {
      setError("学期开始日期格式错误，请使用 M/D，例如 3/2");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/group-timetable/import-wakeup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), text: shareText, semesterStart: semesterStart.trim() }),
      });
      const result = (await response.json()) as ImportApiResult;
      if (!result.ok) {
        setError(result.message || "导入失败");
        return;
      }

      const saved = await saveMember(result.data);
      setMembers((prev) => [saved, ...prev.filter((m) => m.nickname !== saved.nickname)]);
      if (saved.semesterStart) setSemesterStart(saved.semesterStart);
      setShareText("");
    } catch {
      setError("网络异常，导入失败");
    } finally {
      setLoading(false);
    }
  }

  function removeMember(id: string) {
    const target = members.find((m) => m.id === id);
    if (!target) return;
    fetch(`/api/group-timetable/members?nickname=${encodeURIComponent(target.nickname)}`, { method: "DELETE" })
      .finally(() => setMembers((prev) => prev.filter((m) => m.id !== id)));
  }

  async function pullFromLocalByNickname() {
    const key = nickname.trim();
    if (!key) {
      setError("请输入昵称");
      return;
    }
    setError("");
    try {
      const found = await pullByNickname(key);
      if (!found) {
        setError("本地未找到该昵称的课程表");
        return;
      }
      setMembers((prev) => [found, ...prev.filter((m) => m.nickname !== found.nickname)]);
      if (found.semesterStart) setSemesterStart(found.semesterStart);
    } catch {
      setError("拉取本地课程表失败");
    }
  }

  function exportImage() {
    const selectedMember = exportMemberId === "__all__" ? null : members.find((m) => m.id === exportMemberId) || null;
    const exportMembers = selectedMember ? [selectedMember] : members;

    const userWeek =
      selectedMember?.semesterStart && parseSemesterStart(selectedMember.semesterStart)
        ? getAcademicWeekFromSemesterStart(selectedMember.semesterStart)
        : null;
    const exportWeek = Math.max(1, Math.min(maxWeek, userWeek ?? week));
    const exportWeekDays = getWeekDaysByWeekOffset(exportWeek - currentWeek, exportWeek === currentWeek);

    const exportGrid = sections.map((section) => {
      return weekdays.map((_, idx) => {
        const day = idx + 1;
        return exportMembers.flatMap((member) =>
          member.courses
            .filter(
              (c) =>
                c.weekday === day &&
                c.startSection <= section &&
                c.endSection >= section &&
                c.weeks.includes(exportWeek),
            )
            .map((c) => ({ member, course: c })),
        );
      });
    });

    const width = 2200;
    const height = 1400;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const padding = 44;
    const titleH = 110;
    const tableTop = padding + titleH;
    const tableH = height - tableTop - padding;
    const leftW = 150;
    const colW = Math.floor((width - padding * 2 - leftW) / 7);
    const rowH = Math.floor(tableH / 6);

    ctx.fillStyle = "#f4faff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#173746";
    ctx.font = "bold 54px 'Microsoft YaHei', sans-serif";
    const titleTarget = selectedMember ? `${selectedMember.nickname}课表` : "群友课程表总览";
    ctx.fillText(`${titleTarget}（第${exportWeek}周）`, padding, padding + 58);
    ctx.fillStyle = "#56707d";
    ctx.font = "28px 'Microsoft YaHei', sans-serif";
    ctx.fillText(`成员数：${exportMembers.length}`, padding, padding + 98);

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#cfe2ec";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(padding, tableTop, leftW + colW * 7, rowH * 6, 18);
    ctx.fill();
    ctx.stroke();

    for (let c = 0; c <= 7; c += 1) {
      const x = padding + leftW + c * colW;
      ctx.beginPath();
      ctx.moveTo(x, tableTop);
      ctx.lineTo(x, tableTop + rowH * 6);
      ctx.stroke();
    }
    for (let r = 1; r <= 6; r += 1) {
      const y = tableTop + r * rowH;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + leftW + colW * 7, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#2f5060";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 24px 'Microsoft YaHei', sans-serif";
    ctx.fillText("节次", padding + leftW / 2, tableTop + rowH / 2);
    exportWeekDays.forEach((d, i) => {
      const cx = padding + leftW + i * colW + colW / 2;
      ctx.fillText(d.label, cx, tableTop + rowH / 2);
    });

    ctx.font = "bold 24px 'Microsoft YaHei', sans-serif";
    sections.forEach((s, i) => {
      ctx.fillText(`第${s}大节`, padding + leftW / 2, tableTop + (i + 1) * rowH + rowH / 2);
    });

    ctx.textAlign = "left";
    exportGrid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell.length === 0) return;

        const x = padding + leftW + colIndex * colW + 8;
        const y = tableTop + (rowIndex + 1) * rowH + 8;
        const w = colW - 16;
        const h = rowH - 16;

        const cardGap = 6;
        const cardHeight = 54;
        const maxCards = Math.max(1, Math.floor((h - 4 + cardGap) / (cardHeight + cardGap)));
        const show = cell.slice(0, maxCards);

        show.forEach(({ member, course }, idx) => {
          const top = y + 2 + idx * (cardHeight + cardGap);
          ctx.fillStyle = toColor(course.name);
          ctx.beginPath();
          ctx.roundRect(x, top, w, cardHeight, 8);
          ctx.fill();
          ctx.strokeStyle = "#c9dce8";
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = "#1f3d63";
          ctx.font = "bold 13px 'Microsoft YaHei', sans-serif";
          const nickLines = wrapCanvasText(ctx, member.nickname, w - 12, 1);
          if (nickLines[0]) {
            ctx.fillText(nickLines[0], x + 6, top + 15);
          }

          const timeText = sectionTimeRange(course.startSection, course.endSection);
          const courseText = `${course.name}${timeText ? `（${timeText}）` : ""}`;
          ctx.font = "12px 'Microsoft YaHei', sans-serif";
          const courseLines = wrapCanvasText(ctx, courseText, w - 12, 2);
          let textY = top + 31;
          courseLines.forEach((line) => {
            ctx.fillText(line, x + 6, textY);
            textY += 14;
          });
        });

        if (cell.length > maxCards) {
          ctx.fillStyle = "#6b7f89";
          ctx.font = "14px 'Microsoft YaHei', sans-serif";
          ctx.fillText(`+${cell.length - maxCards}项`, x + 6, y + h - 8);
        }
      });
    });

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    const filenameTarget = selectedMember ? selectedMember.nickname : "群友课程表";
    a.download = `${filenameTarget}-第${exportWeek}周.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div className="glass-card" style={{ padding: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>群友共享课程表</h2>
        <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
          支持粘贴 WakeUp 分享文案导入，并按昵称保存到本地
        </p>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="群友昵称（用于本地保存/拉取）"
            style={{ border: "1px solid #c8dce5", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
          />

          <input
            value={semesterStart}
            onChange={(e) => setSemesterStart(e.target.value)}
            placeholder="学期开始日期（M/D，例如 3/2）"
            style={{ border: "1px solid #c8dce5", borderRadius: 10, padding: "10px 12px", fontSize: 14 }}
          />

          <textarea
            value={shareText}
            onChange={(e) => setShareText(e.target.value)}
            placeholder="粘贴 WakeUp 分享文案（含口令）"
            rows={4}
            style={{ border: "1px solid #c8dce5", borderRadius: 10, padding: "10px 12px", fontSize: 13, resize: "vertical" }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={importWakeup} disabled={loading} style={{ border: 0, borderRadius: 999, padding: "8px 14px", background: "#0d8e7f", color: "#fff" }}>
              {loading ? "导入中..." : "WakeUp导入"}
            </button>
            <button onClick={pullFromLocalByNickname} style={{ border: "1px solid #c8dce5", borderRadius: 999, padding: "8px 14px", background: "#fff", color: "#21414d" }}>
              按昵称本地拉取
            </button>
          </div>
        </div>

        {error ? <p style={{ margin: "10px 0 0", color: "#c44141", fontSize: 13 }}>{error}</p> : null}
      </div>

      <div className="glass-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select
            value={exportMemberId}
            onChange={(e) => setExportMemberId(e.target.value)}
            style={{
              border: "1px solid #c8dce5",
              borderRadius: 8,
              background: "#fff",
              color: "#21414d",
              fontSize: 13,
              padding: "8px 10px",
              minWidth: 150,
            }}
          >
            <option value="__all__">导出对象：全部成员</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                导出对象：{m.nickname}
              </option>
            ))}
          </select>

          <button onClick={exportImage} style={{ border: 0, borderRadius: 999, background: "#0d8e7f", color: "#fff", padding: "8px 14px" }}>
            导出汇总图片
          </button>
        </div>

        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ color: "#5d7480", fontSize: 13 }}>当前展示周：</span>
          <select
            value={week}
            onChange={(e) => setSelectedWeek(Number.parseInt(e.target.value, 10))}
            style={{
              border: "1px solid #c8dce5",
              borderRadius: 8,
              background: "#fff",
              color: "#21414d",
              fontSize: 13,
              padding: "6px 10px",
            }}
          >
            {Array.from({ length: Math.max(1, maxWeek) }, (_, idx) => idx + 1).map((wk) => (
              <option key={wk} value={wk}>
                第{wk}周
              </option>
            ))}
          </select>
          <button
            onClick={() => setSelectedWeek(Math.max(1, Math.min(maxWeek, currentWeek)))}
            style={{
              border: "1px solid #c8dce5",
              borderRadius: 999,
              background: "#fff",
              color: "#21414d",
              fontSize: 12,
              padding: "6px 10px",
            }}
          >
            回到当前周
          </button>
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead>
              <tr>
                <th style={thStyle}>节次</th>
                {weekDays.map((day) => (
                  <th key={day.label} style={{ ...thStyle, color: day.isToday ? "#0d8e7f" : "#2f5060" }}>
                    <div>{day.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((section, rowIndex) => (
                <tr key={section}>
                  <td style={tdTitleStyle}>第{section}大节</td>
                  {weekdays.map((_, colIndex) => {
                    const cell = grid[rowIndex][colIndex];
                    return (
                      <td key={`${section}-${colIndex}`} style={tdStyle}>
                        {cell.length === 0 ? <span style={{ color: "#9aafb8", fontSize: 12 }}>空</span> : (
                          <div style={{ display: "grid", gap: 6 }}>
                            {cell.map(({ member, course }, idx) => (
                              <div key={`${member.id}-${course.id}-${idx}`} style={{ background: toColor(course.name), border: "1px solid #d2e2ea", borderRadius: 8, padding: "6px 8px" }}>
                                <div style={{ fontSize: 12, fontWeight: 700 }}>{member.nickname}</div>
                                <div style={{ fontSize: 12 }}>{course.name}（{sectionTimeRange(course.startSection, course.endSection)}）</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {members.length > 0 ? (
        <div className="glass-card" style={{ padding: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>已导入成员</h3>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {members.map((m) => (
              <button key={m.id} onClick={() => removeMember(m.id)} style={{ border: "1px solid #c8dce5", borderRadius: 999, background: "#fff", padding: "6px 12px", fontSize: 12 }}>
                {m.nickname} · {m.courses.length}门（点我删除）
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

const thStyle: React.CSSProperties = {
  border: "1px solid #dbe8ef",
  background: "#f1f8fc",
  padding: "8px 6px",
  fontSize: 13,
};

const tdTitleStyle: React.CSSProperties = {
  border: "1px solid #dbe8ef",
  textAlign: "center",
  fontSize: 12,
  color: "#2e4f5b",
  width: 88,
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #dbe8ef",
  padding: 6,
  verticalAlign: "top",
  minWidth: 120,
};




























