export interface StudentProfile {
  name: string;
  studentId: string;
  className: string;
  major: string;
  college: string;
  displayName: string;
}

export interface TimetableCourse {
  id: string;
  name: string;
  teacher: string;
  location: string;
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  startSection: number;
  endSection: number;
  startTime?: string;
  endTime?: string;
  weeks: number[];
  term: string;
}

export interface TimetableResponse {
  term: string;
  generatedAt: string;
  profile: StudentProfile;
  courses: TimetableCourse[];
}
