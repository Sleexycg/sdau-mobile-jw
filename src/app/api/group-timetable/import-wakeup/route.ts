import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import type { TimetableCourse } from "@/types/timetable";

interface ImportRequestBody {
  text?: string;
  token?: string;
  nickname?: string;
  semesterStart?: string;
}

interface WakeupCourseLike {
  [key: string]: unknown;
}

type JsonRecord = Record<string, unknown>;

const NAME_KEYS = ["name", "courseName", "kcName", "course", "lessonName", "title", "kcmc", "courseText"];
const DAY_KEYS = ["weekday", "weekDay", "day", "xq", "week", "xingqi", "dayOfWeek", "weekIndex", "dow", "xqj"];
const START_KEYS = ["startSection", "startNode", "start", "node", "sectionStart", "fromSection", "jc", "ksjc", "nodeStart", "startUnit", "startLesson"];
const END_KEYS = ["endSection", "endNode", "end", "sectionEnd", "toSection", "jsjc", "nodeEnd", "endUnit", "endLesson"];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function extractToken(text: string): string | null {
  const quoteMatch = text.match(/「([a-f0-9]{32})」/i);
  if (quoteMatch?.[1]) return quoteMatch[1].toLowerCase();
  const fallback = text.match(/[a-f0-9]{32}/i);
  return fallback?.[0]?.toLowerCase() ?? null;
}


