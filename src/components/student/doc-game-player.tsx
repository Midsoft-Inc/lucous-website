"use client";

import * as React from "react";
import { CheckCircle2, XCircle, Clock, Flame, Trophy, Loader2, ArrowUp, ArrowDown, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import {
  studentDocGames,
  type DocGameAnswer,
  type DocGameItem,
  type DocGameResultRow,
  type DocGameSubmitResult,
  type PlayableDocGame,
} from "@/lib/doc-games";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const BADGE_LABEL: Record<string, string> = {
  PERFECT_SCORE: "Perfect score",
  STREAK_5: "5 in a row",
  TOP_SCORER: "Top scorer",
};

interface FlatItem extends DocGameItem {
  levelTitle: string;
  levelIcon?: string;
  levelNo: number;
  levelCount: number;
}

function flatten(game: PlayableDocGame): FlatItem[] {
  const out: FlatItem[] = [];
  game.levels.forEach((l, li) => {
    l.items.forEach((it) =>
      out.push({ ...it, type: it.type ?? l.type, levelTitle: l.title, levelIcon: l.icon, levelNo: li + 1, levelCount: game.levels.length })
    );
  });
  return out;
}

export function DocGamePlayer({
  game,
  code,
  onExit,
}: {
  game: PlayableDocGame;
  /** teacher's game code (required to submit a teacher game) */
  code?: string;
  onExit: () => void;
}) {
  const items = React.useMemo(() => flatten(game), [game]);
  const [idx, setIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, DocGameAnswer>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<DocGameSubmitResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [runKey, setRunKey] = React.useState(0);

  const item = items[idx];
  const answered = items.filter((i) => i.type !== "FLASHCARD");

  async function finish(finalAnswers: Record<string, DocGameAnswer>) {
    setSubmitting(true);
    setError(null);
    try {
      const r = await studentDocGames.submit(game.id, finalAnswers, code);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit your answers.");
    } finally {
      setSubmitting(false);
    }
  }

  function advance(value?: DocGameAnswer) {
    const next = value === undefined ? answers : { ...answers, [item.id]: value };
    setAnswers(next);
    if (idx + 1 >= items.length) {
      void finish(next);
    } else {
      setIdx(idx + 1);
    }
  }

  function restart() {
    setIdx(0);
    setAnswers({});
    setResult(null);
    setError(null);
    setRunKey((k) => k + 1);
  }

  if (result) {
    return <DocGameResult game={game} result={result} onAgain={restart} onExit={onExit} />;
  }

  if (submitting || (error && idx + 1 >= items.length)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          {submitting ? (
            <>
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Checking your answers…</p>
            </>
          ) : (
            <>
              <p className="text-sm text-destructive">{error}</p>
              <div className="flex gap-2">
                <Button onClick={() => void finish(answers)}>Try again</Button>
                <Button variant="outline" onClick={onExit}>Leave</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!item) {
    return <p className="text-sm text-muted-foreground">This game has no questions.</p>;
  }

  const pct = Math.round((idx / items.length) * 100);

  return (
    <div className="grid gap-4" key={runKey}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-semibold">{game.title}</h2>
          <p className="text-xs text-muted-foreground">
            Level {item.levelNo}/{item.levelCount} · {item.levelIcon} {item.levelTitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Up to {game.stats.maxXp} XP</Badge>
          <Button variant="ghost" size="sm" onClick={onExit}>Quit</Button>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ItemCard
        key={item.id}
        item={item}
        timeSec={item.type === "FLASHCARD" ? 0 : game.rules.timeSec * (item.type === "MATCH" || item.type === "ORDER" ? 3 : 1)}
        number={idx + 1}
        total={items.length}
        onDone={advance}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        {answered.length} scored questions · answers are checked when you finish.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
function ItemCard({
  item,
  timeSec,
  number,
  total,
  onDone,
}: {
  item: FlatItem;
  timeSec: number;
  number: number;
  total: number;
  onDone: (value?: DocGameAnswer) => void;
}) {
  const [left, setLeft] = React.useState(timeSec);
  const valueRef = React.useRef<DocGameAnswer | undefined>(undefined);
  const [value, setValueState] = React.useState<DocGameAnswer | undefined>(undefined);
  const doneRef = React.useRef(false);

  function setValue(v: DocGameAnswer | undefined) {
    valueRef.current = v;
    setValueState(v);
  }

  const finish = React.useCallback(
    (v?: DocGameAnswer) => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone(v);
    },
    [onDone]
  );

  React.useEffect(() => {
    if (!timeSec) return;
    const t = window.setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          window.clearInterval(t);
          // time is up: submit whatever the player has so far
          window.setTimeout(() => finish(valueRef.current), 0);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [timeSec, finish]);

  const canNext = item.type === "FLASHCARD" || value !== undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardDescription>
            Question {number} of {total}
          </CardDescription>
          {timeSec ? (
            <span className={cn("inline-flex items-center gap-1 text-sm font-medium", left <= 5 && "text-destructive")}>
              <Clock className="size-4" /> {left}s
            </span>
          ) : null}
        </div>
        {item.type !== "FLASHCARD" ? (
          <CardTitle className="whitespace-pre-line text-base font-medium leading-relaxed">{item.prompt}</CardTitle>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        {item.type === "FLASHCARD" ? <Flashcard item={item} /> : null}
        {item.type === "QUIZ" ? <QuizBody item={item} value={value as number | undefined} onChange={setValue} /> : null}
        {item.type === "TRUE_FALSE" ? <TrueFalseBody value={value as boolean | undefined} onChange={setValue} /> : null}
        {item.type === "FILL_BLANK" ? <FillBody item={item} value={value as string | undefined} onChange={setValue} /> : null}
        {item.type === "MATCH" ? <MatchBody item={item} value={value as Record<string, string> | undefined} onChange={setValue} /> : null}
        {item.type === "ORDER" ? <OrderBody item={item} value={value as string[] | undefined} onChange={setValue} /> : null}

        <div className="flex justify-end">
          <Button disabled={!canNext} onClick={() => finish(item.type === "FLASHCARD" ? undefined : valueRef.current)}>
            {number >= total ? "Finish" : "Next"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Flashcard({ item }: { item: DocGameItem }) {
  const [flipped, setFlipped] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      className="min-h-36 w-full rounded-xl border bg-muted/40 p-5 text-left transition-colors hover:bg-muted"
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{flipped ? "Answer" : "Tap to reveal"}</p>
      <p className="mt-2 whitespace-pre-line text-base font-medium">{flipped ? item.back : item.front}</p>
    </button>
  );
}

function QuizBody({ item, value, onChange }: { item: DocGameItem; value?: number; onChange: (v: number) => void }) {
  return (
    <div className="grid gap-2">
      {(item.options ?? []).map((o, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={cn(
            "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted",
            value === i && "border-primary bg-primary/10 font-medium"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function TrueFalseBody({ value, onChange }: { value?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[true, false].map((b) => (
        <button
          key={String(b)}
          type="button"
          onClick={() => onChange(b)}
          className={cn(
            "rounded-lg border px-3 py-3 text-sm font-medium transition-colors hover:bg-muted",
            value === b && "border-primary bg-primary/10"
          )}
        >
          {b ? "True" : "False"}
        </button>
      ))}
    </div>
  );
}

function FillBody({ item, value, onChange }: { item: DocGameItem; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      {item.hint ? <p className="font-mono text-sm text-muted-foreground">{item.hint}</p> : null}
      <input
        className={selectClass}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type the missing word"
        autoComplete="off"
      />
    </div>
  );
}

function MatchBody({
  item,
  value,
  onChange,
}: {
  item: DocGameItem;
  value?: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  const current = value ?? {};
  const terms = item.terms ?? [];
  return (
    <div className="grid gap-3">
      {terms.map((t) => (
        <div key={t.id} className="grid gap-1">
          <p className="text-sm font-medium">{t.text}</p>
          <select
            className={selectClass}
            value={current[t.id] ?? ""}
            onChange={(e) => {
              const next = { ...current };
              if (e.target.value) next[t.id] = e.target.value;
              else delete next[t.id];
              onChange(next);
            }}
          >
            <option value="">Choose the meaning…</option>
            {(item.meanings ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.text}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function OrderBody({
  item,
  value,
  onChange,
}: {
  item: DocGameItem;
  value?: string[];
  onChange: (v: string[]) => void;
}) {
  const steps = item.steps ?? [];
  // Start from the shuffled order the server sent; any move marks the answer as given.
  const order = value ?? steps.map((s) => s.id);
  const byId = new Map(steps.map((s) => [s.id, s.text]));

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  React.useEffect(() => {
    if (!value) onChange(order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ol className="grid gap-2">
      {order.map((id, i) => (
        <li key={id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <span className="w-5 shrink-0 text-muted-foreground">{i + 1}.</span>
          <span className="flex-1">{byId.get(id)}</span>
          <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
            <ArrowUp className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
            <ArrowDown className="size-4" />
          </Button>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
function describeRight(row: DocGameResultRow, item?: DocGameItem): string | null {
  if (!item) return null;
  switch (row.type) {
    case "QUIZ":
      return typeof row.correctIndex === "number" ? item.options?.[row.correctIndex] ?? null : null;
    case "TRUE_FALSE":
      return row.answer === true ? "True" : row.answer === false ? "False" : null;
    case "FILL_BLANK":
      return typeof row.answer === "string" ? row.answer : null;
    case "MATCH":
      return row.key
        ? (item.terms ?? [])
            .map((t) => `${t.text} → ${item.meanings?.find((m) => m.id === row.key![t.id])?.text ?? ""}`)
            .join("\n")
        : null;
    case "ORDER":
      return row.correctOrder
        ? row.correctOrder.map((id, i) => `${i + 1}. ${item.steps?.find((s) => s.id === id)?.text ?? ""}`).join("\n")
        : null;
    default:
      return null;
  }
}

function DocGameResult({
  game,
  result,
  onAgain,
  onExit,
}: {
  game: PlayableDocGame;
  result: DocGameSubmitResult;
  onAgain: () => void;
  onExit: () => void;
}) {
  const byId = React.useMemo(() => {
    const m = new Map<string, DocGameItem>();
    game.levels.forEach((l) => l.items.forEach((i) => m.set(i.id, i)));
    return m;
  }, [game]);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="items-center text-center">
          <Trophy className="size-8 text-primary" />
          <CardTitle className="text-xl">
            {result.perfect ? "Perfect run!" : result.score >= 80 ? "Great job!" : result.score >= 50 ? "Nice effort" : "Keep going"}
          </CardTitle>
          <CardDescription>
            {result.correct} of {result.total} correct · {Math.round(result.score)}%
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-lg font-semibold">+{result.xp}</p>
              <p className="text-xs text-muted-foreground">XP earned</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="flex items-center justify-center gap-1 text-lg font-semibold">
                <Flame className="size-4" /> {result.bestStreak}
              </p>
              <p className="text-xs text-muted-foreground">Best streak</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-lg font-semibold">Lv {result.playerLevel}</p>
              <p className="text-xs text-muted-foreground">{result.totalXp} XP total</p>
            </div>
          </div>
          {result.badges.length ? (
            <div className="flex flex-wrap justify-center gap-2">
              {result.badges.map((b) => (
                <Badge key={b}>
                  <Sparkles className="mr-1 size-3" />
                  {BADGE_LABEL[b] ?? b}
                </Badge>
              ))}
            </div>
          ) : null}
          {result.xpMultiplier < 1 || result.dailyCapReached ? (
            <p className="text-center text-xs text-muted-foreground">
              {result.dailyCapReached
                ? "You reached today's XP limit for self-made games."
                : "Replays and self-made games earn reduced XP."}
            </p>
          ) : null}
          <div className="flex justify-center gap-2">
            <Button onClick={onAgain}>
              <RotateCcw className="size-4" /> Play again
            </Button>
            <Button variant="outline" onClick={onExit}>
              Back
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Review</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {result.results.map((row, i) => {
            const item = byId.get(row.id);
            const right = describeRight(row, item);
            return (
              <div key={row.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start gap-2">
                  {row.correct ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <div className="grid gap-1">
                    <p className="whitespace-pre-line font-medium">
                      {i + 1}. {item?.prompt}
                    </p>
                    {!row.correct && right ? (
                      <p className="whitespace-pre-line text-muted-foreground">Correct: {right}</p>
                    ) : null}
                    {row.explanation ? (
                      <p className="whitespace-pre-line text-xs text-muted-foreground">{row.explanation}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
