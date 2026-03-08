import { createHash } from "crypto";

import * as cheerio from "cheerio";

import type { TrainingPlanItem, TrainingPlanSummary } from "@/types/training-plan";

function cleanText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function buildId(category: string, index: number): string {
  return createHash("sha1").update(`${index}-${category}`).digest("hex").slice(0, 16);
}

function isTermLike(text: string): boolean {
  return /^\d{4}-\d{4}-[12]$/.test(text);
}

function normalizeCategoryByCode(code: string): string | null {
  const c = (code || "").toUpperCase();
  if (c === "XF") return "专业方向课";
  if (c === "BS") return "实践教学环节";
  if (c === "XY") return "艺术审美类";
  if (c === "XZ" || c === "XR" || c === "XG") return "耕读教育类";
  if (c === "XT") return "体育健康类";
  if (c === "XD") return "四史教育类";
  return null;
}

function parseCredit(value: string): string {
  const match = value.match(/[\d.]+/);
  return match?.[0] ?? "-";
}

function buildSubjectLine(cells: string[]): string {
  const payload = {
    term: cells[0] || "-",
    courseCode: cells[1] || "-",
    courseName: cells[2] || "-",
    credit: parseCredit(cells[3] || ""),
    courseType: cells[4] || "-",
    categoryCode: (cells[5] || "-").toUpperCase(),
    status: cells[6] || "-",
    score: cells[7] || "-",
  };
  return JSON.stringify(payload);
}

export function parseTrainingPlanFromHtml(html: string): { items: TrainingPlanItem[]; summary: TrainingPlanSummary } {
  const $ = cheerio.load(html);
  const rows = $(".list-tr").toArray();

  const items: TrainingPlanItem[] = [];
  const itemMap = new Map<string, TrainingPlanItem>();
  let summary: TrainingPlanSummary = {
    requiredCredits: "0.0",
    completedCredits: "0.0",
    currentCredits: "0.0",
    remainingCredits: "0.0",
  };

  rows.forEach((row, index) => {
    const cells = $(row).find(".list-td .list-td-cell").toArray().map((el) => cleanText($(el).text()));
    if (cells.length < 5) return;

    const totalRow = $(row).hasClass("total-tr") || cells[0] === "合计";
    if (totalRow) {
      summary = {
        requiredCredits: cells[1] || "0.0",
        completedCredits: cells[2] || "0.0",
        currentCredits: cells[3] || "0.0",
        remainingCredits: cells[4] || "0.0",
      };
      return;
    }

    const categoryNode = $(row).find(".jClass-item").first();
    const category = cleanText(categoryNode.text());

    if (category && !isTermLike(category)) {
      const item: TrainingPlanItem = {
        id: buildId(category, index),
        category,
        requiredCredits: cells[1] || "0.0",
        completedCredits: cells[2] || "0.0",
        currentCredits: cells[3] || "0.0",
        remainingCredits: cells[4] || "0.0",
        subjects: [],
      };
      items.push(item);
      itemMap.set(category, item);
      return;
    }

    if (!isTermLike(cells[0]) || cells.length < 8) return;

    // 具体课程只按课程类别代码归属，避免 BK 等课程误归到 XY 类别。
    const targetCategory = normalizeCategoryByCode(cells[5] || "");
    if (!targetCategory || !itemMap.has(targetCategory)) return;

    const line = buildSubjectLine(cells);
    const item = itemMap.get(targetCategory)!;
    if (!item.subjects) item.subjects = [];
    if (!item.subjects.includes(line)) item.subjects.push(line);
  });

  return { items, summary };
}

