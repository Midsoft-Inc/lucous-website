"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "cn";
import type { OrderGame, TemplateProps } from "@/lib/arcade/types";
import { CARD_BAD, CARD_BASE, CARD_GOOD, CARD_IDLE, shuffle } from "@/lib/arcade/util";

const SHAKE = { x: [0, -6, 6, -6, 0] };

export function SequenceOrder({ game, onCorrect, onWrong, onComplete }: TemplateProps<OrderGame>) {
  const [round, setRound] = React.useState(0);
  const [orders] = React.useState(() => game.rounds.map((r) => shuffle(r.steps.map((_, i) => i))));
  const [taken, setTaken] = React.useState<number[]>([]); // step indexes, in the order the player tapped them
  const [shake, setShake] = React.useState<number | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = game.rounds[round];
  const words = current.steps.every((s) => !s.includes(" ")); // single words render as small chips

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  React.useEffect(() => {
    if (shake === null) return;
    const t = setTimeout(() => setShake(null), 400);
    return () => clearTimeout(t);
  }, [shake]);

  function tap(i: number) {
    if (taken.includes(i) || taken.length >= current.steps.length) return;
    // same text as the expected step counts as right (handles repeated words)
    if (current.steps[i] === current.steps[taken.length]) {
      const next = [...taken, i];
      setTaken(next);
      onCorrect();
      if (next.length === current.steps.length) {
        timer.current = setTimeout(() => {
          if (round + 1 >= game.rounds.length) {
            onComplete();
          } else {
            setRound(round + 1);
            setTaken([]);
          }
        }, 800);
      }
    } else {
      setShake(i);
      onWrong();
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm font-bold">
        <span>{current.title}</span>
        <span className="text-muted-foreground">
          {round + 1} of {game.rounds.length}
        </span>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">{current.prompt}</p>

      {words ? (
        <p className="mb-4 min-h-10 rounded-xl border-2 border-dashed border-border px-3 py-2 text-base font-bold">
          {taken.map((i) => current.steps[i]).join(" ") || <span className="font-normal text-muted-foreground">Your sentence appears here</span>}
        </p>
      ) : null}

      <div className={cn(words ? "flex flex-wrap gap-2" : "grid gap-2.5")}>
        {orders[round].map((i) => {
          const pos = taken.indexOf(i);
          const isTaken = pos !== -1;
          return (
            <motion.button
              key={`${round}-${i}`}
              type="button"
              disabled={isTaken}
              onClick={() => tap(i)}
              animate={shake === i ? SHAKE : { x: 0 }}
              transition={{ duration: 0.35 }}
              className={cn(
                CARD_BASE,
                words && "w-auto",
                isTaken ? CARD_GOOD : shake === i ? CARD_BAD : CARD_IDLE
              )}
            >
              {isTaken ? (
                <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-white">
                  {pos + 1}
                </span>
              ) : null}
              {current.steps[i]}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