function normalizeSemesterStart(input: string | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const month = Number.parseInt(match[1], 10);
  const day = Number.parseInt(match[2], 10);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${month}/${day}`;
}
function toNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const n = Number.parseInt(input, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickString(source: JsonRecord, keys: string[]): string {
  for (const key of keys) {
    const v = source[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickNumber(source: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    const v = toNumber(source[key]);
    if (v !== null) return v;
  }
  return null;
}

function parseWeeks(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw.map((n) => Number.parseInt(String(n), 10)).filter((n) => Number.isFinite(n));
  }

  if (typeof raw !== "string") return [];
  const compact = raw.replace(/\s+/g, "");
  const chunks = compact.match(/\d+(?:-\d+)?/g) ?? [];
  const set = new Set<number>();

  for (const c of chunks) {
    if (!c.includes("-")) {
      const n = Number.parseInt(c, 10);
      if (Number.isFinite(n)) set.add(n);
      continue;
    }

    const [a, b] = c.split("-");
    const start = Number.parseInt(a, 10);
    const end = Number.parseInt(b, 10);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    for (let i = start; i <= end; i += 1) set.add(i);
  }

  return Array.from(set).sort((a, b) => a - b);
}

function normalizeWeekday(input: unknown): 1 | 2 | 3 | 4 | 5 | 6 | 7 | null {
  const n = toNumber(input);
  if (n === null) return null;
  if (n >= 1 && n <= 7) return n as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  if (n === 0) return 7;
  return null;
}

function toBigSection(s: number): number {
  if (s <= 2) return 1;
  if (s <= 4) return 2;
  if (s <= 6) return 3;
  if (s <= 8) return 4;
  return 5;
}

function parseSectionRangeText(raw: unknown): { start: number; end: number } | null {
  if (typeof raw !== "string") return null;
  const compact = raw.replace(/\s+/g, "");
  const m = compact.match(/(\d+)[-~到至](\d+)/);
  if (!m) return null;
  const a = Number.parseInt(m[1], 10);
  const b = Number.parseInt(m[2], 10);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return { start: toBigSection(a), end: toBigSection(b) };
}

function normalizeSections(course: JsonRecord): { start: number; end: number } | null {
  const sectionText = parseSectionRangeText(course.section ?? course.jc);
  if (sectionText) return sectionText;

  const start = pickNumber(course, START_KEYS);
  let end = pickNumber(course, END_KEYS);
  const step = pickNumber(course, ["step", "duration", "len", "jcs"]);

  if (start && !end && step && step >= 1) {
    end = start + step - 1;
  }

  if (!start || !end || start < 1 || end < start) return null;
  return { start: toBigSection(start), end: toBigSection(end) };
}

function normalizeCourseFromObject(input: JsonRecord, index: number, termFallback: string): TimetableCourse | null {
  const name = pickString(input, NAME_KEYS);
  if (!name) return null;

  const weekday = normalizeWeekday(
    input.weekday ?? input.weekDay ?? input.day ?? input.xq ?? input.week ?? input.xingqi ?? input.dayOfWeek,
  );
  if (!weekday) return null;

  const sections = normalizeSections(input);
  if (!sections) return null;

  const weeks =
    parseWeeks(input.weeks) ||
    parseWeeks(input.weekList) ||
    parseWeeks(input.weekDesc) ||
    parseWeeks(input.weekText) ||
    parseWeeks(input.zc) ||
    (() => {
      const a = pickNumber(input, ["startWeek", "weekStart", "kszc"]);
      const b = pickNumber(input, ["endWeek", "weekEnd", "jszc"]);
      if (!a || !b || b < a) return [];
      return Array.from({ length: b - a + 1 }, (_, i) => a + i);
    })();

  const teacher = pickString(input, ["teacher", "teacherName", "js", "lecturer", "rkjs"]);
  const location = pickString(input, ["location", "classroom", "room", "place", "address", "jsmc"]);
  const term = pickString(input, ["term", "semester", "xnxq"]) || termFallback;

  return {
    id: `wakeup-${index}-${randomUUID().slice(0, 8)}`,
    name,
    teacher,
    location,
    weekday,
    startSection: sections.start,
    endSection: sections.end,
    weeks: weeks.length > 0 ? weeks : [1],
    term,
  };
}

function hasCourseShape(item: unknown): boolean {
  if (!isRecord(item)) return false;
  const hasName = NAME_KEYS.some((k) => typeof item[k] === "string");
  const hasDay = DAY_KEYS.some((k) => item[k] !== undefined);
  const hasStart = START_KEYS.some((k) => item[k] !== undefined) || item.section !== undefined;
  return hasName && hasDay && hasStart;
}

function findCourseArraysDeep(payload: unknown, depth = 0): WakeupCourseLike[] {
  if (depth > 8) return [];
  if (Array.isArray(payload)) {
    if (payload.length > 0 && payload.every((v) => hasCourseShape(v))) {
      return payload as WakeupCourseLike[];
    }

    for (const item of payload) {
      const found = findCourseArraysDeep(item, depth + 1);
      if (found.length > 0) return found;
    }
    return [];
  }

  if (!isRecord(payload)) return [];

  for (const value of Object.values(payload)) {
    const found = findCourseArraysDeep(value, depth + 1);
    if (found.length > 0) return found;
  }

  return [];
}

function parseWakeupMultiJson(raw: string): unknown[] {
  const text = raw.trim();
  if (!text) return [];

  const result: unknown[] = [];
  try {
    result.push(JSON.parse(text));
  } catch {
    // ignore
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    try {
      result.push(JSON.parse(line));
    } catch {
      // ignore
    }
  }

  return result;
}

function expandValue(value: unknown): unknown {
  if (typeof value === "string") {
    const parts = parseWakeupMultiJson(value);
    if (parts.length === 1) return parts[0];
    if (parts.length > 1) return parts;
    return value;
  }
  return value;
}

function expandWakeupPayload(payload: unknown): unknown {
  if (!isRecord(payload)) return expandValue(payload);
  if (payload.data !== undefined) return expandValue(payload.data);
  return payload;
}

function parseFromWakeupPartArray(expanded: unknown, termFallback: string): TimetableCourse[] {
  if (!Array.isArray(expanded)) return [];

  // WakeUp 常见分段结构：
  // [0]=meta, [1]=timeTableInfo, [2]=settings, [3]=courseDefinitions, [4]=courseArrangements
  const timeTableInfoRaw = expanded[1];
  const courseDefinitionsRaw = expanded[3];
  const courseArrangementsRaw = expanded[4];

  const timeTableInfo = Array.isArray(timeTableInfoRaw) ? timeTableInfoRaw : [];
  const courseDefinitions = Array.isArray(courseDefinitionsRaw) ? courseDefinitionsRaw : [];
  const courseArrangements = Array.isArray(courseArrangementsRaw) ? courseArrangementsRaw : [];

  const nodeToTime = new Map<number, { startTime: string; endTime: string }>();
  for (const slot of timeTableInfo) {
    if (!isRecord(slot)) continue;
    const node = toNumber(slot.node);
    if (!node) continue;
    const startTime = typeof slot.startTime === "string" ? slot.startTime : "";
    const endTime = typeof slot.endTime === "string" ? slot.endTime : "";
    nodeToTime.set(node, { startTime, endTime });
  }

  const courseIdToName = new Map<string, string>();
  for (const def of courseDefinitions) {
    if (!isRecord(def)) continue;
    const id = def.id;
    if (id === undefined || id === null) continue;
    const key = String(id);
    const name =
      (typeof def.courseName === "string" && def.courseName.trim()) ||
      (typeof def.name === "string" && def.name.trim()) ||
      (typeof def.title === "string" && def.title.trim()) ||
      "";
    if (name) courseIdToName.set(key, name);
  }

  const courses: TimetableCourse[] = [];
  for (let index = 0; index < courseArrangements.length; index += 1) {
    const arr = courseArrangements[index];
    if (!isRecord(arr)) continue;

    const courseDefId = arr.id;
    const courseName =
      courseDefId !== undefined && courseDefId !== null
        ? courseIdToName.get(String(courseDefId)) || "未知课程"
        : "未知课程";

    const startWeek = toNumber(arr.startWeek);
    const endWeek = toNumber(arr.endWeek);
    const dayOfWeek = normalizeWeekday(arr.day);
    const startNode = toNumber(arr.startNode);
    const step = toNumber(arr.step) ?? 1;

    if (!startWeek || !endWeek || endWeek < startWeek || !dayOfWeek || !startNode || step < 1) {
      continue;
    }

    const endNode = startNode + step - 1;
    const startSection = toBigSection(startNode);
    const endSection = toBigSection(endNode);
    const weeks = Array.from({ length: endWeek - startWeek + 1 }, (_, i) => startWeek + i);
    const teacher = typeof arr.teacher === "string" ? arr.teacher.trim() : "";
    const location = typeof arr.room === "string" ? arr.room.trim() : "";
    const term = termFallback || "";

    const slotTime = nodeToTime.get(startNode);
    const idSeed = `${courseName}-${dayOfWeek}-${startNode}-${endNode}-${slotTime?.startTime || ""}`;

    courses.push({
      id: `wakeup-part-${index}-${randomUUID().slice(0, 6)}-${idSeed.length}`,
      name: courseName,
      teacher,
      location,
      weekday: dayOfWeek,
      startSection,
      endSection,
      weeks,
      term,
    });
  }

  if (courses.length > 0) {
    return courses;
  }

  // 若并非该分段结构，则退回“找首个数组”的通用兜底
  const candidate = expanded.find((part) => Array.isArray(part) && part.length > 0) as unknown;
  if (!Array.isArray(candidate)) return [];
  candidate.forEach((item, index) => {
    if (!isRecord(item)) return;
    const normalized = normalizeCourseFromObject(item, index, termFallback);
    if (normalized) courses.push(normalized);
  });

  return courses;
}

function pickCourseArray(payload: unknown): WakeupCourseLike[] {
  const expanded = expandWakeupPayload(payload);

  if (Array.isArray(expanded)) {
    for (const part of expanded) {
      const found = findCourseArraysDeep(part);
      if (found.length > 0) return found;
    }
  }

  return findCourseArraysDeep(expanded);
}

function pickTermFallback(payload: unknown): string {
  const expanded = expandWakeupPayload(payload);

  const fromRecord = (record: JsonRecord): string => pickString(record, ["term", "semester", "xnxq"]);

  if (Array.isArray(expanded)) {
    for (const part of expanded) {
      if (isRecord(part)) {
        const t = fromRecord(part);
        if (t) return t;
      }
    }
    return "";
  }

  if (isRecord(expanded)) {
    return fromRecord(expanded);
  }

  return "";
}

function debugPayloadShape(payload: unknown): string {
  const expanded = expandWakeupPayload(payload);
  if (Array.isArray(expanded)) {
    const parts = expanded.slice(0, 5).map((p, i) => {
      if (Array.isArray(p)) {
        const first = p[0];
        if (isRecord(first)) {
          return `part${i}:array(len=${p.length},firstKeys=${Object.keys(first).slice(0, 10).join(",")})`;
        }
        return `part${i}:array(len=${p.length},firstType=${typeof first})`;
      }
      if (isRecord(p)) return `part${i}:obj(keys=${Object.keys(p).slice(0, 8).join(",")})`;
      return `part${i}:${typeof p}`;
    });
    return `expanded=array(len=${expanded.length}); ${parts.join("; ")}`;
  }

  if (isRecord(expanded)) {
    return `expanded=obj(keys=${Object.keys(expanded).slice(0, 16).join(",")})`;
  }

  return `expanded=${typeof expanded}`;
}

async function fetchWakeupByToken(token: string): Promise<unknown> {
  const base = process.env.WAKEUP_IMPORT_API?.trim();
  if (!base) {
    throw new Error("WAKEUP_IMPORT_API_NOT_CONFIGURED");
  }

  const param = process.env.WAKEUP_IMPORT_TOKEN_PARAM?.trim() || "token";
  const method = (process.env.WAKEUP_IMPORT_METHOD?.trim().toUpperCase() || "GET") as "GET" | "POST";

  if (method === "POST") {
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [param]: token }),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`WAKEUP_HTTP_${res.status}`);
    return res.json();
  }

  const connector = base.includes("?") ? "&" : "?";
  const url = `${base}${connector}${encodeURIComponent(param)}=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`WAKEUP_HTTP_${res.status}`);
  return res.json();
}

