"use client";

import { useEffect, useMemo, useState } from "react";

import type { GroupMemberTimetable } from "@/types/group-timetable";
import type { TimetableCourse } from "@/types/timetable";

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

type GridCellItem = { member: GroupMemberTimetable; course: TimetableCourse };

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

function getCourseTimeRange(course: {
  startSection: number;
  endSection: number;
  startTime?: string;
  endTime?: string;
}): string {
  const start = (course.startTime || "").trim();
  const end = (course.endTime || "").trim();
  if (start && end) return `${start}-${end}`;
  return sectionTimeRange(course.startSection, course.endSection);
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

function getSemesterStartDate(input: string): Date | null {
  const parsed = parseSemesterStart(input);
  if (!parsed) return null;

  const now = new Date();
  const year = now.getFullYear();
  const candidateCurrent = new Date(year, parsed.month - 1, parsed.day);
  const candidatePrev = new Date(year - 1, parsed.month - 1, parsed.day);
  return candidateCurrent <= now ? candidateCurrent : candidatePrev;
}

function getAcademicWeekFromSemesterStart(input: string): number | null {
  const startDate = getSemesterStartDate(input);
  if (!startDate) return null;

  const now = new Date();
  const diffDays = Math.floor((now.getTime() - startDate.getTime()) / 86400000);
  return Math.max(1, Math.floor(diffDays / 7) + 1);
}

function getWeekOffsetBetweenStarts(baseStart: Date, memberStart: Date): number {
  const diffDays = Math.round((memberStart.getTime() - baseStart.getTime()) / 86400000);
  return Math.round(diffDays / 7);
}

function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekDaysByReference(
  referenceStart: Date | null,
  displayWeek: number,
  currentWeek: number,
): Array<{ label: string; dateText: string; isToday: boolean }> {
  const now = new Date();
  let monday: Date;

  if (referenceStart) {
    monday = new Date(referenceStart);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(referenceStart.getDate() + (displayWeek - 1) * 7);
  } else {
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() + diffToMonday + (displayWeek - currentWeek) * 7);
  }

  return weekdays.map((label, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    return {
      label,
      dateText: `${d.getMonth() + 1}/${d.getDate()}`,
      isToday: d.toDateString() === now.toDateString(),
    };
  });
}

function resolveMemberWeek(baseWeek: number, member: GroupMemberTimetable, referenceStart: Date | null): number {
  if (!referenceStart || !member.semesterStart) return baseWeek;
  const memberStart = getSemesterStartDate(member.semesterStart);
  if (!memberStart) return baseWeek;
  const offset = getWeekOffsetBetweenStarts(referenceStart, memberStart);
  return baseWeek - offset;
}

function buildGrid(
  members: GroupMemberTimetable[],
  baseWeek: number,
  referenceStart: Date | null,
): GridCellItem[][][] {
  return sections.map((section) =>
    weekdays.map((_, idx) => {
      const day = idx + 1;
      return members.flatMap((member) => {
        const memberWeek = resolveMemberWeek(baseWeek, member, referenceStart);
        if (memberWeek < 1) return [];

        return member.courses
          .filter(
            (c) =>
              c.weekday === day &&
              c.startSection <= section &&
              c.endSection >= section &&
              c.weeks.includes(memberWeek),
          )
          .map((course) => ({ member, course }));
      });
    }),
  );
}

