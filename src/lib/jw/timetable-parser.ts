import { createHash } from "crypto";

import * as cheerio from "cheerio";

import type { TimetableCourse } from "@/types/timetable";

function parseWeeks(raw: string): number[] {
  const weeks = new Set<number>();
  const compact = raw.replace(/\s+/g, "");
  const ranges = compact.match(/\d+(?:-\d+)?/g) ?? [];

  for (const part of ranges) {
    if (part.includes("-")) {
      const [startRaw, endRaw] = part.split("-");
      const start = Number.parseInt(startRaw, 10);
      const end = Number.parseInt(endRaw, 10);
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        for (let i = start; i <= end; i += 1) {
          weeks.add(i);
        }
      }
    } else {
      const week = Number.parseInt(part, 10);
      if (Number.isFinite(week)) {
        weeks.add(week);
      }
    }
  }

  const odd = /单周/.test(compact);
  const even = /双周/.test(compact);
  if (odd || even) {
    return Array.from(weeks).filter((week) => (odd ? week % 2 === 1 : week % 2 === 0));
  }

  return Array.from(weeks);
}

function buildCourseId(
  term: string,
  weekday: number,
  startSection: number,
  endSection: number,
  name: string,
  teacher: string,
  location: string,
): string {
  const seed = `${term}-${weekday}-${startSection}-${endSection}-${name}-${teacher}-${location}`;
  return createHash("sha1").update(seed).digest("hex").slice(0, 16);
}

function parseCourseDetail(raw: string) {
  const teacher = raw.match(/老师[:：]\s*([^;；]+)/)?.[1]?.trim() ?? "";
  const location = raw.match(/地点[:：]\s*([^;；]+)/)?.[1]?.trim() ?? "";
  const weekRaw = raw.match(/时间[:：]\s*([^\[]+周)/)?.[1]?.trim() ?? "";
  const weeks = weekRaw ? parseWeeks(weekRaw) : [];

  return { teacher, location, weeks };
}

function parseSectionIndexFromLabel(labelText: string, fallback: number): number {
  if (labelText.includes("第一大节")) return 1;
  if (labelText.includes("第二大节")) return 2;
  if (labelText.includes("第三大节")) return 3;
  if (labelText.includes("第四大节")) return 4;
  if (labelText.includes("第五大节")) return 5;
  return fallback;
}

export function parseSelectedTerm(html: string): string | null {
  const $ = cheerio.load(html);
  const selected = $("#xnxq01id option[selected]").first().attr("value")?.trim();
  if (selected) {
    return selected;
  }

  const first = $("#xnxq01id option").first().attr("value")?.trim();
  return first || null;
}

export function parseTimetableFromHtml(html: string, term: string): TimetableCourse[] {
  const $ = cheerio.load(html);
  const courses: TimetableCourse[] = [];

  // index 0 is the section label column, 1..7 are Monday..Sunday.
  const rowSpanOccupy: number[] = new Array(8).fill(0);
  const rows = $("table.qz-weeklyTable tbody tr");

  rows.each((rowIndex, rowEl) => {
    // Entering a new row: countdown previously active rowspans.
    for (let i = 0; i < rowSpanOccupy.length; i += 1) {
      if (rowSpanOccupy[i] > 0) {
        rowSpanOccupy[i] -= 1;
      }
    }

    const row = $(rowEl);
    const sectionLabel = row.find("td[name='timeTd']").first().text().replace(/\s+/g, " ").trim();
    const sectionIndex = parseSectionIndexFromLabel(sectionLabel, rowIndex + 1);

    let colIndex = 0;
    row.find("td").each((_, tdEl) => {
      while (colIndex < 8 && rowSpanOccupy[colIndex] > 0) {
        colIndex += 1;
      }
      if (colIndex >= 8) {
        return;
      }

      const td = $(tdEl);
      const rowspan = Number.parseInt(td.attr("rowspan") ?? "1", 10) || 1;
      const colspan = Number.parseInt(td.attr("colspan") ?? "1", 10) || 1;

      for (let c = 0; c < colspan; c += 1) {
        if (rowspan > 1 && colIndex + c < 8) {
          rowSpanOccupy[colIndex + c] = Math.max(rowSpanOccupy[colIndex + c], rowspan);
        }
      }

      const isCourseCell = td.attr("name") === "kbDataTd";
      const weekday = colIndex as 1 | 2 | 3 | 4 | 5 | 6 | 7;

      if (isCourseCell && weekday >= 1 && weekday <= 7) {
        td.find("li.courselists-item").each((__, liEl) => {
          const li = $(liEl);
          const name = li.find(".qz-hasCourse-title").first().text().replace(/\s+/g, " ").trim();
          if (!name) {
            return;
          }

          const detailText = li
            .find(".qz-hasCourse-abbrinfo")
            .first()
            .text()
            .replace(/\s+/g, " ")
            .trim();

          const detail = parseCourseDetail(detailText);
          const startSection = sectionIndex;
          const endSection = Math.min(5, sectionIndex + rowspan - 1);

          courses.push({
            id: buildCourseId(term, weekday, startSection, endSection, name, detail.teacher, detail.location),
            name,
            teacher: detail.teacher,
            location: detail.location,
            weekday,
            startSection,
            endSection,
            weeks: detail.weeks.length > 0 ? detail.weeks : [1],
            term,
          });
        });
      }

      colIndex += colspan;
    });
  });

  return courses;
}

export function looksLikeTimetablePage(html: string): boolean {
  return /个人课表信息|学期理论课表|xskb_list\.do|星期一|qz-weeklyTable/i.test(html);
}
