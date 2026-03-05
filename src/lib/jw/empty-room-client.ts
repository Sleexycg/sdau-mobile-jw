import { createHash } from "crypto";

import { load } from "cheerio";

import {
  getDaizongCampusCode,
  getJwBaseUrl,
  getJwTimeoutMs,
  getJwUserAgent,
  getXibeiCampusCode,
  getZhongyangCampusCode,
} from "@/lib/env";
import { JwError } from "@/lib/jw/errors";
import type { CampusName, EmptyRoomItem, EmptyRoomQuery, EmptyRoomResponse, SectionCode } from "@/types/empty-room";

interface EmptyRoomBootstrap {
  xnxqh: string;
  kbjcmsid: string;
  selectZc: string;
  qsxq: string;
  campusCodeMap: Partial<Record<CampusName, string>>;
}

export interface EmptyRoomContext {
  term: string;
  week: number;
}

type JsjyResponse = [
  Array<Record<string, unknown>>,
  number,
  number,
  string[],
  unknown[][],
  number,
  unknown[],
  string | number,
];

interface SectionQueryPlan {
  selectJc: string;
  targetToken: string;
}

function sectionLabel(sectionCode: SectionCode): string {
  const map: Record<SectionCode, string> = {
    "0102": "第一大节",
    "0304": "第二大节",
    "中午": "中午",
    "0506": "第三大节",
    "0708": "第四大节",
    "0910": "第五大节",
    "晚间": "晚间",
  };
  return map[sectionCode];
}

function sectionQueryPlans(sectionCode: SectionCode): SectionQueryPlan[] {
  const plans: Record<SectionCode, SectionQueryPlan[]> = {
    "0102": [{ selectJc: "0102", targetToken: "0102" }],
    "0304": [{ selectJc: "0304", targetToken: "0304" }],
    "中午": [
      { selectJc: "中午", targetToken: "中午" },
      { selectJc: "0102,中午", targetToken: "中午" },
      { selectJc: "0304,中午", targetToken: "中午" },
    ],
    "0506": [
      { selectJc: "0506", targetToken: "0506" },
      { selectJc: "第三大节", targetToken: "第三大节" },
      { selectJc: "0102,0506", targetToken: "0506" },
      { selectJc: "0304,0506", targetToken: "0506" },
      { selectJc: "0102,0304,0506", targetToken: "0506" },
    ],
    "0708": [
      { selectJc: "0708", targetToken: "0708" },
      { selectJc: "第四大节", targetToken: "第四大节" },
      { selectJc: "0102,0708", targetToken: "0708" },
      { selectJc: "0304,0708", targetToken: "0708" },
      { selectJc: "0102,0304,0708", targetToken: "0708" },
    ],
    "0910": [
      { selectJc: "0910", targetToken: "0910" },
      { selectJc: "第五大节", targetToken: "第五大节" },
      { selectJc: "0102,0910", targetToken: "0910" },
      { selectJc: "0304,0910", targetToken: "0910" },
    ],
    "晚间": [
      { selectJc: "晚间", targetToken: "晚间" },
      { selectJc: "晚间时段", targetToken: "晚间时段" },
      { selectJc: "0102,晚间", targetToken: "晚间" },
      { selectJc: "0304,晚间", targetToken: "晚间" },
    ],
  };
  return plans[sectionCode];
}

function canonicalSectionToken(token: string): string {
  const t = token.trim();
  const map: Record<string, string> = {
    "第一大节": "0102",
    "第二大节": "0304",
    "第三大节": "0506",
    "第四大节": "0708",
    "第五大节": "0910",
    "中午时段": "中午",
    "晚间时段": "晚间",
  };
  return map[t] ?? t;
}

function resolveTargetCellIndex(selectJc: string, targetToken: string): number {
  const target = canonicalSectionToken(targetToken);
  const tokens = selectJc.split(",").map((item) => canonicalSectionToken(item));
  const idx = tokens.findIndex((item) => item === target);
  return idx >= 0 ? idx + 1 : 1;
}

function normalizeText(input: string): string {
  return input.replace(/\s+/g, "").trim();
}

