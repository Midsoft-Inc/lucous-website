"use client";

import * as React from "react";
import { Gamepad2, Loader2, Trash2, Copy, Eye, EyeOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DOC_GAME_FORMATS,
  teacherDocGames,
  type DocGameDifficulty,
  type DocGameFull,
  type DocGameItem,
  type DocGameSummary,
  type DocGameType,
  type TeacherMaterialLite,
} from "@/lib/doc-games";
import { cn } from "cn";

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function msg(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong.";
}

function answerText(it: DocGameItem): string | null {
  switch (it.type) {
    case "QUIZ":
      return typeof it.correctIndex === "number" ? it.options?.[it.correctIndex] ?? null : null;
    case "TRUE_FALSE":
      return it.answer === true ? "True" : it.answer === false ? "False" : null;
    case "FILL_BLANK":
      return typeof it.answer === "string" ? it.answer : null;
    case "MATCH":
      return it.key
        ? (it.terms ?? []).map((t) => `${t.text} → ${it.meanings?.find((m) => m.id === it.key![t.id])?.text ?? ""}`).join("\n")
        : null;
    case "ORDER":
      return it.correctOrder ? it.correctOrder.map((id, i) => `${i + 1}. ${it.steps?.find((s) => s.id === id)?.text ?? ""}`).join("\n") : null;
    default:
      return it.back ?? null;
  }
}

export function DocGamesPanel() {
  const [materials, setMaterials] = React.useState<TeacherMaterialLite[]>([]);
  const [games, setGames] = React.useState<DocGameSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [materialId, setMaterialId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<DocGameDifficulty>("MEDIUM");
  const [formats, setFormats] = React.useState<DocGameType[]>([]);
  const [variant, setVariant] = React.useState(1);
  const [busy, setBusy] = React.useState(false);

  const [open, setOpen] = React.useState<DocGameFull | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    try {
      const [m, g] = await Promise.all([teacherDocGames.materials(), teacherDocGames.list()]);
      setMaterials(m.materials ?? []);
      setGames(g.games ?? []);
      setError(null);
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  async function generate() {
    if (!materialId) return;
    setBusy(true);
    setError(null);
    try {
      const { game } = await teacherDocGames.generate({
        materialId,
        title: title.trim() || undefined,
        difficulty,
        formats: formats.length ? formats : undefined,
        variant,
      });
      setOpen(game);
      await reload();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function view(id: string) {
    try {
      const { game } = await teacherDocGames.get(id);
      setOpen(game);
    } catch (e) {
      setError(msg(e));
    }
  }

  async function togglePublish(g: { id: string; status: string }) {
    try {
      await teacherDocGames.update(g.id, { published: g.status !== "PUBLISHED" });
      await reload();
      if (open?.id === g.id) await view(g.id);
    } catch (e) {
      setError(msg(e));
    }
  }

  async function removeGame(id: string) {
    if (!window.confirm("Delete this game?")) return;
    try {
      await teacherDocGames.remove(id);
      if (open?.id === id) setOpen(null);
      await reload();
    } catch (e) {
      setError(msg(e));
    }
  }

  async function removeItem(itemId: string) {
    if (!open) return;
    try {
      const { game } = await teacherDocGames.removeItem(open.id, itemId);
      setOpen(game);
      await reload();
    } catch (e) {
      setError(msg(e));
    }
  }

  function copy(code: string) {
    void navigator.clipboard?.writeText(code);
    setCopied(code);
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="size-5" /> Document → Game
          </CardTitle>
          <CardDescription>
            Pick an uploaded document and LUCOUS builds a playable game from its text — no AI. Preview it, remove weak questions, then publish to get a code for your students.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="grid gap-1">
                <label className="text-xs font-medium text-muted-foreground">Uploaded material</label>
                <select className={selectClass} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                  <option value="">{materials.length ? "Choose a document…" : "No uploaded materials yet (upload in Learning Materials)"}</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.originalName}
                      {m.topicName ? ` — ${m.topicName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Game title (optional)</label>
                  <input className={selectClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Difficulty</label>
                  <select className={selectClass} value={difficulty} onChange={(e) => setDifficulty(e.target.value as DocGameDifficulty)}>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>
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
                <span className="self-center text-xs text-muted-foreground">(none selected = all types)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button disabled={!materialId || busy} onClick={() => void generate()}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Gamepad2 className="size-4" />} Generate game
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setVariant((v) => v + 1)}>
                  Different questions (set {variant})
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Works best with real sentences. Scanned/image PDFs can&apos;t be read — use a .docx or .txt instead.
              </p>
            </>
          )}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      {open ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>{open.title}</CardTitle>
                <CardDescription>
                  {open.stats ? `${open.stats.levels} levels · ${open.stats.questions} questions · up to ${open.stats.maxXp} XP` : null}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setOpen(null)} aria-label="Close preview">
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant={open.status === "PUBLISHED" ? "default" : "secondary"}>{open.status}</Badge>
              {open.accessCode ? (
                <button
                  type="button"
                  onClick={() => copy(open.accessCode!)}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-sm hover:bg-muted"
                >
                  {open.accessCode} <Copy className="size-3.5" /> {copied === open.accessCode ? "Copied" : ""}
                </button>
              ) : null}
              <Button size="sm" variant={open.status === "PUBLISHED" ? "outline" : "default"} onClick={() => void togglePublish(open)}>
                {open.status === "PUBLISHED" ? (
                  <>
                    <EyeOff className="size-4" /> Unpublish
                  </>
                ) : (
                  <>
                    <Eye className="size-4" /> Publish &amp; get code
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5">
            {open.levels.map((lv) => (
              <div key={lv.id} className="grid gap-2">
                <h3 className="text-sm font-semibold">
                  {lv.icon} {lv.title}
                </h3>
                {lv.items.map((it) => (
                  <div key={it.id} className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                    <div className="grid flex-1 gap-1">
                      <p className="whitespace-pre-line font-medium">{it.prompt ?? it.front}</p>
                      {it.type === "QUIZ" && it.options ? (
                        <ul className="list-disc pl-5 text-muted-foreground">
                          {it.options.map((o, i) => (
                            <li key={i} className={cn(i === it.correctIndex && "font-medium text-green-700 dark:text-green-400")}>
                              {o}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="whitespace-pre-line text-green-700 dark:text-green-400">{answerText(it)}</p>
                      )}
                    </div>
                    {lv.type !== "FLASHCARD" || lv.items.length > 1 ? (
                      <Button variant="ghost" size="icon-sm" onClick={() => void removeItem(it.id)} aria-label="Remove question">
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My games</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {!games.length ? <p className="text-sm text-muted-foreground">No games yet.</p> : null}
          {games.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{g.title}</p>
                <p className="text-xs text-muted-foreground">
                  {g.difficulty} · {g.stats?.questions ?? 0} questions · played {g.playCount}×
                  {g.accessCode ? ` · ${g.accessCode}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={g.status === "PUBLISHED" ? "default" : "secondary"}>{g.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => void view(g.id)}>
                  Preview
                </Button>
                <Button size="sm" variant="outline" onClick={() => void togglePublish(g)}>
                  {g.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => void removeGame(g.id)} aria-label="Delete game">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
