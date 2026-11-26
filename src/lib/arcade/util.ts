export function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Shared look for tappable cards inside the games (uses the app's theme tokens).
export const CARD_BASE =
  "w-full rounded-xl border-2 bg-card px-3.5 py-3 text-left text-sm font-semibold leading-snug transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default";
export const CARD_IDLE = "border-border hover:border-primary";
export const CARD_PICK = "border-primary bg-primary/10";
export const CARD_GOOD = "border-emerald-500 bg-emerald-500/15";
export const CARD_BAD = "border-red-500 bg-red-500/15";
