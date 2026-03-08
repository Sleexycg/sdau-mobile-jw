import type { StudentProfile } from "@/types/timetable";

export interface TrainingPlanItem {
  id: string;
  category: string;
  requiredCredits: string;
  completedCredits: string;
  currentCredits: string;
  remainingCredits: string;
  subjects?: string[];
}

export interface TrainingPlanSummary {
  requiredCredits: string;
  completedCredits: string;
  currentCredits: string;
  remainingCredits: string;
}

export interface TrainingPlanResponse {
  profile: StudentProfile;
  items: TrainingPlanItem[];
  summary: TrainingPlanSummary;
  generatedAt: string;
}
