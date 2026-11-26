import type { Metadata } from "next";
import { ArcadeView } from "@/components/arcade/arcade-view";

export const metadata: Metadata = {
  title: "Game Arcade — LUCOUS",
};

export default function StudentArcadePage() {
  return <ArcadeView />;
}
