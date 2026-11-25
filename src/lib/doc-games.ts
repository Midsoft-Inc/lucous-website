// Document / topic -> game (rule-based, no AI). Types + API helpers for the new
// /api/teacher/doc-games and /api/student/doc-games endpoints.
import { apiFetch } from "@/lib/api";

export type DocGameType = "QUIZ" | "TRUE_FALSE" | "FILL_BLANK" | "MATCH" | "ORDER" | "FLASHCARD";
export type DocGameDifficulty = "EASY" | "MEDIUM" | "HARD";

export const DOC_GAME_FORMATS: { id: DocGameType; label: string }[] = [
  { id: "FLASHCARD", label: "Flashcards" },
  { id: "QUIZ", label: "Quiz" },
  { id: "TRUE_FALSE", label: "True / False" },
  { id: "FILL_BLANK", label: "Fill the blank" },
  { id: "MATCH", label: "Match pairs" },
  { id: "ORDER", label: "Put in order" },
];

export interface DocGameItem {
  id: string;
  type: DocGameType;
  prompt?: string;
  options?: string[];
  hint?: string;
  front?: string;
  back?: string;
  terms?: { id: string; text: string }[];
  meanings?: { id: string; text: string }[];
  steps?: { id: string; text: string }[];
  // teacher preview only (answers included)
  correctIndex?: number;
  answer?: boolean | string;
  key?: Record<string, string>;
  correctOrder?: string[];
  explanation?: string;
}

export interface DocGameLevel {
  id: string;
  type: DocGameType;
  title: string;
  icon?: string;
  items: DocGameItem[];
}

export interface DocGameStats {
  levels: number;
  questions: number;
  maxXp: number;
}

export interface DocGameSummary {
  id: string;
  title: string;
  difficulty: DocGameDifficulty;
  sourceType: string;
  status: "DRAFT" | "PUBLISHED";
  accessCode: string | null;
  playCount: number;
  stats: DocGameStats | null;
  createdAt: string;
}

export interface DocGameFull extends DocGameSummary {
  levels: DocGameLevel[];
}

export interface PlayableDocGame {
  id: string;
  title: string;
  difficulty: DocGameDifficulty;
  rules: { lives: number; timeSec: number };
  stats: DocGameStats;
  levels: DocGameLevel[];
}

export type DocGameAnswer = number | boolean | string | Record<string, string> | string[];

export interface DocGameResultRow {
  id: string;
  type: DocGameType;
  correct: boolean;
  fraction: number;
  explanation?: string;
  correctIndex?: number;
  answer?: boolean | string;
  key?: Record<string, string>;
  correctOrder?: string[];
}

export interface DocGameSubmitResult {
  correct: number;
  total: number;
  score: number;
  xp: number;
  baseXp: number;
  bonusXp: number;
  xpMultiplier: number;
  dailyCapReached: boolean;
  bestStreak: number;
  perfect: boolean;
  badges: string[];
  totalXp: number;
  playerLevel: number;
  results: DocGameResultRow[];
}

export interface TeacherMaterialLite {
  id: string;
  originalName: string;
  fileType?: string;
  subjectName?: string | null;
  topicName?: string | null;
}

// ---- teacher ----
export const teacherDocGames = {
  materials: () => apiFetch<{ materials: TeacherMaterialLite[] }>("/teacher/materials"),
  list: () => apiFetch<{ games: DocGameSummary[] }>("/teacher/doc-games"),
  get: (id: string) => apiFetch<{ game: DocGameFull }>(`/teacher/doc-games/${id}`),
  generate: (body: {
    materialId: string;
    title?: string;
    difficulty?: DocGameDifficulty;
    formats?: DocGameType[];
    variant?: number;
    publish?: boolean;
  }) => apiFetch<{ game: DocGameFull }>("/teacher/doc-games/generate", { method: "POST", body }),
  update: (id: string, body: { title?: string; published?: boolean }) =>
    apiFetch<{ game: DocGameSummary }>(`/teacher/doc-games/${id}`, { method: "PATCH", body }),
  removeItem: (id: string, itemId: string) =>
    apiFetch<{ game: DocGameFull }>(`/teacher/doc-games/${id}/items/${itemId}`, { method: "DELETE" }),
  remove: (id: string) => apiFetch<{ success: boolean }>(`/teacher/doc-games/${id}`, { method: "DELETE" }),
};

// ---- student ----
export const studentDocGames = {
  open: (code: string) =>
    apiFetch<{ game: PlayableDocGame }>("/student/doc-games/open", { method: "POST", body: { code } }),
  fromTopic: (body: { topicId?: string; topicIds?: string[]; difficulty?: DocGameDifficulty; formats?: DocGameType[]; variant?: number }) =>
    apiFetch<{ game: PlayableDocGame }>("/student/doc-games/from-topic", { method: "POST", body }),
  fromText: (body: { title?: string; text: string; difficulty?: DocGameDifficulty; formats?: DocGameType[] }) =>
    apiFetch<{ game: PlayableDocGame }>("/student/doc-games/from-text", { method: "POST", body }),
  mine: () => apiFetch<{ games: DocGameSummary[] }>("/student/doc-games/mine"),
  get: (id: string) => apiFetch<{ game: PlayableDocGame }>(`/student/doc-games/${id}`),
  submit: (id: string, answers: Record<string, DocGameAnswer>, code?: string) =>
    apiFetch<DocGameSubmitResult>(`/student/doc-games/${id}/submit`, { method: "POST", body: { answers, code } }),
};
