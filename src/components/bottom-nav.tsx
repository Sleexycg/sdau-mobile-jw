"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface BottomNavProps {
  active?: "timetable" | "course-scores" | "grade-exams" | "empty-rooms";
}

function hasExpandedPanels(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(document.querySelector('.inline-select-panel.open, .term-dropdown-panel.open, [data-expand-state="open"]'));
}

export function BottomNav({ active }: BottomNavProps) {
  const [sunk, setSunk] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const prevSunkRef = useRef(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let rafId = 0;
    let sinkTimer = 0;

    const refreshState = () => {
      const y = window.scrollY;
      const expanded = hasExpandedPanels();
      const delta = y - lastY;

      if (expanded) {
        setSunk(true);
        lastY = y;
        return;
      }

      if (delta > 0.5) {
        setSunk(true);
        window.clearTimeout(sinkTimer);
        sinkTimer = window.setTimeout(() => {
          if (!hasExpandedPanels()) setSunk(false);
        }, 220);
      } else if (delta < -0.5) {
        window.clearTimeout(sinkTimer);
        setSunk(false);
      }

      lastY = y;
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        refreshState();
      });
    };

    const observer = new MutationObserver(() => refreshState());
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "data-expand-state"],
    });

    refreshState();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.clearTimeout(sinkTimer);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const prev = prevSunkRef.current;
    prevSunkRef.current = sunk;

    if (prev && !sunk) {
      setReleasing(true);
      const timer = window.setTimeout(() => setReleasing(false), 520);
      return () => window.clearTimeout(timer);
    }
  }, [sunk]);

  return (
    <nav className={`bottom-nav ${sunk ? "is-sunk" : ""} ${releasing ? "is-releasing" : ""}`} aria-label="底部导航">
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
