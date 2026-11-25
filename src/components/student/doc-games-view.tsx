"use client";

import * as React from "react";
import { Gamepad2, KeyRound, BookOpen, FileText, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RequireStudent } from "@/components/student/require-student";
import { TopicPicker } from "@/components/student/topic-picker";
import { DocGamePlayer } from "@/components/student/doc-game-player";
import {
  DOC_GAME_FORMATS,
  studentDocGames,
  type DocGameDifficulty,
  type DocGameSummary,
  type DocGameType,
  type PlayableDocGame,
} from "@/lib/doc-games";
import type { Topic } from "@/lib/api";
import { cn } from "cn";

type Tab = "code" | "topic" | "notes" | "mine";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "code", label: "Teacher's game", icon: KeyRound },
  { id: "topic", label: "From a topic", icon: BookOpen },
  { id: "notes", label: "From my notes", icon: FileText },
  { id: "mine", label: "My games", icon: Gamepad2 },
];

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function msg(e: unknown, fallback = "Something went wrong.") {
  return e instanceof Error ? e.message : fallback;
}

export function DocGamesView() {
  const [tab, setTab] = React.useState<Tab>("code");
  const [playing, setPlaying] = React.useState<{ game: PlayableDocGame; code?: string } | null>(null);

  return (
    <RequireStudent title="Study games">
      <div className="grid gap-5">
        <section>
          <h1 className="font-heading text-2xl font-semibold">Study games</h1>
          <p className="text-sm text-muted-foreground">
            Turn any lesson or document into a game, earn XP and level up. No AI needed — games are built straight from the text.
          </p>
        </section>

        {playing ? (
          <DocGamePlayer game={playing.game} code={playing.code} onExit={() => setPlaying(null)} />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <Button key={t.id} variant={tab === t.id ? "default" : "outline"} size="sm" onClick={() => setTab(t.id)}>
                  <t.icon className="size-4" /> {t.label}
                </Button>
              ))}
            </div>
            {tab === "code" ? <CodeTab onPlay={(game, code) => setPlaying({ game, code })} /> : null}
            {tab === "topic" ? <TopicTab onPlay={(game) => setPlaying({ game })} /> : null}
            {tab === "notes" ? <NotesTab onPlay={(game) => setPlaying({ game })} /> : null}
            {tab === "mine" ? <MineTab onPlay={(game) => setPlaying({ game })} /> : null}
          </>
        )}
      </div>
    </RequireStudent>
  );
}

function CodeTab({ onPlay }: { onPlay: (g: PlayableDocGame, code: string) => void }) {
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const clean = code.trim().toUpperCase();
      const { game } = await studentDocGames.open(clean);
      onPlay(game, clean);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter your teacher&apos;s game code</CardTitle>
        <CardDescription>The code looks like GM-7K3F9Q.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:max-w-sm">
        <input
          className={cn(selectClass, "font-mono uppercase tracking-wider")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="GM-XXXXXX"
          onKeyDown={(e) => e.key === "Enter" && code.trim() && void open()}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button disabled={busy || !code.trim()} onClick={() => void open()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Start game
        </Button>
      </CardContent>
    </Card>
  );
}

function Options({
  difficulty,
  setDifficulty,
  formats,
  setFormats,
}: {
  difficulty: DocGameDifficulty;
  setDifficulty: (d: DocGameDifficulty) => void;
  formats: DocGameType[];
  setFormats: (f: DocGameType[]) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1 sm:max-w-48">
        <label className="text-xs font-medium text-muted-foreground">Difficulty</label>
        <select className={selectClass} value={difficulty} onChange={(e) => setDifficulty(e.target.value as DocGameDifficulty)}>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-medium text-muted-foreground">Game types (leave empty for all)</label>
        <div className="flex flex-wrap gap-2">
          {DOC_GAME_FORMATS.map((f) => {
            const on = formats.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormats(on ? formats.filter((x) => x !== f.id) : [...formats, f.id])}
                className={cn("rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted", on && "border-primary bg-primary/10 font-medium")}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TopicTab({ onPlay }: { onPlay: (g: PlayableDocGame) => void }) {
  const [topic, setTopic] = React.useState<Topic | null>(null);
  const [difficulty, setDifficulty] = React.useState<DocGameDifficulty>("MEDIUM");
  const [formats, setFormats] = React.useState<DocGameType[]>([]);
  const [variant, setVariant] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function make() {
    if (!topic) return;
    setBusy(true);
    setError(null);
    try {
      const { game } = await studentDocGames.fromTopic({
        topicId: String(topic.id),
        difficulty,
        formats: formats.length ? formats : undefined,
        variant,
      });
      onPlay(game);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Make a game from a topic</CardTitle>
        <CardDescription>Pick the topic you just studied. The game is built from its lesson text.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <TopicPicker onSelect={setTopic} />
        {topic ? (
          <>
            <Options difficulty={difficulty} setDifficulty={setDifficulty} formats={formats} setFormats={setFormats} />
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={busy} onClick={() => void make()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Gamepad2 className="size-4" />} Generate game
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setVariant((v) => v + 1)}>
                Different questions (set {variant})
              </Button>
            </div>
          </>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function NotesTab({ onPlay }: { onPlay: (g: PlayableDocGame) => void }) {
  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<DocGameDifficulty>("MEDIUM");
  const [formats, setFormats] = React.useState<DocGameType[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const { game } = await studentDocGames.fromText({
        title: title.trim() || undefined,
        text,
        difficulty,
        formats: formats.length ? formats : undefined,
      });
      onPlay(game);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Make a game from your notes</CardTitle>
        <CardDescription>Paste any text you are reading (at least ~200 characters of real sentences).</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <input className={selectClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" maxLength={120} />
        <textarea
          className="min-h-48 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your notes or the paragraph you just read…"
        />
        <p className="text-xs text-muted-foreground">{text.trim().length} characters</p>
        <Options difficulty={difficulty} setDifficulty={setDifficulty} formats={formats} setFormats={setFormats} />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div>
          <Button disabled={busy || text.trim().length < 200} onClick={() => void make()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Gamepad2 className="size-4" />} Generate game
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MineTab({ onPlay }: { onPlay: (g: PlayableDocGame) => void }) {
  const [games, setGames] = React.useState<DocGameSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    studentDocGames
      .mine()
      .then((d) => active && setGames(d.games))
      .catch((e) => active && setError(msg(e)));
    return () => {
      active = false;
    };
  }, []);

  async function play(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const { game } = await studentDocGames.get(id);
      onPlay(game);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusyId(null);
    }
  }

  if (error && !games) return <p className="text-sm text-destructive">{error}</p>;
  if (!games) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!games.length) return <p className="text-sm text-muted-foreground">You have not made any games yet. Try “From a topic” or “From my notes”.</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {error ? <p className="text-sm text-destructive sm:col-span-2 lg:col-span-3">{error}</p> : null}
      {games.map((g) => (
        <Card key={g.id}>
          <CardHeader>
            <CardTitle className="text-base">{g.title}</CardTitle>
            <CardDescription>
              <Badge variant="secondary">{g.difficulty}</Badge>{" "}
              {g.stats ? `${g.stats.questions} questions · up to ${g.stats.maxXp} XP` : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" disabled={busyId === g.id} onClick={() => void play(g.id)}>
              {busyId === g.id ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Play
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
