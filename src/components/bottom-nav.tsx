"use client";

import Link from "next/link";

interface BottomNavProps {
  active: "timetable" | "scores";
}

export function BottomNav({ active }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="底部导航">
      <Link className={active === "timetable" ? "active" : ""} href="/timetable">
        课表
      </Link>
      <Link className={active === "scores" ? "active" : ""} href="/scores">
        成绩
      </Link>
    </nav>
  );
}