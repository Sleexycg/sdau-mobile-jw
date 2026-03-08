import type { CourseScoreResponse, GradeExamRecord, GradeExamResponse, ScoreRecord, ScoreTermOption } from "@/types/score";
import type { TrainingPlanResponse } from "@/types/training-plan";
import type { CampusName, EmptyRoomQuery, EmptyRoomResponse } from "@/types/empty-room";
import type { StudentProfile, TimetableCourse, TimetableResponse } from "@/types/timetable";

export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD = "admin";

const MOCK_TERM = "2025-2026-2";
const MOCK_WEEK = 1;

const mockProfile: StudentProfile = {
  name: "测试管理员",
  studentId: "admin",
  className: "计算机2501",
  major: "软件工程",
  college: "信息科学与工程学院",
  displayName: "测试管理员-admin",
};

const allWeeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

const mockTimetableCourses: TimetableCourse[] = [
  { id: "m1", name: "高等数学A1", teacher: "杨老师", location: "N201", weekday: 1, startSection: 1, endSection: 1, weeks: allWeeks, term: MOCK_TERM },
  { id: "m2", name: "高等数学A1", teacher: "杨老师", location: "N201", weekday: 3, startSection: 1, endSection: 1, weeks: allWeeks, term: MOCK_TERM },

  { id: "m3", name: "大学英语B1", teacher: "高老师", location: "W205", weekday: 2, startSection: 2, endSection: 2, weeks: allWeeks, term: MOCK_TERM },
  { id: "m4", name: "大学英语B1", teacher: "高老师", location: "W205", weekday: 5, startSection: 2, endSection: 2, weeks: allWeeks, term: MOCK_TERM },

  { id: "m5", name: "毛泽东思想和中国特色社会主义理论体系概论", teacher: "孙老师", location: "E608", weekday: 3, startSection: 3, endSection: 3, weeks: allWeeks, term: MOCK_TERM },
  { id: "m6", name: "理论力学", teacher: "岳老师", location: "5N101", weekday: 4, startSection: 1, endSection: 1, weeks: allWeeks, term: MOCK_TERM },

  { id: "m7", name: "初级会计学", teacher: "苏老师", location: "21#202", weekday: 5, startSection: 4, endSection: 4, weeks: allWeeks, term: MOCK_TERM },

  { id: "m8", name: "无机化学", teacher: "赵老师", location: "S111", weekday: 2, startSection: 3, endSection: 3, weeks: allWeeks, term: MOCK_TERM },
  { id: "m9", name: "无机化学", teacher: "赵老师", location: "S111", weekday: 4, startSection: 3, endSection: 3, weeks: allWeeks, term: MOCK_TERM },

  { id: "m10", name: "生物化学", teacher: "刘老师", location: "19#203", weekday: 1, startSection: 4, endSection: 4, weeks: allWeeks, term: MOCK_TERM },
  { id: "m11", name: "生物化学", teacher: "刘老师", location: "19#203", weekday: 5, startSection: 1, endSection: 1, weeks: allWeeks, term: MOCK_TERM },
];

const scoreTerms: ScoreTermOption[] = [
  { value: "2025-2026-2", label: "2025-2026-2" },
  { value: "2025-2026-1", label: "2025-2026-1" },
  { value: "2024-2025-2", label: "2024-2025-2" },
];

