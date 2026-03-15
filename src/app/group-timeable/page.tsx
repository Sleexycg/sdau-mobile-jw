import type { Metadata } from "next";

import { GroupTimetableClient } from "@/components/group-timetable-client";

export const metadata: Metadata = {
  title: "课伴-ClassLoom",
};

export default function GroupTimeablePage() {
  return (
    <main className="main-shell">
      <GroupTimetableClient />
    </main>
  );
}
