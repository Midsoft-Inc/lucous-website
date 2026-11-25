import type { Metadata } from "next";
import { DocGamesView } from "@/components/student/doc-games-view";

export const metadata: Metadata = {
  title: "Study Games — LUCOUS",
};

export default function StudentDocGamesPage() {
  return <DocGamesView />;
}