function pickCampusCode(queryCampus: CampusName, bootstrapMap: Partial<Record<CampusName, string>>): string {
  const fromHtml = bootstrapMap[queryCampus];
  if (fromHtml) {
    return fromHtml;
  }

  if (queryCampus === "岱宗校区") {
    return getDaizongCampusCode() ?? "001";
  }
  if (queryCampus === "泮河校区") {
    return getZhongyangCampusCode() ?? "002";
  }

  return getXibeiCampusCode() ?? "A5F850229661E843E0536685C2CAF624";
}

function parseSelectedWeeksFromHtml($: ReturnType<typeof load>): string {
  const fromHidden = String($("#selectZc").val() ?? "").trim();
  if (fromHidden) {
    return fromHidden;
  }

  const checked: string[] = [];
  $("input[name='zc']:checked").each((_, el) => {
    const value = String($(el).val() ?? "").trim();
    if (value) checked.push(value);
  });
  if (checked.length > 0) {
    return checked.join(",");
  }

  return "1";
}

function parseBootstrap(html: string): EmptyRoomBootstrap {
  const $ = load(html);

  const xnxqh = String($("#xnxqh").val() ?? "").trim();
  const kbjcmsid = String($("#kbjcmsid").val() ?? "").trim();
  const qsxq = String($("#qsxq").val() ?? "1").trim() || "1";
  const selectZc = parseSelectedWeeksFromHtml($);

  const campusCodeMap: Partial<Record<CampusName, string>> = {};
  $("#xqbh option").each((_, option) => {
    const name = normalizeText($(option).text());
    const value = String($(option).attr("value") ?? "").trim();
    if (!value) return;

    if (name.includes("岱宗") || name.includes("岱总")) campusCodeMap["岱宗校区"] = value;
    if (name.includes("泮河") || name.includes("中央")) campusCodeMap["泮河校区"] = value;
    if (name.includes("西北")) campusCodeMap["西北片区"] = value;
  });

  if (!xnxqh || !kbjcmsid) {
    throw new JwError("JW_UNAVAILABLE", "空教室页面关键参数缺失（xnxqh 或 kbjcmsid）");
  }

  return {
    xnxqh,
    kbjcmsid,
    selectZc,
    qsxq,
    campusCodeMap,
  };
}

function resolveCurrentWeek(selectZc: string): number {
  const first = selectZc
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .find((item) => Number.isFinite(item) && item > 0);
  return first ?? 1;
}

function normalizeCell(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).trim();
}

function isEmptySlot(cell: unknown): boolean {
  const text = normalizeCell(cell);
  return text.length === 0;
}

function parseRoomsFromJsjyResponse(
  payload: JsjyResponse,
  query: EmptyRoomQuery,
  targetCellIndex: number,
): EmptyRoomItem[] {
  const rows = Array.isArray(payload[4]) ? payload[4] : [];
  const result: EmptyRoomItem[] = [];

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue;

    const targetCell = row[targetCellIndex] ?? row[1];
    if (!isEmptySlot(targetCell)) {
      continue;
    }

    const roomName = String(row[0] ?? "").trim();
    if (!roomName) continue;

    const id = createHash("sha1")
      .update(`${query.campus}-${roomName}-${query.weekday}-${query.sectionCode}`)
      .digest("hex")
      .slice(0, 16);

    result.push({
      id,
      campus: query.campus,
      roomName,
    });
  }

  return result;
}

