"use strict";

/**
 * Document -> Game routes (NO AI). See services/text-game-generator.js.
 *
 * Teacher  (mounted at /api/teacher/doc-games)
 *   POST   /generate              { materialId, title?, difficulty?, formats?, variant?, publish? }
 *   GET    /                      my games
 *   GET    /:id                   full game WITH answers (preview)
 *   PATCH  /:id                   { title?, published? }  publish gives a class code like GM-7K3F9Q
 *   DELETE /:id/items/:itemId     remove a bad question
 *   DELETE /:id
 *
 * Student  (mounted at /api/student/doc-games)
 *   POST   /open                  { code }                      open a teacher's game
 *   POST   /from-topic            { topicId | topicIds[], difficulty?, formats?, variant? }
 *   POST   /from-text             { title?, text, difficulty?, formats? }
 *   GET    /mine                  games I generated
 *   GET    /:id                   one of my games (playable, no answers)
 *   POST   /:id/submit            { answers, code? }  -> score + XP (server side)
 */

const express = require("express");
const crypto = require("crypto");
const gen = require("../services/text-game-generator");
const { processDocument } = require("../services/document-processor");
const { extractPdfText, isAvailable: pdfReaderInstalled, looksReadable } = require("../services/pdf-text");
const { getStorageAdapter } = require("../storage/storage-adapter");

const MOCK_ID = /^[a-f\d]{24}$/i;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

// XP rules (server side so the client cannot inflate them)
const REPLAY_MULTIPLIER = 0.25; // replaying the same game
const SELF_GAME_MULTIPLIER = 0.5; // games a student made for themselves
const SELF_DAILY_XP_CAP = 150;

// dev/test fallback when MongoDB is not configured (same idea as the rest of LUCOUS)
const memGames = new Map();
const memPlays = []; // { userId, gameKey, xp, createdAt }

