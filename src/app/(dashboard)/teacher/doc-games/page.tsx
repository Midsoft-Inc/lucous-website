import type { Metadata } from "next";
import { RequireRole } from "@/components/auth/require-role";
import { DocGamesPanel } from "@/components/teacher/doc-games-panel";

export const metadata: Metadata = {
  title: "Document Games — Teacher Dashboard — LUCOUS",
};

export default function TeacherDocGamesPage() {
  return (
    <RequireRole role="teacher" title="Teacher">
      <div className="space-y-6">
        <DocGamesPanel />
      </div>
    </RequireRole>
  );
}