export async function POST(request: Request): Promise<NextResponse> {

  let body: ImportRequestBody;
  try {
    body = (await request.json()) as ImportRequestBody;
  } catch {
    return NextResponse.json({ ok: false, code: "BAD_REQUEST", message: "请求格式错误" }, { status: 400 });
  }

  const nickname = body.nickname?.trim() || "群友";
  const token = body.token?.trim() || extractToken(body.text || "");
  if (!token) {
    return NextResponse.json({ ok: false, code: "TOKEN_MISSING", message: "未识别到 WakeUp 分享口令" }, { status: 400 });
  }

  const semesterStart = normalizeSemesterStart(body.semesterStart);
  if (body.semesterStart && !semesterStart) {
    return NextResponse.json(
      { ok: false, code: "BAD_SEMESTER_START", message: "学期开始日期格式错误，请使用 M/D，例如 3/2" },
      { status: 400 },
    );
  }

  try {
    const payload = await fetchWakeupByToken(token);
    const termFallback = pickTermFallback(payload);

    const rawCourses = pickCourseArray(payload);
    let courses = rawCourses
      .map((c, i) => (isRecord(c) ? normalizeCourseFromObject(c, i, termFallback || "") : null))
      .filter((c): c is TimetableCourse => Boolean(c));

    // WakeUp 分段数组兜底（你当前就是这种）
    if (courses.length === 0) {
      const expanded = expandWakeupPayload(payload);
      courses = parseFromWakeupPartArray(expanded, termFallback || "");
    }

    if (courses.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          code: "PARSE_EMPTY",
          message: `WakeUp 数据结构已变化，暂时无法解析（${debugPayloadShape(payload)}）`,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: `member-${randomUUID().slice(0, 12)}`,
        nickname,
        source: "wakeup",
        importedAt: new Date().toISOString(),
        semesterStart: semesterStart || undefined,
        courses,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "WAKEUP_IMPORT_API_NOT_CONFIGURED") {
      return NextResponse.json(
        {
          ok: false,
          code: "WAKEUP_API_NOT_CONFIGURED",
          message: "服务端尚未配置 WakeUp 转换接口（WAKEUP_IMPORT_API）",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: false, code: "WAKEUP_IMPORT_FAILED", message: "WakeUp 导入失败，请稍后重试" }, { status: 503 });
  }
}









