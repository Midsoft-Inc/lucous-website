// Token wallet for the Game Arcade.
// PHASE 1: stored in this browser (localStorage), per student account.
// Next step: move to a server-side ledger so tokens cannot be edited and follow
// the student across devices (the shape below maps 1:1 to that).

export interface ArcadeWallet {
  tokens: number;
  xp: number;
  plays: number;
  best: Record<string, number>; // gameId -> best stars (1-3)
  wins: Record<string, number>; // gameId -> times completed
  daily: { date: string; tokens: number };
}

export const DAILY_TOKEN_CAP = 100;
export const REPLAY_MULTIPLIER = 0.25;

const keyFor = (uid: string) => `lucous-arcade:v1:${uid}`;
const today = () => new Date().toISOString().slice(0, 10);

const empty = (): ArcadeWallet => ({
  tokens: 0,
  xp: 0,
  plays: 0,
  best: {},
  wins: {},
  daily: { date: today(), tokens: 0 },
});

export function loadWallet(uid: string): ArcadeWallet {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(keyFor(uid));
    if (!raw) return empty();
    const w = { ...empty(), ...JSON.parse(raw) } as ArcadeWallet;
    if (w.daily?.date !== today()) w.daily = { date: today(), tokens: 0 };
    return w;
  } catch {
    return empty();
  }
}

function saveWallet(uid: string, w: ArcadeWallet) {
  try {
    window.localStorage.setItem(keyFor(uid), JSON.stringify(w));
  } catch {
    /* storage full or blocked: the game still works, it just will not be remembered */
  }
}

export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;

export interface RunResult {
  won: boolean; // finished every round (false = ran out of lives)
  correct: number;
  total: number;
  mistakes: number;
}

export interface Reward {
  stars: number; // 0 when the game was not finished
  perfect: boolean;
  tokens: number; // actually added to the wallet
  xp: number;
  replay: boolean;
  capped: boolean;
  wallet: ArcadeWallet;
}

export function starsFor(r: RunResult): number {
  if (!r.won) return 0;
  const three = Math.max(1, Math.floor(r.total * 0.1));
  const two = Math.max(3, Math.floor(r.total * 0.3));
  return r.mistakes <= three ? 3 : r.mistakes <= two ? 2 : 1;
}

/** Works out the reward for one finished run and saves it. */
export function applyRun(uid: string, gameId: string, r: RunResult): Reward {
  const w = loadWallet(uid);
  const stars = starsFor(r);
  const perfect = r.won && r.mistakes === 0;
  const replay = (w.wins[gameId] || 0) > 0;
  const mult = replay ? REPLAY_MULTIPLIER : 1;

  // Ran out of lives: XP for what was right, but no tokens.
  const baseTokens = r.won ? r.correct * 2 + stars * 3 + (perfect ? 5 : 0) : 0;
  const baseXp = r.correct * 10 + (r.won ? 20 : 0);

  let tokens = Math.round(baseTokens * mult);
  const room = Math.max(0, DAILY_TOKEN_CAP - w.daily.tokens);
  const capped = tokens > room;
  if (capped) tokens = room;
  const xp = Math.round(baseXp * mult);

  w.tokens += tokens;
  w.xp += xp;
  w.plays += 1;
  w.daily.tokens += tokens;
  if (r.won) {
    w.wins[gameId] = (w.wins[gameId] || 0) + 1;
    w.best[gameId] = Math.max(w.best[gameId] || 0, stars);
  }
  saveWallet(uid, w);
  return { stars, perfect, tokens, xp, replay, capped, wallet: w };
}