export function GroupTimetableClient() {
  const [nickname, setNickname] = useState("");
  const [shareText, setShareText] = useState("");
  const [semesterStart, setSemesterStart] = useState("");
  const [members, setMembers] = useState<GroupMemberTimetable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [exportMemberId, setExportMemberId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GroupMemberTimetable | null>(null);
  const [cloudNicknames, setCloudNicknames] = useState<string[]>([]);
  const [cloudNickname, setCloudNickname] = useState("");
  const [cloudPickerOpen, setCloudPickerOpen] = useState(false);
  const [exportPickerOpen, setExportPickerOpen] = useState(false);

  const localStorageKey = "wesdau_group_members";

  const selectedReferenceMember = useMemo(
    () => members.find((m) => m.id === exportMemberId) || null,
    [members, exportMemberId],
  );

  const semesterStartForWeek = useMemo(() => {
    const input = semesterStart.trim();
    if (parseSemesterStart(input)) return input;
    const fromMembers = members.find((m) => m.semesterStart && parseSemesterStart(m.semesterStart))?.semesterStart;
    return fromMembers ?? "";
  }, [semesterStart, members]);

  const referenceSemesterStart = useMemo(() => {
    if (selectedReferenceMember?.semesterStart && parseSemesterStart(selectedReferenceMember.semesterStart)) {
      return selectedReferenceMember.semesterStart;
    }
    const input = semesterStart.trim();
    if (parseSemesterStart(input)) return input;
    return semesterStartForWeek;
  }, [selectedReferenceMember, semesterStart, semesterStartForWeek]);

  const referenceStartDate = useMemo(
    () => (referenceSemesterStart ? getSemesterStartDate(referenceSemesterStart) : null),
    [referenceSemesterStart],
  );

  const currentWeek = useMemo(() => {
    const academicWeek = referenceSemesterStart
      ? getAcademicWeekFromSemesterStart(referenceSemesterStart)
      : null;
    return academicWeek ?? getIsoWeek(new Date());
  }, [referenceSemesterStart]);

  async function loadStoredMembers(): Promise<GroupMemberTimetable[]> {
    const res = await fetch("/api/group-timetable/members", { cache: "no-store" });
    const json = (await res.json()) as { ok: boolean; data?: GroupMemberTimetable[]; message?: string };
    if (!json.ok) throw new Error(json.message || "读取云端课程表失败");
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
    const res = await fetch(`/api/group-timetable/members?nickname=${encodeURIComponent(key)}`, {
      cache: "no-store",
    });
    const json = (await res.json()) as { ok: boolean; data?: GroupMemberTimetable };
    if (!json.ok) return null;
    return json.data ?? null;
  }

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(localStorageKey);
      if (!cached) return;
      const parsed = JSON.parse(cached) as GroupMemberTimetable[];
      if (Array.isArray(parsed)) setMembers(parsed);
    } catch {
      // ignore local cache parse error
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(localStorageKey, JSON.stringify(members));
    } catch {
      // ignore local cache write error
    }
  }, [members]);

  const maxWeek = useMemo(() => {
    const all = members.flatMap((m) => m.courses.flatMap((c) => c.weeks));
    return all.length > 0 ? Math.max(...all) : currentWeek;
  }, [members, currentWeek]);

  useEffect(() => {
    if (selectedWeek !== null) return;
    setSelectedWeek(Math.max(1, Math.min(maxWeek, currentWeek)));
  }, [selectedWeek, maxWeek, currentWeek]);

  useEffect(() => {
    setSelectedWeek(null);
  }, [referenceSemesterStart]);

  useEffect(() => {
    if (selectedWeek === null) return;
    if (selectedWeek > maxWeek) setSelectedWeek(maxWeek);
    if (selectedWeek < 1) setSelectedWeek(1);
  }, [selectedWeek, maxWeek]);

  useEffect(() => {
    if (!exportMemberId) return;
    if (!members.some((m) => m.id === exportMemberId)) {
      setExportMemberId("");
    }
  }, [members, exportMemberId]);

  const week = selectedWeek ?? Math.max(1, Math.min(maxWeek, currentWeek));

  const weekDays = useMemo(
    () => getWeekDaysByReference(referenceStartDate, week, currentWeek),
    [referenceStartDate, week, currentWeek],
  );

  const grid = useMemo(() => buildGrid(members, week, referenceStartDate), [members, week, referenceStartDate]);

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

  function removeMemberLocal(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  async function removeMemberCloud(id: string) {
    const target = members.find((m) => m.id === id);
    if (!target) return;
    try {
      await fetch(`/api/group-timetable/members?nickname=${encodeURIComponent(target.nickname)}`, { method: "DELETE" });
    } catch {
      setError("删除云端失败");
    }
  }

  async function toggleCloudPicker() {
    setError("");
    if (cloudPickerOpen) {
      setCloudPickerOpen(false);
      return;
    }

    try {
      const list = await loadStoredMembers();
      const names = Array.from(new Set(list.map((m) => m.nickname).filter(Boolean)));
      setCloudNicknames(names);
      if (!names.includes(cloudNickname)) setCloudNickname(names[0] ?? "");
      setCloudPickerOpen(true);
    } catch {
      setError("获取云端昵称列表失败");
    }
  }

  async function pullFromCloudByNickname() {
    if (!cloudNickname) {
      setError("请先在列表中选择昵称");
      return;
    }
    setError("");
    try {
      const found = await pullByNickname(cloudNickname);
      if (!found) {
        setError("云端未找到该昵称的课程表");
        return;
      }
      setMembers((prev) => [found, ...prev.filter((m) => m.nickname !== found.nickname)]);
      if (found.semesterStart) setSemesterStart(found.semesterStart);
      setCloudPickerOpen(false);
    } catch {
      setError("拉取云端课程表失败");
    }
  }

  function exportImage(mode: "week" | "today" = "week") {
    const selectedMember = selectedReferenceMember;
    if (!selectedMember) {
      setError("请先选择参考用户，再导出课表");
      return;
    }

    const exportMembers = members;
    const selectedMemberStart = selectedMember.semesterStart
      ? getSemesterStartDate(selectedMember.semesterStart)
      : null;
    const exportWeek = Math.max(1, Math.min(maxWeek, week));
    const exportWeekDays = getWeekDaysByReference(selectedMemberStart, exportWeek, currentWeek);
    const exportGrid = buildGrid(exportMembers, exportWeek, selectedMemberStart);

    const todayIndex = (new Date().getDay() + 6) % 7;
    const canChooseToday = exportMembers.length >= 4;
    const onlyToday = canChooseToday && mode === "today";
    const dayIndices = onlyToday ? [todayIndex] : [0, 1, 2, 3, 4, 5, 6];
    const visibleWeekDays = dayIndices.map((idx) => exportWeekDays[idx]);
    const visibleGrid = exportGrid.map((row) => dayIndices.map((idx) => row[idx]));
    const colCount = visibleWeekDays.length;

    const width = onlyToday ? 960 : 2200;
    const height = 1400;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const padding = 44;
    const titleH = 120;
    const tableTop = padding + titleH;
    const tableH = height - tableTop - padding;
    const leftW = 150;
    const colW = Math.floor((width - padding * 2 - leftW) / colCount);
    const rowH = Math.floor(tableH / 6);

    ctx.fillStyle = "#f4faff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#173746";
    ctx.font = "bold 54px 'Microsoft YaHei', sans-serif";
    ctx.fillText("群友课程表总览", padding, padding + 56);
    ctx.fillStyle = "#56707d";
    ctx.font = "20px 'Microsoft YaHei', sans-serif";
    const sub = `第${exportWeek}周 | 参考：${selectedMember.nickname}`;
    ctx.fillText(sub, padding, padding + 88);
    ctx.fillText(`成员数：${exportMembers.length}`, padding, padding + 112);

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#cfe2ec";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(padding, tableTop, leftW + colW * colCount, rowH * 6, 18);
    ctx.fill();
    ctx.stroke();

    for (let c = 0; c <= colCount; c += 1) {
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
      ctx.lineTo(padding + leftW + colW * colCount, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#2f5060";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 24px 'Microsoft YaHei', sans-serif";
    ctx.fillText("节次", padding + leftW / 2, tableTop + rowH / 2);
    visibleWeekDays.forEach((d, i) => {
      const cx = padding + leftW + i * colW + colW / 2;
      ctx.fillText(d.label, cx, tableTop + rowH / 2 - 10);
      ctx.font = "20px 'Microsoft YaHei', sans-serif";
      ctx.fillText(d.dateText, cx, tableTop + rowH / 2 + 18);
      ctx.font = "bold 24px 'Microsoft YaHei', sans-serif";
    });

    ctx.font = "bold 24px 'Microsoft YaHei', sans-serif";
    sections.forEach((s, i) => {
      ctx.fillText(`第${s}大节`, padding + leftW / 2, tableTop + (i + 1) * rowH + rowH / 2);
    });

    ctx.textAlign = "left";
    visibleGrid.forEach((row, rowIndex) => {
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

          const timeText = getCourseTimeRange(course);
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
    a.download = `群友课程表-第${exportWeek}周.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleExportClick() {
    if (members.length >= 4) {
      setExportPickerOpen(true);
      return;
    }
    exportImage("week");
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
            placeholder="群友昵称（用于本地保存）"
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid #c8dce5", borderRadius: 10, padding: "12px 12px", fontSize: 14, minHeight: 44 }}
          />

          <input
            value={semesterStart}
            onChange={(e) => setSemesterStart(e.target.value)}
            placeholder="学期开始日期（M/D，例如 3/2）"
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid #c8dce5", borderRadius: 10, padding: "12px 12px", fontSize: 14, minHeight: 44 }}
          />

          <textarea
            value={shareText}
            onChange={(e) => setShareText(e.target.value)}
            placeholder="粘贴 WakeUp 分享文案（含口令）"
            rows={4}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #c8dce5",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 13,
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-start" }}>
            <button
              onClick={importWakeup}
              disabled={loading}
              style={{ border: 0, borderRadius: 999, padding: "8px 12px", background: "#0d8e7f", color: "#fff", minHeight: 38,
              flexShrink: 1, minWidth: 108 }}
            >
              {loading ? "导入中..." : "WakeUp导入"}
            </button>
            <button
              onClick={toggleCloudPicker}
              style={{
                border: "1px solid #c8dce5",
                borderRadius: 999,
                padding: "8px 12px",
                background: "#fff",
                color: "#21414d",
                minHeight: 38,
              flexShrink: 1,
                minWidth: 108,
              }}
            >
              按昵称导入
            </button>
          </div>

          {cloudPickerOpen ? (
            <div
              style={{
                marginTop: 4,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                border: "1px solid #d8e5ec",
                borderRadius: 12,
                background: "#f8fcff",
                padding: 10,
              }}
            >
              <select
                value={cloudNickname}
                onChange={(e) => setCloudNickname(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid #c8dce5",
                  borderRadius: 8,
                  background: "#fff",
                  color: "#21414d",
                  fontSize: 13,
                  padding: "8px 10px",
                  minHeight: 38,
              flexShrink: 1,
                }}
              >
                {cloudNicknames.length === 0 ? <option value="">暂无可选昵称</option> : null}
                {cloudNicknames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                onClick={pullFromCloudByNickname}
                disabled={!cloudNickname}
                style={{
                  border: 0,
                  borderRadius: 999,
                  padding: "8px 12px",
                  background: cloudNickname ? "#0d8e7f" : "#9fb8c3",
                  color: "#fff",
                  minHeight: 38,
              flexShrink: 1,
                  minWidth: 92,
                }}
              >
                确认导入
              </button>
            </div>
          ) : null}
        </div>

        {error ? <p style={{ margin: "10px 0 0", color: "#c44141", fontSize: 13 }}>{error}</p> : null}
      </div>

      <div className="glass-card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: 6, flexWrap: "nowrap", width: "100%", minWidth: 0 }}>
          <select
            value={exportMemberId}
            onChange={(e) => setExportMemberId(e.target.value)}
            style={{
              width: "clamp(120px, 46vw, 180px)",
              maxWidth: "46vw",
              boxSizing: "border-box",
              border: "1px solid #c8dce5",
              borderRadius: 8,
              background: "#fff",
              color: "#21414d",
              fontSize: 13,
              padding: "8px 10px",
              minHeight: 38,
              flexShrink: 1,
            }}
          >
            <option value="" disabled>
              参考用户（必选）
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                参考用户：{m.nickname}
              </option>
            ))}
          </select>

          <select
            value={week}
            onChange={(e) => setSelectedWeek(Number.parseInt(e.target.value, 10))}
            style={{
              width: "clamp(76px, 24vw, 120px)",
              maxWidth: "24vw",
              boxSizing: "border-box",
              border: "1px solid #c8dce5",
              borderRadius: 8,
              background: "#fff",
              color: "#21414d",
              fontSize: 13,
              padding: "8px 10px",
              minHeight: 38,
              flexShrink: 1,
            }}
          >
            {Array.from({ length: Math.max(1, maxWeek) }, (_, idx) => idx + 1).map((wk) => (
              <option key={wk} value={wk}>
                第{wk}周
              </option>
            ))}
          </select>

          <button
            onClick={handleExportClick}
            style={{ border: 0, borderRadius: 999, background: "#0d8e7f", color: "#fff", padding: "8px 10px", minHeight: 38, minWidth: 64, flexShrink: 0 }}
          >
            导出
          </button>
        </div>

        {members.length > 0 ? (
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>已导入成员</h3>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  border: "1px solid #d8e5ec",
                  borderRadius: 12,
                  background: "#fff",
                  padding: "8px 10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 12, color: "#1f3d63" }}>{m.nickname} · {m.courses.length}门</div>
                <button
                  onClick={() => setDeleteTarget(m)}
                  style={{
                    border: "1px solid #c8dce5",
                    borderRadius: 999,
                    background: "#fff",
                    padding: "8px 12px",
                    fontSize: 13,
                    color: "#21414d",
                    minHeight: 38,
                    minWidth: 96,
                  }}
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {exportPickerOpen ? (
        <div
          onClick={() => setExportPickerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.28)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 1190,
            padding: "8px 8px calc(8px + env(safe-area-inset-bottom))",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              borderRadius: "16px 16px 0 0",
              background: "#fff",
              border: "1px solid #d8e5ec",
              boxShadow: "0 20px 48px rgba(13,38,59,0.16)",
              padding: 14,
              maxHeight: "82vh",
              overflowY: "auto",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 14, color: "#21414d" }}>选择导出范围</div>
            <button
              onClick={() => {
                exportImage("week");
                setExportPickerOpen(false);
              }}
              style={{ border: "1px solid #c8dce5", borderRadius: 12, background: "#fff", minHeight: 40, fontSize: 13 }}
            >
              导出本周
            </button>
            <button
              onClick={() => {
                exportImage("today");
                setExportPickerOpen(false);
              }}
              style={{ border: "1px solid #c8dce5", borderRadius: 12, background: "#fff", minHeight: 40, fontSize: 13 }}
            >
              导出当天
            </button>
            <button
              onClick={() => setExportPickerOpen(false)}
              style={{ border: "1px solid #e1e8ee", borderRadius: 12, background: "#f7fafc", minHeight: 38,
              flexShrink: 1, fontSize: 13 }}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          onClick={() => setDeleteTarget(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.28)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 1200,
            padding: "8px 8px calc(8px + env(safe-area-inset-bottom))",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              borderRadius: "16px 16px 0 0",
              background: "#fff",
              border: "1px solid #d8e5ec",
              boxShadow: "0 20px 48px rgba(13,38,59,0.16)",
              padding: 14,
              maxHeight: "82vh",
              overflowY: "auto",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 14, color: "#21414d" }}>删除成员：{deleteTarget.nickname}</div>
            <button
              onClick={() => {
                removeMemberLocal(deleteTarget.id);
                setDeleteTarget(null);
              }}
              style={{ border: "1px solid #c8dce5", borderRadius: 12, background: "#fff", minHeight: 40, fontSize: 13 }}
            >
              删除本地
            </button>
            <button
              onClick={async () => {
                await removeMemberCloud(deleteTarget.id);
                setDeleteTarget(null);
              }}
              style={{ border: "1px solid #f2c7c7", borderRadius: 12, background: "#fff6f6", color: "#b33a3a", minHeight: 40, fontSize: 13 }}
            >
              删除云端
            </button>
            <button
              onClick={() => setDeleteTarget(null)}
              style={{ border: "1px solid #e1e8ee", borderRadius: 12, background: "#f7fafc", minHeight: 38,
              flexShrink: 1, fontSize: 13 }}
            >
              取消
            </button>
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














































