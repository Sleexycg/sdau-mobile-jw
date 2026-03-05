import * as cheerio from "cheerio";

import { buildEncodedCredential } from "@/lib/jw/encoding";
import { JwError } from "@/lib/jw/errors";
import { jwRequest } from "@/lib/jw/http";
import {
  parseScoreRecordsFromJson,
  parseScoreTermsFromHtml,
  parseSummaryFromJson,
} from "@/lib/jw/score-parser";
import {
  looksLikeTimetablePage,
  parseSelectedTerm,
  parseTimetableFromHtml,
} from "@/lib/jw/timetable-parser";
import type { ScoreRecord, ScoreSummary, ScoreTermOption } from "@/types/score";
import type { StudentProfile, TimetableCourse } from "@/types/timetable";

interface LoginResult {
  cookieHeader: string;
}

interface TimetableFetchResult {
  term: string;
  courses: TimetableCourse[];
}

interface ScoreFetchResult {
  selectedTerm: string;
  terms: ScoreTermOption[];
  records: ScoreRecord[];
  summary: ScoreSummary;
}

function isLoginPage(html: string): boolean {
  return /name=["']loginForm["']|欢迎登录教务系统|请先登录系统/i.test(html);
}

function parseLoginMessage(html: string): string {
  const match = html.match(/id=["']showMsg["'][^>]*>([^<]*)</i);
  return match?.[1]?.trim() ?? "";
}

function extractLoginSeed(html: string): { scode: string; sxh: string } {
  const scode = html.match(/var\s+scode\s*=\s*"([^"]+)";/)?.[1]?.trim();
  const sxh = html.match(/var\s+sxh\s*=\s*"([^"]+)";/)?.[1]?.trim();

  if (!scode || !sxh) {
    throw new JwError("JW_UNAVAILABLE", "登录混淆参数提取失败，教务页面可能已改版");
  }

  return { scode, sxh };
}

function normalizeTerm(term: string): string {
  return term.trim();
}

function parseProfileFromHtml(html: string): StudentProfile | null {
  const $ = cheerio.load(html);

  const title = $(".infoContentTitle").first().text().replace(/\s+/g, " ").trim();
  const matched = title.match(/(.+)-(\d{6,})$/);
  const name = matched?.[1]?.trim() ?? "";
  const studentId = matched?.[2]?.trim() ?? "";

  let className = "";
  let major = "";
  let college = "";

  $(".qz-detailtext").each((_, el) => {
    const text = $(el).text().replace(/\u00a0/g, " ").replace(/\s+/g, "").trim();
    const parts = text.split(/[：:]/);
    if (parts.length < 2) return;

    const label = parts[0];
    const value = parts.slice(1).join(":").trim();

    if (!value) return;

    if (label.includes("班级")) {
      className = value;
    } else if (label.includes("专业")) {
      major = value;
    } else if (label.includes("学院")) {
      college = value;
    }
  });

  if (!name || !studentId) return null;

  return {
    name,
    studentId,
    className,
    major,
    college,
    displayName: `${name}-${studentId}`,
  };
}

function decodeJson<T>(text: string): T {
  const raw = text.replace(/^\uFEFF/, "").trim();
  return JSON.parse(raw) as T;
}

function buildScoreListPath(term: string): string {
  const query = new URLSearchParams({
    pageNum: "1",
    pageSize: "200",
    kksj: term,
    kcxz: "",
    kcsx: "",
    kcmc: "",
    xsfs: "all",
    sfxsbcxq: "1",
  });
  return `/kscj/cjcx_list?${query.toString()}`;
}

function buildFixedScoreTerms(): ScoreTermOption[] {
  const terms: ScoreTermOption[] = [];
  for (let start = 2029; start >= 2022; start -= 1) {
    const end = start + 1;
    terms.push({ value: `${start}-${end}-2`, label: `${start}-${end}-2` });
    terms.push({ value: `${start}-${end}-1`, label: `${start}-${end}-1` });
  }
  return terms;
}

function inferDefaultTerm(terms: ScoreTermOption[]): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const startYear = month >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const endYear = startYear + 1;
  const termNo = month >= 2 && month <= 7 ? 2 : 1;
  const inferred = `${startYear}-${endYear}-${termNo}`;

  if (terms.some((item) => item.value === inferred)) return inferred;
  return terms[0]?.value ?? "";
}