const scoreByTerm: Record<string, ScoreRecord[]> = {
  "2025-2026-2": [
    { id: "s1", courseCode: "MA101", courseName: "高等数学A1", credit: "4", score: "88", gpa: "3.8", studentIdRaw: "admin", teachingTaskId: "mock-jx-1", scoreRecordId: "mock-cj-1" },
    { id: "s2", courseCode: "EN101", courseName: "大学英语B1", credit: "3", score: "91", gpa: "4.1", studentIdRaw: "admin", teachingTaskId: "mock-jx-2", scoreRecordId: "mock-cj-2" },
    { id: "s3", courseCode: "PL101", courseName: "毛泽东思想和中国特色社会主义理论体系概论", credit: "3", score: "84", gpa: "3.4", studentIdRaw: "admin", teachingTaskId: "mock-jx-3", scoreRecordId: "mock-cj-3" },
    { id: "s4", courseCode: "ME101", courseName: "理论力学", credit: "3", score: "59", gpa: "0.0", studentIdRaw: "admin", teachingTaskId: "mock-jx-4", scoreRecordId: "mock-cj-4" },
    { id: "s5", courseCode: "AC101", courseName: "初级会计学", credit: "2", score: "86", gpa: "3.6", studentIdRaw: "admin", teachingTaskId: "mock-jx-5", scoreRecordId: "mock-cj-5" },
    { id: "s6", courseCode: "CH101", courseName: "无机化学", credit: "3", score: "82", gpa: "3.2", studentIdRaw: "admin", teachingTaskId: "mock-jx-6", scoreRecordId: "mock-cj-6" },
    { id: "s7", courseCode: "BC101", courseName: "生物化学", credit: "3", score: "89", gpa: "3.9", studentIdRaw: "admin", teachingTaskId: "mock-jx-7", scoreRecordId: "mock-cj-7" },
  ],
  "2025-2026-1": [
    { id: "s8", courseCode: "PE001", courseName: "体育", credit: "1", score: "92", gpa: "4.2", studentIdRaw: "admin", teachingTaskId: "mock-jx-8", scoreRecordId: "mock-cj-8" },
  ],
  "2024-2025-2": [
    { id: "s9", courseCode: "CS001", courseName: "程序设计基础", credit: "3", score: "82", gpa: "3.2", studentIdRaw: "admin", teachingTaskId: "mock-jx-9", scoreRecordId: "mock-cj-9" },
  ],
};

const mockGradeExams: GradeExamRecord[] = [
  { id: "g1", sequence: "1", examCourse: "大学英语四六级(大学英语四级考试)", score: "481", examTime: "2025-06-01", examCategory: "大学英语四六级" },
  { id: "g2", sequence: "2", examCourse: "全国计算机等级考试（二级）", score: "合格", examTime: "2025-09-20" },
];

const roomPool: Record<CampusName, string[]> = {
  岱宗校区: ["5N101", "5N102", "5N201", "5S303", "5S305", "北校12号楼410", "北校12号楼411"],
  泮河校区: ["19#101", "19#203", "7#501", "8#302", "中央主楼201"],
  西北片区: ["21#101", "21#202", "22#102", "22#305", "22#401"],
};

function toNumberScore(score: string): number | null {
  const n = Number.parseFloat(score);
  return Number.isFinite(n) ? n : null;
}

