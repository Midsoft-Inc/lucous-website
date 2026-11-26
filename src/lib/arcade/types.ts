// Game Arcade: prebuilt games for classes 1-10.
// A game = one TEMPLATE (how it plays) + CONTENT (what it asks). Adding a new
// chapter or class is only a new entry in games.ts, no new component needed.

export type TemplateId = "MATCH" | "QUIZ" | "ORDER";

export interface GameBase {
  id: string;
  title: string;
  subject: string;
  fromGrade: number; // first class this game suits (1-10)
  toGrade: number; // last class this game suits (1-10)
  emoji: string;
  blurb: string;
}

export interface MatchGame extends GameBase {
  template: "MATCH";
  rounds: { title: string; pairs: [string, string][] }[];
}

export interface QuizGame extends GameBase {
  template: "QUIZ";
  secondsPerQuestion: number;
  questions: { q: string; options: string[]; answer: number; why: string }[];
}

// Steps are written in the CORRECT order; the player sees them shuffled.
export interface OrderGame extends GameBase {
  template: "ORDER";
  rounds: { title: string; prompt: string; steps: string[] }[];
}

export type ArcadeGame = MatchGame | QuizGame | OrderGame;

// What every template receives from the arcade shell.
export interface TemplateProps<G extends ArcadeGame> {
  game: G;
  onCorrect: () => void; // one right answer / pair / step
  onWrong: () => void; // costs a life
  onComplete: () => void; // every round finished
}

export const TEMPLATE_LABEL: Record<TemplateId, string> = {
  MATCH: "Match pairs",
  QUIZ: "Quiz race",
  ORDER: "Put in order",
};

/** How many right answers it takes to finish the game (used for the progress bar). */
export function countTargets(game: ArcadeGame): number {
  if (game.template === "MATCH") return game.rounds.reduce((n, r) => n + r.pairs.length, 0);
  if (game.template === "QUIZ") return game.questions.length;
  return game.rounds.reduce((n, r) => n + r.steps.length, 0);
}
