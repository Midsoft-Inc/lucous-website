"use client";

import * as React from "react";
import { cn } from "cn";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { RequireStudent } from "@/components/student/require-student";
import { Button, buttonVariants } from "@/components/ui/button";
import { getStoredUser } from "@/lib/api";
import { ALL_SUBJECTS, ARCADE_GAMES, gamesForGrade, parseGrade } from "@/lib/arcade/games";
import { TEMPLATE_LABEL, countTargets, type ArcadeGame } from "@/lib/arcade/types";
import {
  DAILY_TOKEN_CAP,
  applyRun,
  levelFromXp,
  loadWallet,
  type ArcadeWallet,
  type Reward,
} from "@/lib/arcade/wallet";
import { MatchPairs } from "@/components/arcade/templates/match-pairs";
import { QuizRace } from "@/components/arcade/templates/quiz-race";
import { SequenceOrder } from "@/components/arcade/templates/sequence-order";

const LIVES = 5;

type View = "catalog" | "playing" | "result";

interface Summary {
  correct: number;
  total: number;
  mistakes: number;
  won: boolean;
  reward: Reward;
  levelUp: boolean;
}

export function ArcadeView() {
  const [uid, setUid] = React.useState("guest");
  const [grade, setGrade] = React.useState<number | null>(null);
  const [wallet, setWallet] = React.useState<ArcadeWallet | null>(null);
  const [view, setView] = React.useState<View>("catalog");
  const [game, setGame] = React.useState<ArcadeGame | null>(null);
  const [runId, setRunId] = React.useState(0);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [subject, setSubject] = React.useState("All");
  const [allClasses, setAllClasses] = React.useState(false);

  // live counters for the run in progress (a ref keeps them correct inside callbacks)
  const run = React.useRef({ lives: LIVES, correct: 0, mistakes: 0, finished: false });
  const [, force] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    const u = getStoredUser();
    const id = String(u?.id ?? u?.email ?? "guest");
    setUid(id);
    setGrade(parseGrade(u?.grade));
    setWallet(loadWallet(id));
  }, []);

  function start(g: ArcadeGame) {
    run.current = { lives: LIVES, correct: 0, mistakes: 0, finished: false };
    setGame(g);
    setRunId((n) => n + 1);
    setSummary(null);
    setView("playing");
  }

  function finish(won: boolean) {
    const r = run.current;
    if (r.finished || !game) return;
    r.finished = true;
    const before = loadWallet(uid).xp;
    const reward = applyRun(uid, game.id, { won, correct: r.correct, total: countTargets(game), mistakes: r.mistakes });
    setWallet(reward.wallet);
    setSummary({
      correct: r.correct,
      total: countTargets(game),
      mistakes: r.mistakes,
      won,
      reward,
      levelUp: levelFromXp(reward.wallet.xp) > levelFromXp(before),
    });
    setView("result");
  }

  const handlers = {
    onCorrect: () => {
      run.current.correct += 1;
      force();
    },
    onWrong: () => {
      run.current.mistakes += 1;
      run.current.lives -= 1;
      force();
      if (run.current.lives <= 0) finish(false);
    },
    onComplete: () => finish(true),
  };

  const classGames = React.useMemo(() => gamesForGrade(allClasses ? null : grade), [grade, allClasses]);
  const visible = classGames.filter((g) => subject === "All" || g.subject === subject);
  const subjects = ["All", ...ALL_SUBJECTS.filter((s) => classGames.some((g) => g.subject === s))];

  return (
    <RequireStudent title="Game Arcade">
      <div className="grid gap-5">
        {view === "catalog" ? (
          <>
            <section className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="font-heading text-2xl font-semibold">Game Arcade</h1>
                <p className="text-sm text-muted-foreground">
                  {grade && !allClasses ? `Games for Class ${grade}. ` : "Games for every class. "}
                  Win stars, tokens and XP.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm font-bold">
                <span className="rounded-full border-2 border-amber-400 bg-amber-400/15 px-3 py-1">🪙 {wallet?.tokens ?? 0}</span>
                <span className="rounded-full border-2 border-border bg-card px-3 py-1">
                  ⚡ {wallet?.xp ?? 0} XP · Level {levelFromXp(wallet?.xp ?? 0)}
                </span>
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-2">
              {subjects.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubject(s)}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), subject === s && "border-primary bg-primary/5 text-primary")}
                >
                  {s}
                </button>
              ))}
              {grade ? (
                <button
                  type="button"
                  onClick={() => {
                    setAllClasses((v) => !v);
                    setSubject("All");
                  }}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "ml-auto")}
                >
                  {allClasses ? `Show Class ${grade} only` : "Show all classes"}
                </button>
              ) : null}
            </div>

            {visible.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No games for this subject in your class yet. Try “All” or “Show all classes”.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((g) => {
                  const best = wallet?.best[g.id] ?? 0;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => start(g)}
                      className="group flex flex-col gap-2 rounded-2xl border-2 border-border bg-card p-4 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-3xl" aria-hidden>
                          {g.emoji}
                        </span>
                        <span aria-label={`${best} of 3 stars`} className="text-sm tracking-widest">
                          {[1, 2, 3].map((n) => (
                            <span key={n} className={n <= best ? "" : "opacity-20 grayscale"}>
                              ⭐
                            </span>
                          ))}
                        </span>
                      </div>
                      <div>
                        <h2 className="font-bold leading-tight">{g.title}</h2>
                        <p className="mt-0.5 text-sm text-muted-foreground">{g.blurb}</p>
                      </div>
                      <p className="mt-auto text-xs text-muted-foreground">
                        {g.subject} · Class {g.fromGrade === g.toGrade ? g.fromGrade : `${g.fromGrade}–${g.toGrade}`} · {TEMPLATE_LABEL[g.template]}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {ARCADE_GAMES.length} games so far. Tokens and stars are saved on this device. Today: {wallet?.daily.tokens ?? 0}/{DAILY_TOKEN_CAP} tokens earned.
            </p>
          </>
        ) : null}

        {view === "playing" && game ? <Playing game={game} runId={runId} run={run.current} handlers={handlers} onQuit={() => setView("catalog")} /> : null}

        {view === "result" && game && summary ? (
          <Result
            game={game}
            summary={summary}
            onAgain={() => start(game)}
            onBack={() => {
              setView("catalog");
              setSummary(null);
            }}
          />
        ) : null}
      </div>
    </RequireStudent>
  );
}

