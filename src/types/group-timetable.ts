import type { TimetableCourse } from "@/types/timetable";

export interface GroupMemberTimetable {
  id: string;
  nickname: string;
  source: "wakeup" | "manual";
  importedAt: string;
  semesterStart?: string;
  courses: TimetableCourse[];
}

export interface GroupSlotItem {
  memberId: string;
  nickname: string;
  courseName: string;
  teacher: string;
  location: string;
}
