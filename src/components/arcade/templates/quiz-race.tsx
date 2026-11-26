"use client";

import * as React from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import type { QuizGame, TemplateProps } from "@/lib/arcade/types";
import { CARD_BAD, CARD_BASE, CARD_GOOD, CARD_IDLE, shuffle } from "@/lib/arcade/util";

export function QuizRace({ game, onCorrect, onWrong, onComplete }: TemplateProps<QuizGame>) {
  const [idx, setIdx] = React.useState(0);
  // options are shuffled once per question; we remember where the right one ended up
  const [orders] = React.useState(() => game.questions.map((q) => shuffle(q.options.map((_, i) => i))));
  const [picked, setPicked] = React.useState<number | null>(null); // position tapped, -1 = time ran out
  const [timeLeft, setTimeLeft] = React.useState(game.secondsPerQuestion);

  const cb = React.useRef({ onCorrect, onWrong });
  React.useEffect(() => {
    cb.current = { onCorrect, onWrong };
  });

  const q = game.questions[idx];
  const order = orders[idx];
  const correctPos = order.indexOf(q.answer);

  React.useEffect(() => {
    if (picked !== null) return;
    if (timeLeft <= 0) {
      setPicked(-1);
      cb.current.onWrong();
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [picked, timeLeft]);

  function choose(pos: number) {
    if (picked !== null) return;
    setPicked(pos);
    if (pos === correctPos) cb.current.onCorrect();
    else cb.current.onWrong();
  }

  function next() {
    if (idx + 1 >= game.questions.length) {
      onComplete();
      return;
    }
    setIdx(idx + 1);
    setPicked(null);
    setTimeLeft(game.secondsPerQuestion);
  }

  const pct = (timeLeft / game.secondsPerQuestion) * 100;
  const low = timeLeft <= 5;
  const answered = picked !== null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-bold">
        <span>
          Question {idx + 1} of {game.questions.length}
        </span>
        <span className={cn("tabular-nums", low && !answered ? "text-red-500" : "text-muted-foreground")}>
          {timeLeft}s
        </span>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", low ? "bg-red-500" : "bg-primary")}
          style={{ width: `${answered ? 0 : pct}%` }}
        />
      </div>

      <h2 className="mb-3 text-lg font-bold leading-snug">{q.q}</h2>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {order.map((optIndex, pos) => {
          const isRight = pos === correctPos;
          const isPicked = picked === pos;
          return (
            <button
              key={`${idx}-${pos}`}
              type="button"
              disabled={answered}
              onClick={() => choose(pos)}
              className={cn(
                CARD_BASE,
                !answered && CARD_IDLE,
                answered && isRight && CARD_GOOD,
                answered && isPicked && !isRight && CARD_BAD,
                answered && !isRight && !isPicked && "border-border opacity-60"
              )}
            >
              {q.options[optIndex]}
            </button>
          );
        })}
      </div>

      {answered ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/60 p-3">
          <p className="text-sm">
            <span className="font-bold">{picked === correctPos ? "Correct! " : picked === -1 ? "Time is up. " : "Not quite. "}</span>
            {q.why}
          </p>
          <Button onClick={next}>{idx + 1 >= game.questions.length ? "Finish" : "Next question"}</Button>
        </div>
      ) : null}
    </div>
  );
}
