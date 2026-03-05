"use client";

import Link from "next/link";

interface BottomNavProps {
  active: "timetable" | "course-scores" | "grade-exams" | "empty-rooms";
}

export function BottomNav({ active }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="底部导航">
      <Link className={active === "timetable" ? "active" : ""} href="/timetable">
        课表
      </Link>
      <Link className={active === "course-scores" ? "active" : ""} href="/scores">
        课程成绩
      </Link>
      <Link className={active === "grade-exams" ? "active" : ""} href="/grade-exams">
        等级考试
      </Link>
      <Link className={active === "empty-rooms" ? "active" : ""} href="/empty-rooms">
        空教室
      </Link>
    </nav>
  );
}