export async function loginToJw(studentId: string, password: string): Promise<LoginResult> {
  const loginPage = await jwRequest("/");
  const { scode, sxh } = extractLoginSeed(loginPage.text);

  const encoded = buildEncodedCredential(studentId, password, scode, sxh);
  const body = new URLSearchParams({
    loginMethod: "LoginToXk",
    userlanguage: "0",
    userAccount: studentId,
    userPassword: "",
    encoded,
  });

  const loginResult = await jwRequest("/xk/LoginToXk", {
    method: "POST",
    body,
    cookieHeader: loginPage.cookieHeader,
    referer: loginPage.finalUrl,
  });

  const loginMessage = parseLoginMessage(loginResult.text);
  if (loginMessage && !/请先登录系统/i.test(loginMessage)) {
    throw new JwError("INVALID_CREDENTIALS", loginMessage);
  }

  if (isLoginPage(loginResult.text)) {
    throw new JwError("INVALID_CREDENTIALS", "学号或密码错误，或账号当前不可登录");
  }

  return { cookieHeader: loginResult.cookieHeader };
}

export async function fetchStudentProfile(cookieHeader: string): Promise<StudentProfile> {
  const candidates = ["/framework/xsMainV_new.htmlx?t1=1", "/framework/xsMainV.jsp"];

  for (const path of candidates) {
    const response = await jwRequest(path, { cookieHeader });

    if (isLoginPage(response.text)) {
      throw new JwError("UNAUTHORIZED", "登录状态已失效");
    }

    const profile = parseProfileFromHtml(response.text);
    if (profile) return profile;
  }

  throw new JwError("JW_UNAVAILABLE", "未能从主页面解析到个人信息");
}

export async function fetchTimetable(cookieHeader: string, term: string): Promise<TimetableFetchResult> {
  const normalizedTerm = normalizeTerm(term);
  const candidates: Array<{ path: string; method?: "GET" | "POST"; body?: URLSearchParams }> = [
    { path: "/xskb/xskb_list.do?viweType=0", method: "GET" },
    { path: "/xskb/xskb_list.do", method: "GET" },
    { path: `/xskb/xskb_list.do?viweType=0&xnxq01id=${encodeURIComponent(normalizedTerm)}`, method: "GET" },
  ];

  for (const candidate of candidates) {
    const response = await jwRequest(candidate.path, {
      method: candidate.method ?? "GET",
      body: candidate.body,
      cookieHeader,
    });

    if (isLoginPage(response.text)) {
      throw new JwError("UNAUTHORIZED", "登录状态已失效");
    }

    if (!looksLikeTimetablePage(response.text)) continue;

    const resolvedTerm = parseSelectedTerm(response.text) ?? normalizedTerm;
    const courses = parseTimetableFromHtml(response.text, resolvedTerm);
    return { term: resolvedTerm, courses };
  }

  throw new JwError("JW_UNAVAILABLE", "未获取到可解析的课表页面，请稍后重试");
}

export async function fetchScores(cookieHeader: string, term?: string): Promise<ScoreFetchResult> {
  const frmPage = await jwRequest("/kscj/cjcx_frm", { cookieHeader });

  if (isLoginPage(frmPage.text)) {
    throw new JwError("UNAUTHORIZED", "登录状态已失效");
  }

  const pageTerms = parseScoreTermsFromHtml(frmPage.text);
  const fixedTerms = buildFixedScoreTerms();
  const terms = fixedTerms;

  const defaultTerm = inferDefaultTerm(terms);
  const selectedTerm = normalizeTerm(term || defaultTerm || pageTerms[0]?.value || "");

  if (!selectedTerm) {
    throw new JwError("JW_UNAVAILABLE", "未读取到可查询的开课时间");
  }

  const listRes = await jwRequest(buildScoreListPath(selectedTerm), {
    method: "GET",
    cookieHeader,
    referer: frmPage.finalUrl,
  });

  if (isLoginPage(listRes.text)) {
    throw new JwError("UNAUTHORIZED", "登录状态已失效");
  }

  const summaryRes = await jwRequest(buildScoreListPath(""), {
    method: "GET",
    cookieHeader,
    referer: frmPage.finalUrl,
  });

  let listPayload: unknown;
  let summaryPayload: unknown;

  try {
    listPayload = decodeJson<unknown>(listRes.text);
    summaryPayload = decodeJson<unknown>(summaryRes.text);
  } catch {
    throw new JwError("JW_UNAVAILABLE", "成绩接口返回格式异常");
  }

  const records = parseScoreRecordsFromJson(listPayload, selectedTerm);
  const summary = parseSummaryFromJson(summaryPayload);

  return {
    selectedTerm,
    terms,
    records,
    summary,
  };
}