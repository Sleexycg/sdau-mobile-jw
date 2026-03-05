import { createHash } from "crypto";

import * as cheerio from "cheerio";

import type { ScoreRecord, ScoreTermOption } from "@/types/score";

function cleanText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function buildScoreId(term: string, courseCode: string, courseName: string): string {
  return createHash("sha1").update(`${term}-${courseCode}-${courseName}`).digest("hex").slice(0, 16);
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function parseScoreTermsFromHtml(html: string): ScoreTermOption[] {
  const $ = cheerio.load(html);
  const terms: ScoreTermOption[] = [];

  const select = $("select")
    .filter((_, el) => {
      const id = ($(el).attr("id") ?? "").toLowerCase();
      const name = ($(el).attr("name") ?? "").toLowerCase();
      return /xnxq|xn|xq|kksj|term/.test(id) || /xnxq|xnxqid|xn|xq|kksj|term/.test(name);
    })
    .first();

  const target = select.length > 0 ? select : $("select").first();

  target.find("option").each((_, option) => {
    const value = cleanText($(option).attr("value") ?? "");
    const label = cleanText($(option).text());
    if (!value || !label) return;
    if (!/^\d{4}-\d{4}-[12]$/.test(value)) return;
    terms.push({ value, label });
  });

  return terms;
}

function normalizeArrayPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const rec = payload as Record<string, unknown>;
    if (Array.isArray(rec.rows)) return rec.rows;
    if (Array.isArray(rec.data)) return rec.data;
    if (Array.isArray(rec.list)) return rec.list;
    if (Array.isArray(rec.result)) return rec.result;
  }

  return [];
}

export function parseScoreRecordsFromJson(payload: unknown, term: string): ScoreRecord[] {
  const rows = normalizeArrayPayload(payload);
  const records: ScoreRecord[] = [];

  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;

    const courseCode = toText(row.kch || row.courseCode || row.kcdm);
    const courseName = toText(row.kc_mc || row.kcmc || row.courseName);
    const credit = toText(row.xf || row.credit);
    const score = toText(row.zcj ?? row.zcjstr ?? row.score);
    const gpa = toText(row.jd ?? row.gpa);

    if (!courseCode && !courseName) continue;

    records.push({
      id: buildScoreId(term, courseCode, courseName),
      courseCode,
      courseName,
      credit,
      score,
      gpa,
    });
  }

  const uniq = new Map<string, ScoreRecord>();
  for (const rec of records) uniq.set(rec.id, rec);
  return Array.from(uniq.values());
}

export function parseSummaryFromJson(payload: unknown): {
  avgScore: string;
  avgCreditGpa: string;
  courseCount: number;
  totalCredits: string;
} {
  if (!payload || typeof payload !== "object") {
    return { avgScore: "-", avgCreditGpa: "-", courseCount: 0, totalCredits: "-" };
  }

  const row = payload as Record<string, unknown>;
  const avgScore = toText(row.pjcj) || "-";
  const avgCreditGpa = toText(row.pjxfjd) || "-";
  const countRaw = Number.parseInt(toText(row.count), 10);
  const courseCount = Number.isFinite(countRaw) ? countRaw : 0;
  const totalCredits = toText(row.sxzxf) || "-";

  return { avgScore, avgCreditGpa, courseCount, totalCredits };
}