function average(values: number[]): string {
  if (values.length === 0) return "-";
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 131 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function isAdminCredential(studentId: string, password: string): boolean {
  return studentId === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export function buildMockTimetableResponse(term?: string): TimetableResponse {
  const resolvedTerm = term && /^\d{4}-\d{4}-[12]$/.test(term) ? term : MOCK_TERM;
  const courses = mockTimetableCourses.map((item) => ({ ...item, term: resolvedTerm }));
  return {
    term: resolvedTerm,
    generatedAt: new Date().toISOString(),
    profile: mockProfile,
    courses,
  };
}

export function buildMockCourseScoreResponse(term?: string): CourseScoreResponse {
  const selectedTerm = term && scoreByTerm[term] ? term : scoreTerms[0].value;
  const records = scoreByTerm[selectedTerm] ?? [];
  const numericScores = records.map((item) => toNumberScore(item.score)).filter((n): n is number => n !== null);
  const numericGpa = records.map((item) => Number.parseFloat(item.gpa)).filter((n) => Number.isFinite(n));
  const totalCredits = records
    .map((item) => Number.parseFloat(item.credit))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => a + b, 0);

  return {
    profile: mockProfile,
    selectedTerm,
    terms: scoreTerms,
    records,
    summary: {
      avgScore: average(numericScores),
      avgCreditGpa: average(numericGpa),
      courseCount: records.length,
      totalCredits: totalCredits.toFixed(1).replace(/\.0$/, ""),
    },
    generatedAt: new Date().toISOString(),
  };
}

export function buildMockGradeExamResponse(): GradeExamResponse {
  return {
    profile: mockProfile,
    records: mockGradeExams,
    generatedAt: new Date().toISOString(),
  };
}

export function buildMockEmptyRoomContext(): { term: string; week: number } {
  return { term: MOCK_TERM, week: MOCK_WEEK };
}

export function buildMockEmptyRooms(query: EmptyRoomQuery): EmptyRoomResponse {
  const pool = roomPool[query.campus] ?? [];
  const rooms = pool
    .filter((room) => hashSeed(`${query.campus}-${query.weekday}-${query.sectionCode}-${room}`) % 3 !== 0)
    .map((room, idx) => ({ id: `mock-room-${idx}-${query.weekday}-${query.sectionCode}`, campus: query.campus, roomName: room }));

  return {
    query,
    term: MOCK_TERM,
    week: MOCK_WEEK,
    total: rooms.length,
    rooms,
  };
}

export function buildMockUsualScoreDetail(totalScore: string) {
  return {
    usualScore: "88",
    usualRatio: "50%",
    finalScore: "94",
    finalRatio: "50%",
    totalScore: totalScore || "91",
  };
}

export function getMockProfile(): StudentProfile {
  return mockProfile;
}

export function buildMockTrainingPlanResponse(): TrainingPlanResponse {
  const items = [
    { id: "tp-1", category: "专业方向课", requiredCredits: "19.0", completedCredits: "4.0", currentCredits: "0.0", remainingCredits: "15.0", subjects: ["2025-2026-1 | XF002003 | Java语言程序设计实验 | 1学分 | 已修读"] },
    { id: "tp-2", category: "专业核心课", requiredCredits: "16.0", completedCredits: "4.5", currentCredits: "4.5", remainingCredits: "7.0" },
    { id: "tp-3", category: "学科基础课组", requiredCredits: "59.5", completedCredits: "41.5", currentCredits: "9.0", remainingCredits: "9.0" },
    { id: "tp-4", category: "实践教学环节", requiredCredits: "30.5", completedCredits: "7.0", currentCredits: "4.1", remainingCredits: "19.4", subjects: ["2025-2026-1 | BS000101 | 金工实习 | 2学分 | 已修读"] },
    { id: "tp-5", category: "通识必修课", requiredCredits: "38.0", completedCredits: "31.0", currentCredits: "4.0", remainingCredits: "3.0" },
    { id: "tp-6", category: "耕读教育类", requiredCredits: "2.0", completedCredits: "2.0", currentCredits: "0.0", remainingCredits: "0.0" },
    { id: "tp-7", category: "其它", requiredCredits: "0.0", completedCredits: "0.0", currentCredits: "0.0", remainingCredits: "0.0" },
    { id: "tp-8", category: "四史教育类", requiredCredits: "1.0", completedCredits: "1.0", currentCredits: "0.0", remainingCredits: "0.0" },
    { id: "tp-9", category: "体育健康类", requiredCredits: "2.0", completedCredits: "0.0", currentCredits: "1.0", remainingCredits: "1.0" },
    { id: "tp-10", category: "艺术审美类", requiredCredits: "2.0", completedCredits: "2.0", currentCredits: "0.0", remainingCredits: "0.0" },
  ];

  return {
    profile: mockProfile,
    items,
    summary: {
      requiredCredits: "170.0",
      completedCredits: "93.0",
      currentCredits: "22.6",
      remainingCredits: "54.4",
    },
    generatedAt: new Date().toISOString(),
  };
}