function Playing({
  game,
  runId,
  run,
  handlers,
  onQuit,
}: {
  game: ArcadeGame;
  runId: number;
  run: { lives: number; correct: number; mistakes: number };
  handlers: { onCorrect: () => void; onWrong: () => void; onComplete: () => void };
  onQuit: () => void;
}) {
  const total = countTargets(game);
  const pct = Math.min(100, Math.round((run.correct / total) * 100));
  const stage = pct >= 67 ? "🌳" : pct >= 34 ? "🌿" : "🌱";

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onQuit}>
          <ArrowLeft className="size-4" aria-hidden /> Quit
        </Button>
        <h1 className="font-heading text-lg font-semibold">
          <span aria-hidden>{game.emoji} </span>
          {game.title}
        </h1>
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="rounded-full border-2 border-amber-400 bg-amber-400/15 px-2.5 py-0.5">🪙 {run.correct * 2}</span>
          <span className="tracking-wider" aria-label={`${run.lives} lives left`}>
            {"❤️".repeat(Math.max(0, run.lives))}
            {"🤍".repeat(Math.max(0, LIVES - run.lives))}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          {stage}
        </span>
        <div
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Game progress"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
      </div>

      <div className="rounded-2xl border-2 border-border bg-card p-4 sm:p-5">
        {game.template === "MATCH" ? <MatchPairs key={runId} game={game} {...handlers} /> : null}
        {game.template === "QUIZ" ? <QuizRace key={runId} game={game} {...handlers} /> : null}
        {game.template === "ORDER" ? <SequenceOrder key={runId} game={game} {...handlers} /> : null}
      </div>
    </div>
  );
}

function Result({
  game,
  summary,
  onAgain,
  onBack,
}: {
  game: ArcadeGame;
  summary: Summary;
  onAgain: () => void;
  onBack: () => void;
}) {
  const { reward, won } = summary;
  const title = !won ? "Out of lives" : reward.stars === 3 ? (reward.perfect ? "Perfect score!" : "Brilliant!") : "Nice work!";

  return (
    <div className="mx-auto grid w-full max-w-md gap-4 rounded-2xl border-2 border-border bg-card p-6 text-center">
      <div className="text-4xl tracking-[0.3em]" aria-label={`${reward.stars} of 3 stars`}>
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= reward.stars ? "" : "opacity-20 grayscale"}>
            ⭐
          </span>
        ))}
      </div>
      <div>
        <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {game.title}: {summary.correct} of {summary.total} right{summary.mistakes ? `, ${summary.mistakes} slip${summary.mistakes === 1 ? "" : "s"}` : ""}.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 text-sm font-bold">
        <span className="rounded-full border-2 border-amber-400 bg-amber-400/15 px-3 py-1">+{reward.tokens} 🪙</span>
        <span className="rounded-full border-2 border-border px-3 py-1">+{reward.xp} ⚡ XP</span>
      </div>

      {summary.levelUp ? <p className="text-sm font-bold text-primary">Level up! You are now level {levelFromXp(reward.wallet.xp)}.</p> : null}
      {!won ? <p className="text-sm text-muted-foreground">Tokens come when you finish the game. Try again, you can do it!</p> : null}
      {reward.replay && won ? <p className="text-xs text-muted-foreground">Replays give fewer rewards. Try a new game for full tokens.</p> : null}
      {reward.capped ? <p className="text-xs text-muted-foreground">You hit today’s token limit ({DAILY_TOKEN_CAP}). Come back tomorrow!</p> : null}

      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onAgain}>
          <RotateCcw className="size-4" aria-hidden /> Play again
        </Button>
        <Button variant="outline" onClick={onBack}>
          More games
        </Button>
      </div>
    </div>
  );
}
