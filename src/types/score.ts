import type { StudentProfile } from "@/types/timetable";

export interface ScoreTermOption {
  value: string;
  label: string;
}

export interface ScoreRecord {
  id: string;
  courseCode: string;
  courseName: string;
  credit: string;
  score: string;
  gpa: string;
  studentIdRaw: string;
  teachingTaskId: string;
  scoreRecordId: string;
}

export interface UsualScoreDetail {
  usualScore: string;
  usualRatio: string;
  finalScore: string;
  finalRatio: string;
  totalScore: string;
}

export interface GradeExamRecord {
  id: string;
  sequence: string;
  examCourse: string;
  score: string;
  examTime: string;
  examCategory?: string;
}

export interface CourseScoreSummary {
  avgScore: string;
  avgCreditGpa: string;
  courseCount: number;
  totalCredits: string;
}

export interface CourseScoreResponse {
  profile: StudentProfile;
  selectedTerm: string;
  terms: ScoreTermOption[];
  records: ScoreRecord[];
  summary: CourseScoreSummary;
  generatedAt: string;
}

export interface GradeExamResponse {
  profile: StudentProfile;
  records: GradeExamRecord[];
  generatedAt: string;
}