function newCode() {
  let s = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `GM-${s}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function playerLevel(totalXp) {
  return Math.floor(Math.sqrt(Math.max(0, totalXp) / 50)) + 1;
}

function createDocGameRouters(prisma, { requireTeacher, requireStudent, memoryXp } = {}) {
  const useDb = () => Boolean(process.env.MONGODB_URI);

  // ----------------------------------------------------------------------
  // Storage helpers (MongoDB via Prisma, or in-memory in dev)
  // ----------------------------------------------------------------------
  class StoreUnavailable extends Error {}

  function table() {
    if (!useDb()) return null;
    if (!prisma || !prisma.docGame) {
      throw new StoreUnavailable(
        "The DocGame table is not set up yet. Run `npx prisma generate` and `npx prisma db push` on the backend."
      );
    }
    return prisma.docGame;
  }

  const store = {
    async create(data) {
      const t = table();
      if (t) return t.create({ data });
      const rec = { id: `dg_${crypto.randomBytes(8).toString("hex")}`, playCount: 0, createdAt: new Date(), updatedAt: new Date(), ...data };
      memGames.set(rec.id, rec);
      return rec;
    },
    async get(id) {
      const t = table();
      if (t) {
        if (!MOCK_ID.test(String(id))) return null;
        return t.findUnique({ where: { id: String(id) } });
      }
      return memGames.get(String(id)) || null;
    },
    async update(id, data) {
      const t = table();
      if (t) return t.update({ where: { id }, data });
      const rec = memGames.get(id);
      if (!rec) return null;
      Object.assign(rec, data, { updatedAt: new Date() });
      return rec;
    },
    async remove(id) {
      const t = table();
      if (t) return t.delete({ where: { id } });
      memGames.delete(id);
      return true;
    },
    async listByOwner(ownerId) {
      const t = table();
      if (t) return t.findMany({ where: { ownerId }, orderBy: { createdAt: "desc" }, take: 100 });
      return Array.from(memGames.values())
        .filter((g) => g.ownerId === ownerId)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    async findByCode(code) {
      const t = table();
      if (t) return t.findFirst({ where: { accessCode: code } });
      return Array.from(memGames.values()).find((g) => g.accessCode === code) || null;
    },
    async findSame(ownerId, sourceHash, difficulty, variant) {
      const t = table();
      const match = (g) =>
        g.ownerId === ownerId && g.sourceHash === sourceHash && g.difficulty === difficulty && (g.game?.variant || 0) === variant;
      if (t) {
        const rows = await t.findMany({ where: { ownerId, sourceHash, difficulty }, take: 20 });
        return rows.find(match) || null;
      }
      return Array.from(memGames.values()).find(match) || null;
    },
    async codeExists(code) {
      return Boolean(await this.findByCode(code));
    },
  };

  async function uniqueCode() {
    for (let i = 0; i < 8; i++) {
      const code = newCode();
      if (!(await store.codeExists(code))) return code;
    }
    throw new Error("Could not create a unique class code");
  }

  // plays / XP ------------------------------------------------------------
  async function previousPlays(userId, gameKey) {
    if (useDb() && prisma?.gameScore && MOCK_ID.test(userId)) {
      return prisma.gameScore.count({ where: { userId, gameId: gameKey } });
    }
    return memPlays.filter((p) => p.userId === userId && p.gameKey === gameKey).length;
  }

  async function selfXpToday(userId) {
    if (useDb() && prisma?.gameScore && MOCK_ID.test(userId)) {
      const rows = await prisma.gameScore.findMany({
        where: { userId, gameId: { startsWith: "doc-self:" }, createdAt: { gte: startOfToday() } },
        select: { xp: true },
      });
      return rows.reduce((s, r) => s + (r.xp || 0), 0);
    }
    const since = startOfToday();
    return memPlays
      .filter((p) => p.userId === userId && p.gameKey.startsWith("doc-self:") && p.createdAt >= since)
      .reduce((s, p) => s + p.xp, 0);
  }

  async function recordPlay({ userId, gameKey, result, xp }) {
    memPlays.push({ userId, gameKey, xp, createdAt: new Date() });
    let totalXp = (memoryXp?.get(userId) || 0) + xp;
    memoryXp?.set(userId, totalXp);

    if (useDb() && prisma?.gameScore && MOCK_ID.test(userId)) {
      try {
        await prisma.gameScore.create({
          data: { userId, gameId: gameKey, correct: result.correct, total: result.total, score: result.score, xp },
        });
        const user = await prisma.user.update({
          where: { id: userId },
          data: { xp: { increment: xp } },
          select: { xp: true },
        });
        if (user && typeof user.xp === "number") totalXp = user.xp;
      } catch (err) {
        console.warn("[DocGames] score recording fallback:", err.message);
      }
    }
    return totalXp;
  }

  // misc helpers ----------------------------------------------------------
  const fail = (res, label, err) => {
    if (err instanceof StoreUnavailable) {
      return res.status(503).json({ success: false, message: err.message });
    }
    console.error(`[DocGames] ${label}:`, err);
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  };

  function parseOptions(body) {
    const formats = Array.isArray(body.formats)
      ? body.formats.map((f) => String(f).toUpperCase()).filter((f) => gen.FORMATS.includes(f))
      : undefined;
    const difficulty = String(body.difficulty || "MEDIUM").toUpperCase();
    if (!gen.DIFFICULTIES.includes(difficulty)) return { error: `difficulty must be one of ${gen.DIFFICULTIES.join(", ")}` };
    const variant = Math.max(0, Math.min(Number(body.variant) || 0, 50));
    return { formats, difficulty, variant };
  }

  function summary(rec) {
    return {
      id: rec.id,
      title: rec.title,
      difficulty: rec.difficulty,
      sourceType: rec.sourceType,
      status: rec.status,
      accessCode: rec.status === "PUBLISHED" ? rec.accessCode : null,
      playCount: rec.playCount || 0,
      stats: rec.game?.stats || null,
      createdAt: rec.createdAt,
    };
  }

  function buildFromText(text, { title, difficulty, formats, variant }) {
    return gen.buildGame(text, { title, difficulty, formats, variant });
  }

  async function loadMaterialText(material) {
    if (!material.storageKey) {
      const e = new Error("Source material is missing a storage key.");
      e.status = 400;
      throw e;
    }
    let data;
    try {
      data = await getStorageAdapter().get(material.storageKey);
    } catch (err) {
      const e = new Error(`Storage access error: ${err.message}`);
      e.status = 500;
      throw e;
    }
    if (!data || !data.buffer) {
      const e = new Error("The source document could not be found in storage. Please re-upload the file.");
      e.status = 410;
      throw e;
    }
    const isPdf = /pdf/i.test(String(material.fileType || "")) || /\.pdf$/i.test(String(material.originalName || ""));
    if (isPdf) {
      // The built-in PDF reader garbles many real PDFs, so try a proper one first.
      if (!pdfReaderInstalled()) {
        console.warn("[doc-games] pdf-parse is not installed. Run: npm i pdf-parse@1.1.1 (in the backend folder) and restart.");
        const e = new Error("The server's PDF reader is not installed yet. Run `npm i pdf-parse@1.1.1` in the backend folder, then restart the backend (or upload a .docx / .txt).");
        e.status = 503;
        throw e;
      }
      try {
        const text = await extractPdfText(data.buffer);
        if (text) return text;
      } catch {
        /* fall through to the built-in reader */
      }
    }
    try {
      const out = await processDocument({ buffer: data.buffer, fileType: material.fileType, originalName: material.originalName });
      if (isPdf && !looksReadable(out.text)) {
        const e = new Error("Could not read real text from this PDF (it looks scanned, image-only or uses unreadable fonts). Upload a .docx or .txt version instead.");
        e.status = 422;
        throw e;
      }
      return out.text;
    } catch (err) {
      if (err.status) throw err;
      const e = new Error(
        isPdf
          ? "This PDF has no readable text (it looks scanned or image-only). Upload a text-based PDF, a .docx or a .txt version."
          : `Document processing failed: ${err.message}`
      );
      e.status = 422;
      throw e;
    }
  }

  async function findMaterial(materialId, teacherId) {
    let mat = null;
    if (useDb() && prisma?.uploadedMaterial && MOCK_ID.test(materialId)) {
      mat = await prisma.uploadedMaterial.findUnique({ where: { id: materialId } });
    }
    if (!mat) {
      try {
        mat = require("./teacher-materials").inMemoryMaterials.get(materialId) || null;
      } catch {
        mat = null;
      }
    }
    if (!mat) return { error: "NOT_FOUND" };
    if (mat.teacherId !== teacherId) return { error: "FORBIDDEN" };
    return { material: mat };
  }

  // simple per-user generation limiter (CPU protection)
  const genLog = new Map();
  function allowGeneration(userId, max = 20, windowMs = 60 * 60 * 1000) {
    const now = Date.now();
    const list = (genLog.get(userId) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return false;
    list.push(now);
    genLog.set(userId, list);
    return true;
  }

  const openLog = new Map();
  function allowOpen(userId) {
    const now = Date.now();
    const list = (openLog.get(userId) || []).filter((t) => now - t < 5 * 60 * 1000);
    if (list.length >= 30) return false;
    list.push(now);
    openLog.set(userId, list);
    return true;
  }

  // ======================================================================
  // TEACHER
  // ======================================================================
  const teacherRouter = express.Router();
  teacherRouter.use("/doc-games", requireTeacher);

  teacherRouter.post("/doc-games/generate", async (req, res) => {
    try {
      const teacherId = req.userId;
      const { materialId, title, publish } = req.body || {};
      if (!materialId || typeof materialId !== "string") {
        return res.status(400).json({ success: false, message: "materialId is required." });
      }
      const opts = parseOptions(req.body || {});
      if (opts.error) return res.status(400).json({ success: false, message: opts.error });
      if (!allowGeneration(teacherId, 40)) {
        return res.status(429).json({ success: false, message: "Too many games generated. Please try again later." });
      }

      const lookup = await findMaterial(materialId.trim(), teacherId);
      if (lookup.error === "FORBIDDEN") {
        return res.status(403).json({ success: false, message: "You do not have access to this material." });
      }
      if (lookup.error) return res.status(404).json({ success: false, message: "Source material not found." });
      const material = lookup.material;

      const text = await loadMaterialText(material);
      const gameTitle = String(title || material.topicName || material.chapterName || material.originalName || "Learning Game")
        .trim()
        .slice(0, 120);

      let game;
      try {
        game = buildFromText(text, { ...opts, title: gameTitle });
      } catch (err) {
        if (err.code === "TEXT_TOO_SHORT" || err.code === "NOT_ENOUGH_FACTS") {
          return res.status(422).json({ success: false, code: err.code, message: err.message });
        }
        throw err;
      }

      const wantsPublish = publish === true;
      const rec = await store.create({
        ownerId: teacherId,
        ownerRole: "TEACHER",
        sourceType: "MATERIAL",
        materialId: String(material.id),
        topicId: material.topicId ? String(material.topicId) : null,
        title: gameTitle,
        difficulty: game.difficulty,
        status: wantsPublish ? "PUBLISHED" : "DRAFT",
        accessCode: wantsPublish ? await uniqueCode() : null,
        sourceHash: game.sourceHash,
        game,
        stats: game.stats,
      });

      res.status(201).json({ success: true, game: { ...summary(rec), levels: game.levels } });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message });
      fail(res, "teacher generate", err);
    }
  });

  teacherRouter.get("/doc-games", async (req, res) => {
    try {
      const list = await store.listByOwner(req.userId);
      res.json({ success: true, games: list.map(summary) });
    } catch (err) {
      fail(res, "teacher list", err);
    }
  });

  async function ownGame(req, res) {
    const rec = await store.get(req.params.id);
    if (!rec) {
      res.status(404).json({ success: false, message: "Game not found." });
      return null;
    }
    if (rec.ownerId !== req.userId) {
      res.status(403).json({ success: false, message: "This game belongs to another user." });
      return null;
    }
    return rec;
  }

  teacherRouter.get("/doc-games/:id", async (req, res) => {
    try {
      const rec = await ownGame(req, res);
      if (!rec) return;
      res.json({ success: true, game: { ...summary(rec), levels: rec.game.levels, rules: rec.game.rules } });
    } catch (err) {
      fail(res, "teacher get", err);
    }
  });

  teacherRouter.patch("/doc-games/:id", async (req, res) => {
    try {
      const rec = await ownGame(req, res);
      if (!rec) return;
      const patch = {};
      if (typeof req.body?.title === "string" && req.body.title.trim()) {
        patch.title = req.body.title.trim().slice(0, 120);
        patch.game = { ...rec.game, title: patch.title };
      }
      if (typeof req.body?.published === "boolean") {
        patch.status = req.body.published ? "PUBLISHED" : "DRAFT";
        if (req.body.published && !rec.accessCode) patch.accessCode = await uniqueCode();
      }
      if (!Object.keys(patch).length) {
        return res.status(400).json({ success: false, message: "Nothing to update (send title and/or published)." });
      }
      const updated = await store.update(rec.id, patch);
      res.json({ success: true, game: summary(updated) });
    } catch (err) {
      fail(res, "teacher patch", err);
    }
  });

  teacherRouter.delete("/doc-games/:id/items/:itemId", async (req, res) => {
    try {
      const rec = await ownGame(req, res);
      if (!rec) return;
      const game = JSON.parse(JSON.stringify(rec.game));
      let removed = false;
      game.levels.forEach((l) => {
        const before = l.items.length;
        l.items = l.items.filter((it) => it.id !== req.params.itemId);
        if (l.items.length !== before) removed = true;
      });
      if (!removed) return res.status(404).json({ success: false, message: "Question not found." });
      game.levels = game.levels.filter((l) => l.items.length > 0);
      if (!game.levels.some((l) => l.type !== "FLASHCARD")) {
        return res.status(400).json({ success: false, message: "A game needs at least one question. Delete the whole game instead." });
      }
      game.stats = { ...game.stats, levels: game.levels.length, questions: game.levels.filter((l) => l.type !== "FLASHCARD").reduce((n, l) => n + l.items.length, 0) };
      game.stats.maxXp = game.levels
        .filter((l) => l.type !== "FLASHCARD")
        .reduce((s, l) => s + l.items.reduce((a, it) => a + (it.type === "MATCH" ? gen.XP_PER_ITEM.MATCH * it.terms.length : gen.XP_PER_ITEM[it.type] || 0), 0), 0);
      const updated = await store.update(rec.id, { game, stats: game.stats });
      res.json({ success: true, game: { ...summary(updated), levels: game.levels } });
    } catch (err) {
      fail(res, "teacher delete item", err);
    }
  });

  teacherRouter.delete("/doc-games/:id", async (req, res) => {
    try {
      const rec = await ownGame(req, res);
      if (!rec) return;
      await store.remove(rec.id);
      res.json({ success: true });
    } catch (err) {
      fail(res, "teacher delete", err);
    }
  });

  // ======================================================================
  // STUDENT
  // ======================================================================
  const studentRouter = express.Router();
  studentRouter.use(requireStudent);

  const playable = (rec) => ({
    id: rec.id,
    sourceType: rec.sourceType,
    ...gen.toPlayable(rec.game),
  });

  studentRouter.post("/open", async (req, res) => {
    try {
      if (!allowOpen(req.userId)) {
        return res.status(429).json({ success: false, message: "Too many attempts. Please wait a few minutes." });
      }
      const code = String(req.body?.code || "").trim().toUpperCase();
      if (!/^GM-[A-Z0-9]{6}$/.test(code)) {
        return res.status(400).json({ success: false, message: "Enter a valid game code (looks like GM-7K3F9Q)." });
      }
      const rec = await store.findByCode(code);
      if (!rec || rec.status !== "PUBLISHED") {
        return res.status(404).json({ success: false, message: "Invalid code, or this game is not published." });
      }
      res.json({ success: true, game: playable(rec) });
    } catch (err) {
      fail(res, "student open", err);
    }
  });

  async function saveStudentGame(req, res, { sourceType, topicId, title, text, bankQuestions }) {
    if (!allowGeneration(req.userId)) {
      return res.status(429).json({ success: false, message: "You have made a lot of games this hour. Play a few first!" });
    }
    const opts = parseOptions(req.body || {});
    if (opts.error) return res.status(400).json({ success: false, message: opts.error });

    let game;
    try {
      game = buildFromText(text, { ...opts, title, bankQuestions });
    } catch (err) {
      if (err.code === "TEXT_TOO_SHORT" || err.code === "NOT_ENOUGH_FACTS") {
        return res.status(422).json({ success: false, code: err.code, message: err.message });
      }
      throw err;
    }

    // same student + same text + same settings = reuse the game they already have
    const existing = await store.findSame(req.userId, game.sourceHash, game.difficulty, game.variant);
    if (existing) return res.json({ success: true, reused: true, game: playable(existing) });

    const rec = await store.create({
      ownerId: req.userId,
      ownerRole: "STUDENT",
      sourceType,
      materialId: null,
      topicId: topicId ? String(topicId) : null,
      title,
      difficulty: game.difficulty,
      status: "DRAFT",
      accessCode: null,
      sourceHash: game.sourceHash,
      game,
      stats: game.stats,
    });
    return res.status(201).json({ success: true, reused: false, game: playable(rec) });
  }

  studentRouter.post("/from-text", async (req, res) => {
    try {
      const text = String(req.body?.text || "");
      if (text.trim().length < gen.MIN_TEXT_CHARS) {
        return res.status(400).json({ success: false, message: `Paste at least ${gen.MIN_TEXT_CHARS} characters of notes or a topic.` });
      }
      const title = String(req.body?.title || "My Study Game").trim().slice(0, 120);
      await saveStudentGame(req, res, { sourceType: "TEXT", topicId: null, title, text });
    } catch (err) {
      fail(res, "student from-text", err);
    }
  });

  async function loadTopic(topicId) {
    let name = null;
    let bodies = [];
    let bank = [];
    if (useDb() && prisma?.learningContent && MOCK_ID.test(topicId)) {
      const contents = await prisma.learningContent.findMany({
        where: { topicId, status: "PUBLISHED" },
        orderBy: { order: "asc" },
        select: { title: true, body: true },
      });
      bodies = contents.map((c) => `${c.title}.\n\n${c.body}`);
      const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { name: true } });
      name = topic?.name || null;
      if (prisma.question) {
        bank = await prisma.question.findMany({ where: { topicId, status: "PUBLISHED" }, take: 40 });
      }
    }
    if (!bodies.length) {
      try {
        const cs = require("../curriculum-service");
        bodies = cs.getFallbackContent(topicId).map((c) => `${c.title}.\n\n${c.body}`);
        name = name || cs.getFallbackTopicById(topicId)?.name || null;
        if (!bank.length) bank = cs.getFallbackQuestions(topicId, 40);
      } catch {
        /* no fallback available */
      }
    }
    return { name, bodies, bank };
  }

  // One topic ({ topicId }) or several at once ({ topicIds: [...] }, up to 10) - e.g. a whole chapter.
  studentRouter.post("/from-topic", async (req, res) => {
    try {
      const ids = (Array.isArray(req.body?.topicIds) && req.body.topicIds.length ? req.body.topicIds : [req.body?.topicId])
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .slice(0, 10);
      if (!ids.length) return res.status(400).json({ success: false, message: "topicId (or topicIds) is required." });

      const names = [];
      let bodies = [];
      let bank = [];
      for (const id of Array.from(new Set(ids))) {
        const t = await loadTopic(id);
        if (t.name) names.push(t.name);
        bodies = bodies.concat(t.bodies);
        bank = bank.concat(t.bank);
      }
      if (!bodies.length && !bank.length) {
        return res.status(404).json({ success: false, message: "No lesson text found for this topic yet." });
      }
      const fallbackTitle = ids.length === 1 ? names[0] || "Topic Game" : `${names[0] || "Topics"} + ${ids.length - 1} more`;
      const title = String(req.body?.title || fallbackTitle).trim().slice(0, 120);
      await saveStudentGame(req, res, {
        sourceType: "TOPIC",
        topicId: ids.length === 1 ? ids[0] : null,
        title,
        text: bodies.join("\n\n"),
        bankQuestions: bank,
      });
    } catch (err) {
      fail(res, "student from-topic", err);
    }
  });

  studentRouter.get("/mine", async (req, res) => {
    try {
      const list = await store.listByOwner(req.userId);
      res.json({ success: true, games: list.map(summary) });
    } catch (err) {
      fail(res, "student mine", err);
    }
  });

  studentRouter.get("/:id", async (req, res) => {
    try {
      const rec = await store.get(req.params.id);
      if (!rec || rec.ownerId !== req.userId) {
        return res.status(404).json({ success: false, message: "Game not found." });
      }
      res.json({ success: true, game: playable(rec) });
    } catch (err) {
      fail(res, "student get", err);
    }
  });

  studentRouter.post("/:id/submit", async (req, res) => {
    try {
      const rec = await store.get(req.params.id);
      if (!rec) return res.status(404).json({ success: false, message: "Game not found." });

      const isOwner = rec.ownerId === req.userId;
      const code = String(req.body?.code || "").trim().toUpperCase();
      const viaCode = rec.status === "PUBLISHED" && rec.accessCode && code === rec.accessCode;
      if (!isOwner && !viaCode) return res.status(404).json({ success: false, message: "Game not found." });

      if (!req.body || typeof req.body.answers !== "object" || req.body.answers === null) {
        return res.status(400).json({ success: false, message: "answers is required." });
      }

      const result = gen.scoreSubmission(rec.game, req.body.answers);
      const isSelf = rec.ownerRole === "STUDENT";
      const gameKey = `${isSelf ? "doc-self" : "doc-teacher"}:${rec.id}`;

      // XP rules
      const plays = await previousPlays(req.userId, gameKey);
      let multiplier = plays === 0 ? 1 : REPLAY_MULTIPLIER;
      if (isSelf) multiplier *= SELF_GAME_MULTIPLIER;
      let xp = Math.round((result.baseXp + result.bonusXp) * multiplier);
      let capped = false;
      if (isSelf) {
        const room = Math.max(0, SELF_DAILY_XP_CAP - (await selfXpToday(req.userId)));
        if (xp > room) {
          xp = room;
          capped = true;
        }
      }

      const totalXp = await recordPlay({ userId: req.userId, gameKey, result, xp });
      store.update(rec.id, { playCount: (rec.playCount || 0) + 1 }).catch(() => {});

      const badges = [];
      if (result.perfect) badges.push("PERFECT_SCORE");
      if (result.bestStreak >= 5) badges.push("STREAK_5");
      if (result.total && result.score >= 80) badges.push("TOP_SCORER");

      res.status(201).json({
        success: true,
        correct: result.correct,
        total: result.total,
        score: result.score,
        xp,
        baseXp: result.baseXp,
        bonusXp: result.bonusXp,
        xpMultiplier: multiplier,
        dailyCapReached: capped,
        bestStreak: result.bestStreak,
        perfect: result.perfect,
        badges,
        totalXp,
        playerLevel: playerLevel(totalXp),
        results: result.results,
      });
    } catch (err) {
      fail(res, "student submit", err);
    }
  });

  return { teacherRouter, studentRouter };
}

module.exports = { createDocGameRouters };
