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

const memberColorPalette = ["#D7EBFF", "#D9F7E8", "#FFE6D6", "#E7DCFF", "#FFD9E8", "#D7F5FF", "#FFF2C9", "#E3F6D2"];

function getMemberColorByIndex(index: number): string {
  if (index < memberColorPalette.length) return memberColorPalette[index];
  // Golden-angle hues to keep colors unique when members > 8.
  const hue = Math.round((index * 137.508) % 360);
  return `hsl(${hue} 78% 86%)`;
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
  const [deleteMenuPos, setDeleteMenuPos] = useState<{ top: number; left: number } | null>(null);

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
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-cloud-menu]") || target.closest("[data-export-menu]") || target.closest("[data-delete-menu]")) {
        return;
      }
      setCloudPickerOpen(false);
      setExportPickerOpen(false);
      setDeleteTarget(null);
      setDeleteMenuPos(null);
    };

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

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

  useEffect(() => {
    void refreshCloudNicknames();
  }, [members.length]);

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
    setDeleteTarget(null);
    setDeleteMenuPos(null);
  }

  async function removeMemberCloud(id: string) {
    const target = members.find((m) => m.id === id);
    if (!target) return;
    try {
      const resp = await fetch(`/api/group-timetable/members?nickname=${encodeURIComponent(target.nickname)}`, { method: "DELETE" });
      if (!resp.ok) {
        setError("删除云端失败");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== id));
      setDeleteTarget(null);
      setDeleteMenuPos(null);
    } catch {
      setError("删除云端失败");
    }
  }

  async function refreshCloudNicknames() {
    setError("");
    try {
      const list = await loadStoredMembers();
      const names = Array.from(new Set(list.map((m) => m.nickname).filter(Boolean)));
      setCloudNicknames(names);
      if (names.length > 0 && !names.includes(cloudNickname)) {
        setCloudNickname(names[0]);
      }
      if (names.length === 0) {
        setCloudNickname("");
      }
    } catch {
      setError("获取云端昵称列表失败");
    }
  }


  async function toggleCloudPicker() {
    if (cloudPickerOpen) {
      setCloudPickerOpen(false);
      return;
    }
    await refreshCloudNicknames();
    setCloudPickerOpen(true);
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
    const memberColorMap = new Map<string, string>();
    const memberKeys = Array.from(new Set(exportMembers.map((m) => m.id || m.nickname)));
    memberKeys.forEach((key, idx) => {
      memberColorMap.set(key, getMemberColorByIndex(idx));
    });
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
    const leftW = onlyToday ? 92 : 104;
    const colW = Math.floor((width - padding * 2 - leftW) / colCount);
    const headerH = onlyToday ? 64 : 70;
    const sectionH = Math.floor((tableH - headerH) / 5);
    const tableBottom = tableTop + headerH + sectionH * 5;

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
    ctx.roundRect(padding, tableTop, leftW + colW * colCount, tableBottom - tableTop, 18);
    ctx.fill();
    ctx.stroke();

    for (let c = 0; c <= colCount; c += 1) {
      const x = padding + leftW + c * colW;
      ctx.beginPath();
      ctx.moveTo(x, tableTop);
      ctx.lineTo(x, tableBottom);
      ctx.stroke();
    }
    for (let r = 0; r < 5; r += 1) {
      const y = tableTop + headerH + r * sectionH;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + leftW + colW * colCount, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#2f5060";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 24px 'Microsoft YaHei', sans-serif";
    ctx.fillText("节次", padding + leftW / 2, tableTop + headerH / 2);
    visibleWeekDays.forEach((d, i) => {
      const cx = padding + leftW + i * colW + colW / 2;
      ctx.fillText(d.label, cx, tableTop + headerH / 2 - 9);
      ctx.font = "20px 'Microsoft YaHei', sans-serif";
      ctx.fillText(d.dateText, cx, tableTop + headerH / 2 + 16);
      ctx.font = "bold 24px 'Microsoft YaHei', sans-serif";
    });

    ctx.font = "bold 24px 'Microsoft YaHei', sans-serif";
    sections.forEach((s, i) => {
      ctx.fillText(`第${s}大节`, padding + leftW / 2, tableTop + headerH + i * sectionH + sectionH / 2);
    });

    ctx.textAlign = "left";
    visibleGrid.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (cell.length === 0) return;

        const x = padding + leftW + colIndex * colW + 8;
        const y = tableTop + headerH + rowIndex * sectionH + 8;
        const w = colW - 16;
        const h = sectionH - 16;

        const cardGap = 4;
        const maxCards = 4;
        const orderedCell = [...cell].sort((a, b) => {
          const aLong = [...(a.course.name || "")].length >= 12 ? 1 : 0;
          const bLong = [...(b.course.name || "")].length >= 12 ? 1 : 0;
          return aLong - bLong;
        });
        const show = orderedCell.slice(0, maxCards);
        const availableHeight = Math.max(100, h - 4);
        const cardHeight = Math.max(40, Math.floor((availableHeight - (maxCards - 1) * cardGap) / maxCards));

        show.forEach(({ member, course }, idx) => {
          const top = y + 2 + idx * (cardHeight + cardGap);
          const colorKey = member.id || member.nickname;
          ctx.fillStyle = memberColorMap.get(colorKey) || memberColorPalette[0];
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
          const maxCourseLines = cardHeight >= 46 ? 2 : 1;
          const courseLines = wrapCanvasText(ctx, courseText, w - 12, maxCourseLines);
          let textY = top + 29;
          const textMaxY = top + cardHeight - 6;
          courseLines.forEach((line) => {
            if (textY <= textMaxY) {
              ctx.fillText(line, x + 6, textY);
            }
            textY += 13;
          });
        });

        if (orderedCell.length > maxCards) {
          const extraNames = Array.from(
            new Set(orderedCell.slice(maxCards).map((item) => item.member.nickname)),
          ).join("、");
          if (extraNames) {
            ctx.fillStyle = "#6b7f89";
            ctx.font = "11px 'Microsoft YaHei', sans-serif";
            const extraLines = wrapCanvasText(ctx, extraNames, w - 12, 2);
            let extraY = y + h - 8 - (extraLines.length - 1) * 12;
            extraLines.forEach((line) => {
              ctx.fillText(line, x + 6, extraY);
              extraY += 12;
            });
          }
        }
      });
    });

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    if (onlyToday) {
      const now = new Date();
      a.download = `群友课程表总揽-${now.getMonth() + 1}月${now.getDate()}日.png`;
    } else {
      a.download = `群友课程表-第${exportWeek}周.png`;
    }
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
      <div className="glass-card" style={{ padding: 16, overflow: "visible", position: "relative", zIndex: 1100 }}>
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
            style={{ width: "100%", boxSizing: "border-box", border: "1px solid #c8dce5", borderRadius: 10, padding: "10px 12px", fontSize: 13, resize: "vertical" }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-start" }}>
            <button
              onClick={importWakeup}
              disabled={loading}
              style={{ border: 0, borderRadius: 999, padding: "8px 12px", background: "#0d8e7f", color: "#fff", minHeight: 38, minWidth: 108 }}
            >
              {loading ? "导入中..." : "WakeUp导入"}
            </button>

            <div data-cloud-menu style={{ position: "relative", zIndex: 20000 }}>
              <button
                onClick={toggleCloudPicker}
                style={{ border: "1px solid #c8dce5", borderRadius: 999, padding: "8px 12px", background: "#fff", color: "#21414d", minHeight: 38, minWidth: 108 }}
              >
                按昵称导入
              </button>
              {cloudPickerOpen ? (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, width: "min(320px, calc(100vw - 32px))", border: "1px solid #d8e5ec", borderRadius: 12, background: "#fff", boxShadow: "0 12px 28px rgba(13,38,59,0.16)", padding: 8, display: "grid", gap: 8, zIndex: 99999 }}>
                  <select
                    value={cloudNickname}
                    onChange={(e) => setCloudNickname(e.target.value)}
                    style={{ width: "100%", border: "1px solid #c8dce5", borderRadius: 8, background: "#fff", color: "#21414d", fontSize: 13, padding: "8px 10px", minHeight: 38 }}
                  >
                    <option value="" disabled>
                      选择昵称
                    </option>
                    {cloudNicknames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={pullFromCloudByNickname}
                    disabled={!cloudNickname}
                    style={{ border: 0, borderRadius: 8, background: "#0d8e7f", color: "#fff", minHeight: 36, fontSize: 13 }}
                  >
                    确认导入
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {error ? <p style={{ margin: "10px 0 0", color: "#c44141", fontSize: 13 }}>{error}</p> : null}
      </div>

      <div className="glass-card" style={{ padding: 16, overflow: "visible" }}>
        <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", gap: 6, flexWrap: "nowrap", width: "100%", minWidth: 0 }}>
          <select
            value={exportMemberId}
            onChange={(e) => setExportMemberId(e.target.value)}
            style={{ width: "clamp(120px, 46vw, 180px)", maxWidth: "46vw", boxSizing: "border-box", border: "1px solid #c8dce5", borderRadius: 8, background: "#fff", color: "#21414d", fontSize: 13, padding: "8px 10px", minHeight: 38, flexShrink: 1 }}
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
            style={{ width: "clamp(76px, 24vw, 120px)", maxWidth: "24vw", boxSizing: "border-box", border: "1px solid #c8dce5", borderRadius: 8, background: "#fff", color: "#21414d", fontSize: 13, padding: "8px 10px", minHeight: 38, flexShrink: 1 }}
          >
            {Array.from({ length: Math.max(1, maxWeek) }, (_, idx) => idx + 1).map((wk) => (
              <option key={wk} value={wk}>
                第{wk}周
              </option>
            ))}
          </select>

          <div data-export-menu style={{ position: "relative", zIndex: 19000, flexShrink: 0 }}>
            <button
              onClick={handleExportClick}
              style={{ border: 0, borderRadius: 999, background: "#0d8e7f", color: "#fff", padding: "8px 10px", minHeight: 38, minWidth: 64 }}
            >
              导出
            </button>

            {exportPickerOpen ? (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: 140,
                  border: "1px solid #d8e5ec",
                  borderRadius: 12,
                  background: "#fff",
                  boxShadow: "0 12px 28px rgba(13,38,59,0.16)",
                  padding: 8,
                  display: "grid",
                  gap: 6,
                  zIndex: 20001,
                }}
              >
                <button onClick={() => { exportImage("week"); setExportPickerOpen(false); }} style={{ border: "1px solid #c8dce5", borderRadius: 8, background: "#fff", minHeight: 34, fontSize: 12 }}>导出本周</button>
                <button onClick={() => { exportImage("today"); setExportPickerOpen(false); }} style={{ border: "1px solid #c8dce5", borderRadius: 8, background: "#fff", minHeight: 34, fontSize: 12 }}>导出当天</button>
              </div>
            ) : null}
          </div>
        </div>

        {members.length > 0 ? (
          <div style={{ marginTop: 12, display: "grid", gap: 8, overflow: "visible", position: "relative", zIndex: 1000 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>已导入成员</h3>
            {members.map((m) => (
              <div
                key={m.id}
                style={{ border: "1px solid #d8e5ec", borderRadius: 12, background: "#fff", padding: "8px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "nowrap", overflow: "visible", position: "relative", zIndex: 1001 }}
              >
                <div style={{ fontSize: 12, color: "#1f3d63", flex: 1, minWidth: 0 }}>{m.nickname} · {m.courses.length}门</div>

                <div data-delete-menu style={{ position: "relative", zIndex: 21000, marginLeft: "auto" }}>
                  <button
                    onClick={(e) => {
                      if (deleteTarget?.id === m.id) {
                        setDeleteTarget(null);
                        setDeleteMenuPos(null);
                        return;
                      }
                      const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                      const width = 148;
                      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
                      setDeleteTarget(m);
                      setDeleteMenuPos({ top: rect.bottom + 6, left });
                    }}
                    style={{ border: "1px solid #c8dce5", borderRadius: 999, background: "#fff", padding: "8px 12px", fontSize: 13, color: "#21414d", minHeight: 38, minWidth: 96 }}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {deleteTarget && deleteMenuPos ? (
        <div
          data-delete-menu
          style={{
            position: "fixed",
            top: deleteMenuPos.top,
            left: deleteMenuPos.left,
            width: 148,
            border: "1px solid #d8e5ec",
            borderRadius: 12,
            background: "#fff",
            boxShadow: "0 12px 28px rgba(13,38,59,0.16)",
            padding: 8,
            display: "grid",
            gap: 6,
            zIndex: 99999,
          }}
        >
          <button onClick={() => removeMemberLocal(deleteTarget.id)} style={{ border: "1px solid #c8dce5", borderRadius: 8, background: "#fff", minHeight: 34, fontSize: 12 }}>删除本地</button>
          <button onClick={async () => { await removeMemberCloud(deleteTarget.id); }} style={{ border: "1px solid #f2c7c7", borderRadius: 8, background: "#fff6f6", color: "#b33a3a", minHeight: 34, fontSize: 12 }}>删除云端</button>
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





























































































