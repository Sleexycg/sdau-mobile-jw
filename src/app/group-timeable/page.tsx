import type { Metadata } from "next";

import { GroupTimetableClient } from "@/components/group-timetable-client";

export const metadata: Metadata = {
  title: "群友共享课程表",
};

export default function GroupTimeablePage() {
  return (
    <main className="main-shell">
      <GroupTimetableClient />
    </main>
  );
}