async function fetchBootstrap(cookieHeader: string): Promise<EmptyRoomBootstrap> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getJwTimeoutMs());

  try {
    const response = await fetch(`${getJwBaseUrl()}/kbxx/jsjy_query`, {
      method: "GET",
      headers: {
        "User-Agent": getJwUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Cookie: cookieHeader,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    const html = await response.text();
    if (!response.ok || /登录|login|请重新登录/i.test(html)) {
      throw new JwError("UNAUTHORIZED", "登录状态已失效，请重新登录");
    }

    return parseBootstrap(html);
  } catch (error) {
    if (error instanceof JwError) throw error;
    throw new JwError("JW_UNAVAILABLE", "空教室页面访问失败，请稍后重试");
  } finally {
    clearTimeout(timeout);
  }
}

function buildPayload(query: EmptyRoomQuery, bootstrap: EmptyRoomBootstrap, selectJc: string): URLSearchParams {
  const body = new URLSearchParams();
  const campusCode = pickCampusCode(query.campus, bootstrap.campusCodeMap);

  body.set("xnxqh", bootstrap.xnxqh);
  body.set("xqbh", campusCode);
  body.set("jxqbh", "");
  body.set("jxlbh", "");
  body.set("jsbh", "");
  body.set("jslx", "");
  body.set("bjfh", "=");
  body.set("rnrs", "");
  body.set("yx", "");
  body.set("kbjcmsid", bootstrap.kbjcmsid);
  body.set("selectZc", bootstrap.selectZc);
  body.set("startdate", "");
  body.set("enddate", "");
  body.set("selectXq", String(query.weekday));
  body.set("selectJc", selectJc);
  body.set("syjs0601id", "");
  body.set("typewhere", "jszq");
  body.set("qsxq", bootstrap.qsxq);
  body.set("jyms", "0");

  return body;
}

function parseJsjyJsonOrThrow(rawText: string): JsjyResponse {
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error("NON_JSON");
  }

  if (json && typeof json === "object" && !Array.isArray(json)) {
    const msg = String((json as { msg?: unknown }).msg ?? "").trim();
    throw new Error(msg ? `MSG:${msg}` : "OBJECT_JSON");
  }

  if (!Array.isArray(json) || json.length < 5 || !Array.isArray(json[4])) {
    throw new Error("UNEXPECTED_ARRAY");
  }

  return json as JsjyResponse;
}

export async function fetchEmptyRooms(cookieHeader: string, query: EmptyRoomQuery): Promise<EmptyRoomResponse> {
  const bootstrap = await fetchBootstrap(cookieHeader);
  const queryPlans = sectionQueryPlans(query.sectionCode);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getJwTimeoutMs());

  try {
    let lastReason = "";

    for (const plan of queryPlans) {
      const payload = buildPayload(query, bootstrap, plan.selectJc);
      const targetCellIndex = resolveTargetCellIndex(plan.selectJc, plan.targetToken);
      const response = await fetch(`${getJwBaseUrl()}/kbxx/jsjy_query2`, {
        method: "POST",
        headers: {
          "User-Agent": getJwUserAgent(),
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          Referer: `${getJwBaseUrl()}/kbxx/jsjy_query`,
          Origin: getJwBaseUrl(),
          Cookie: cookieHeader,
        },
        body: payload,
        signal: controller.signal,
        cache: "no-store",
      });

      const text = (await response.text()).replace(/^\uFEFF/, "").trim();
      if (!response.ok) {
        lastReason = `HTTP_${response.status}`;
        continue;
      }

      try {
        const parsed = parseJsjyJsonOrThrow(text);
        const rooms = parseRoomsFromJsjyResponse(parsed, query, targetCellIndex);
        return {
          query,
          term: bootstrap.xnxqh,
          week: resolveCurrentWeek(bootstrap.selectZc),
          total: rooms.length,
          rooms,
        };
      } catch (error) {
        lastReason = error instanceof Error ? error.message : "PARSE_FAIL";
      }
    }

    if (lastReason.startsWith("MSG:")) {
      throw new JwError("JW_UNAVAILABLE", `空教室接口提示：${lastReason.slice(4)}`);
    }

    throw new JwError("JW_UNAVAILABLE", `空教室查询失败（${sectionLabel(query.sectionCode)}），原因：${lastReason || "未知"}`);
  } catch (error) {
    if (error instanceof JwError) throw error;
    throw new JwError("JW_UNAVAILABLE", `空教室查询失败（${sectionLabel(query.sectionCode)}）`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchEmptyRoomContext(cookieHeader: string): Promise<EmptyRoomContext> {
  const bootstrap = await fetchBootstrap(cookieHeader);
  return {
    term: bootstrap.xnxqh,
    week: resolveCurrentWeek(bootstrap.selectZc),
  };
}

