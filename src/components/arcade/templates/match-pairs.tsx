"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "cn";
import type { MatchGame, TemplateProps } from "@/lib/arcade/types";
import { CARD_BAD, CARD_BASE, CARD_GOOD, CARD_IDLE, CARD_PICK, shuffle } from "@/lib/arcade/util";

const SHAKE = { x: [0, -6, 6, -6, 0] };

export function MatchPairs({ game, onCorrect, onWrong, onComplete }: TemplateProps<MatchGame>) {
  const [round, setRound] = React.useState(0);
  const [orders] = React.useState(() => game.rounds.map((r) => shuffle(r.pairs.map((_, i) => i))));
  const [picked, setPicked] = React.useState<number | null>(null);
  const [done, setDone] = React.useState<Set<number>>(() => new Set());
  const [shake, setShake] = React.useState<number | null>(null);
  const [hint, setHint] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = game.rounds[round];

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
  React.useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), 1600);
    return () => clearTimeout(t);
  }, [hint]);

  function tapTerm(i: number) {
    if (done.has(i)) return;
    setPicked(i);
  }

  function tapMeaning(i: number) {
    if (done.has(i)) return;
    if (picked === null) {
      setHint(true);
      return;
    }
    if (picked === i) {
      const next = new Set(done);
      next.add(i);
      setDone(next);
      setPicked(null);
      onCorrect();
      if (next.size === current.pairs.length) {
        timer.current = setTimeout(() => {
          if (round + 1 >= game.rounds.length) {
            onComplete();
          } else {
            setRound(round + 1);
            setDone(new Set());
          }
        }, 650);
      }
    } else {
      setShake(i);
      setPicked(null);
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
      <p className="mb-3 min-h-5 text-sm text-muted-foreground">
        {hint ? "Tap a word on the left first." : "Tap a word, then tap its meaning."}
      </p>

      <div className="grid grid-cols-[1fr_1.35fr] gap-x-3 gap-y-2.5">
        <div className="grid content-start gap-2.5">
          {current.pairs.map(([term], i) => (
            <button
              key={`t-${round}-${i}`}
              type="button"
              disabled={done.has(i)}
              onClick={() => tapTerm(i)}
              className={cn(CARD_BASE, done.has(i) ? CARD_GOOD : picked === i ? CARD_PICK : CARD_IDLE)}
            >
              {term}
            </button>
          ))}
        </div>
        <div className="grid content-start gap-2.5">
          {orders[round].map((i) => (
            <motion.button
              key={`m-${round}-${i}`}
              type="button"
              disabled={done.has(i)}
              onClick={() => tapMeaning(i)}
              animate={shake === i ? SHAKE : { x: 0 }}
              transition={{ duration: 0.35 }}
              className={cn(CARD_BASE, done.has(i) ? CARD_GOOD : shake === i ? CARD_BAD : CARD_IDLE)}
            >
              {current.pairs[i][1]}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
