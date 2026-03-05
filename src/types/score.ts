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
}

export interface ScoreSummary {
  avgScore: string;
  avgCreditGpa: string;
  courseCount: number;
  totalCredits: string;
}

export interface ScoreResponse {
  profile: StudentProfile;
  selectedTerm: string;
  terms: ScoreTermOption[];
  records: ScoreRecord[];
  summary: ScoreSummary;
  generatedAt: string;
}