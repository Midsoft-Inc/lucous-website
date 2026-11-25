"use strict";

/**
 * LUCOUS Text -> Game generator (NO AI, NO external API).
 *
 * Turns plain text (extracted from a teacher document, a topic a student is
 * reading, or pasted notes) into a playable "quest" made of levels:
 *
 *   QUIZ        multiple choice
 *   TRUE_FALSE  true / false statements
 *   FILL_BLANK  type the missing word (with a letter hint)
 *   MATCH       match term <-> meaning
 *   ORDER       put steps in the correct order (only if the text has steps)
 *   FLASHCARD   study cards (no XP, no answer checking)
 *
 * How it works (all deterministic rules):
 *   1. Clean text and split into sentences.
 *   2. Find "definition" sentences:  "X is ...", "X means ...", "X: ...".
 *   3. Score keywords (term frequency x rarity across sentences, boosts for
 *      Capitalised names and numbers).
 *   4. Build questions by hiding a keyword in its sentence (cloze) and using
 *      other keywords of the same "shape" from the same text as wrong options.
 *
 * The same text always gives the same game (seeded shuffle), unless a
 * different `variant` number is passed.
 *
 * `buildGame()` returns the FULL game (with answers) - store this on the
 * server. `toPlayable()` strips answers - send this to students. Scoring is
 * done by `scoreSubmission()` on the server.
 */

const crypto = require("crypto");

const FORMATS = ["QUIZ", "TRUE_FALSE", "FILL_BLANK", "MATCH", "ORDER", "FLASHCARD"];
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];

const MIN_TEXT_CHARS = 200;
const MAX_TEXT_CHARS = 60000;
const MIN_SENTENCES = 6;

// XP value of one question by type (match is per correct pair).
const XP_PER_ITEM = { QUIZ: 10, TRUE_FALSE: 8, FILL_BLANK: 15, MATCH: 6, ORDER: 20 };

const DIFFICULTY_RULES = {
  EASY: { options: 3, timeSec: 30, lives: 5, perLevel: 5 },
  MEDIUM: { options: 4, timeSec: 20, lives: 4, perLevel: 6 },
  HARD: { options: 4, timeSec: 12, lives: 3, perLevel: 8 },
};

const STOPWORDS = new Set(
  (
    "a an the and or but if then else when while of at by for with about against between into through during before after above below to from up down in out on off over under again further once " +
    "here there all any both each few more most other some such no nor not only own same so than too very can will just don should now is are was were be been being have has had having do does did doing " +
    "this that these those i me my we our you your he him his she her it its they them their what which who whom whose how why where also may might must shall would could " +
    "one two three four five six seven eight nine ten first second third next last many much often called known used using use based like called given thus hence therefore however " +
    "example examples following include includes including such type types kind kinds way ways thing things part parts form forms called refer refers"
  ).split(/\s+/)
);

const DEFINITION_VERBS =
  "is defined as|are defined as|can be defined as|is called|are called|is known as|are known as|is termed|means|refers to|refer to|is the|is a|is an|are the|are a|are an|is|are|was|were|consists of|contains|states that";

// --------------------------------------------------------------------------
// Small helpers
// --------------------------------------------------------------------------

function hashSeed(str) {
  const h = crypto.createHash("sha256").update(String(str)).digest();
  return h.readUInt32LE(0);
}

function makeRng(seed) {
  // mulberry32
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function words(s) {
  return String(s).match(/[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'’-]*/gu) || [];
}

function isNumeric(s) {
  return /^[\d.,]+%?$/.test(String(s).trim());
}

function isCapitalised(s) {
  return /^\p{Lu}/u.test(String(s).trim());
}

function normalizeAnswer(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{M}\p{N}\s.%-]/gu, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function answersMatch(given, accepted) {
  const g = normalizeAnswer(given);
  if (!g) return false;
  const list = Array.isArray(accepted) ? accepted : [accepted];
  return list.some((acc) => {
    const a = normalizeAnswer(acc);
    if (!a) return false;
    if (g === a) return true;
    if (isNumeric(a) || isNumeric(g)) return false; // numbers must be exact
    // forgive one typo only for longer words
    return a.length >= 6 && levenshtein(g, a) <= 1;
  });
}

function truncateWords(text, maxChars) {
  const t = String(text).trim();
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 30 ? lastSpace : maxChars).replace(/[,;:\s]+$/, "")}…`;
}

// --------------------------------------------------------------------------
// Text -> sentences
// --------------------------------------------------------------------------

function cleanText(raw) {
  return String(raw || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t\u00A0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

const ABBREVIATIONS = ["e.g.", "i.e.", "etc.", "vs.", "Fig.", "fig.", "Dr.", "Mr.", "Mrs.", "Ms.", "Prof.", "No.", "approx.", "Eq.", "eq.", "St."];

function splitSentences(text) {
  let t = text;
  ABBREVIATIONS.forEach((ab, i) => {
    t = t.split(ab).join(ab.replace(/\./g, `§${i}§`));
  });
  // decimals like 3.14 must not split
  t = t.replace(/(\d)\.(\d)/g, "$1§D§$2");

  const out = [];
  t.split(/\n+/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    // Treat each line as its own unit, then split on sentence punctuation (Latin, Devanagari danda, Arabic).
    trimmed
      .split(/(?<=[.!?।؟])\s+(?=[\p{Lu}\p{Lo}\d"'“‘(\[])/u)
      .forEach((s) => {
        let restored = s.trim();
        ABBREVIATIONS.forEach((ab, i) => {
          restored = restored.split(ab.replace(/\./g, `§${i}§`)).join(ab);
        });
        restored = restored.replace(/§D§/g, ".");
        if (restored) out.push(restored);
      });
  });
  return out;
}

function usableSentence(s) {
  const w = words(s);
  if (w.length < 6 || w.length > 40) return false;
  const letters = (s.match(/\p{L}/gu) || []).length;
  if (letters / s.length < 0.55) return false; // tables, formulas, junk
  if (/https?:\/\/|www\./i.test(s)) return false;
  if (/[|@•▪■□●◦]/.test(s)) return false; // contact lines, tables, bullet junk
  if (/\?\s*$/.test(s)) return false; // questions in the source text
  // mostly Capitalised / ALL-CAPS words = headings, name lists, CV lines
  const caps = w.filter((x) => /^\p{Lu}/u.test(x)).length;
  if (w.length >= 8 && caps / w.length > 0.5) return false;
  if (/\b[A-Z]{4,}\b.*\b[A-Z]{4,}\b/.test(s)) return false;
  return true;
}

// --------------------------------------------------------------------------
// Definitions and keywords
// --------------------------------------------------------------------------

function cleanTerm(term) {
  return term
    .replace(/^["'“‘(\[]+|["'”’)\].,:;]+$/g, "")
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function validTerm(term) {
  const w = words(term);
  if (!w.length || w.length > 5) return false;
  if (term.length < 3 || term.length > 50) return false;
  if (w.length === 1 && STOPWORDS.has(w[0].toLowerCase())) return false;
  if (/^(this|that|these|those|it|they|he|she|there|which|what|who)\b/i.test(term)) return false;
  return true;
}

// Words that show a sentence is a statement about something, not a definition
// ("Oxygen is released ...", "Light is essential ...").
const NOT_DEFINITION_START = new Set(
  ("essential important necessary needed required able possible also not very often mostly usually generally always never only " +
    "present found used given made done seen known called shown said considered called located placed produced released stored carried " +
    "available useful difficult easy common").split(/\s+/)
);

function looksLikeDefinition(definition) {
  const first = (words(definition)[0] || "").toLowerCase();
  if (!first) return false;
  if (NOT_DEFINITION_START.has(first)) return false;
  // past participles: "released", "stored", "given" (but allow short words like "red", "open")
  if (first.length > 5 && /(ed|en)$/.test(first)) return false;
  return true;
}

function findDefinitions(sentences) {
  const defs = [];
  const seen = new Set();
  const add = (term, definition, sentence) => {
    term = cleanTerm(term);
    definition = definition
      .replace(/^[\s:–—-]+/, "")
      .replace(/[\s,;]+(and|or|but|which|that|while|because)\s*$/i, "")
      .trim();
    if (!validTerm(term)) return;
    const dw = words(definition);
    if (dw.length < 4 || dw.length > 35) return;
    if (!looksLikeDefinition(definition)) return;
    // the definition must not simply repeat the term
    if (normalizeAnswer(definition).startsWith(normalizeAnswer(term))) return;
    const key = term.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    defs.push({ term, definition: definition.replace(/[.\s]+$/, ""), sentence });
  };

  const verbRe = new RegExp(`^(.{2,60}?)\\s+(?:${DEFINITION_VERBS})\\s+(.{12,})$`, "i");
  const colonRe = /^([^:–—]{2,45})\s*[:–—]\s+(.{12,})$/;
  const calledRe = /^(.{12,}?)\s+(?:is|are)\s+(?:called|known as|termed)\s+(?:the\s+|a\s+|an\s+)?(.{2,50}?)[.]?$/i;

  sentences.forEach((s) => {
    let m = calledRe.exec(s);
    if (m) return add(m[2], m[1], s);
    m = colonRe.exec(s);
    if (m && words(m[1]).length <= 5) return add(m[1], m[2], s);
    m = verbRe.exec(s);
    if (m) {
      const subj = m[1];
      // subject must look like a term, not a whole clause
      if (words(subj).length <= 4 && !/,/.test(subj)) {
        // use the text after the matched verb phrase
        const rest = s.slice(s.toLowerCase().indexOf(m[2].toLowerCase(), subj.length));
        // keep the article/verb out of the definition for "is a/an/the"
        const defText = s.slice(subj.length).replace(new RegExp(`^\\s+(?:${DEFINITION_VERBS})\\s+`, "i"), "");
        add(subj, defText || rest, s);
      }
    }
  });
  return defs;
}

function scoreKeywords(sentences, definitions) {
  const N = sentences.length || 1;
  const tf = new Map(); // lower-case token -> count
  const df = new Map(); // lower-case token -> sentences containing it
  const surface = new Map(); // lower-case token -> most common original form
  const capCount = new Map();

  sentences.forEach((s) => {
    const toks = words(s);
    const seenHere = new Set();
    toks.forEach((tok, idx) => {
      const low = tok.toLowerCase();
      tf.set(low, (tf.get(low) || 0) + 1);
      if (!seenHere.has(low)) {
        seenHere.add(low);
        df.set(low, (df.get(low) || 0) + 1);
      }
      if (!surface.has(low)) surface.set(low, tok);
      if (idx > 0 && isCapitalised(tok)) capCount.set(low, (capCount.get(low) || 0) + 1);
    });
  });

  const defTerms = new Set();
  definitions.forEach((d) => words(d.term).forEach((w) => defTerms.add(w.toLowerCase())));

  const scores = new Map();
  tf.forEach((count, low) => {
    if (STOPWORDS.has(low)) return;
    const tok = surface.get(low);
    const numeric = isNumeric(tok);
    if (!numeric && tok.length < 4) return;
    const docFreq = df.get(low);
    // language-agnostic stopword guard: words in >30% of sentences are filler
    if (N >= 8 && docFreq / N > 0.3) return;
    const idf = 1 + Math.log(N / docFreq);
    let score = Math.min(count, 6) * idf;
    if (capCount.get(low)) score *= 1.6;
    if (defTerms.has(low)) score *= 2;
    if (numeric) score *= 1.2;
    scores.set(low, score);
  });
  return { scores, surface };
}

/**
 * Pick the best blank in a sentence: a multi-word defined term if present,
 * otherwise the highest scoring single token (not the first word).
 */
function chooseBlank(sentence, ctx) {
  // 1) defined terms that appear in this sentence
  let best = null;
  ctx.definitions.forEach((d) => {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(d.term)})(?=$|[^\\p{L}\\p{N}])`, "iu");
    const m = re.exec(sentence);
    if (m && m.index > 0 && d.sentence !== sentence) {
      if (!best || d.term.length > best.length) best = { answer: m[2], start: m.index + m[1].length };
    }
  });
  if (best) return best;

  // 2) best single token
  const re = /[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'’-]*/gu;
  let m;
  let top = null;
  while ((m = re.exec(sentence))) {
    if (m.index === 0) continue; // never blank the first word
    const low = m[0].toLowerCase();
    const sc = ctx.scores.get(low);
    if (!sc) continue;
    if (!top || sc > top.score) top = { answer: m[0], start: m.index, score: sc };
  }
  return top;
}

function blankOut(sentence, blank) {
  return `${sentence.slice(0, blank.start)}_____${sentence.slice(blank.start + blank.answer.length)}`;
}

// --------------------------------------------------------------------------
// Distractors
// --------------------------------------------------------------------------

function numericDistractors(answer, rng) {
  const raw = String(answer).replace(/,/g, "");
  const pct = raw.endsWith("%");
  const num = parseFloat(raw);
  if (!isFinite(num)) return [];
  const isInt = Number.isInteger(num);
  const fmt = (v) => `${isInt ? Math.round(v) : Math.round(v * 100) / 100}${pct ? "%" : ""}`;
  const candidates = isInt
    ? [num + 1, num - 1, num + 2, num * 2, Math.round(num / 2), num + 10, num - 2, num + 5]
    : [num * 2, num / 2, num + 1, num - 1, num * 10, num / 10];
  return shuffle(
    Array.from(new Set(candidates.filter((v) => v >= 0 && v !== num).map(fmt))),
    rng
  );
}

/** Wrong options for `answer`, taken from other keywords in the same text. */
function buildDistractors(answer, sentence, ctx, count, rng, hard) {
  const ansLow = answer.toLowerCase();
  if (isNumeric(answer)) {
    const fromText = ctx.numbers.filter((n) => n !== answer);
    const gen = numericDistractors(answer, rng);
    return Array.from(new Set([...shuffle(fromText, rng).slice(0, 1), ...gen])).slice(0, count);
  }

  const sentLow = sentence.toLowerCase();
  const wantCap = isCapitalised(answer);
  const multi = words(answer).length > 1;

  let pool = ctx.candidates.filter((c) => {
    const low = c.toLowerCase();
    if (low === ansLow || ansLow.includes(low) || low.includes(ansLow)) return false;
    if (sentLow.includes(low)) return false; // never offer a word that is in the question itself
    if (isNumeric(c)) return false;
    if (isCapitalised(c) !== wantCap) return false;
    return true;
  });

  if (hard) {
    // hardest = most similar length and word count
    pool = pool
      .map((c) => ({ c, d: Math.abs(c.length - answer.length) + (words(c).length === words(answer).length ? 0 : 4) }))
      .sort((a, b) => a.d - b.d || (a.c < b.c ? -1 : 1))
      .slice(0, Math.max(count * 3, 8))
      .map((x) => x.c);
  } else if (!multi) {
    pool = pool.filter((c) => words(c).length === 1 || rng() > 0.7);
  }
  return shuffle(pool, rng).slice(0, count);
}

// --------------------------------------------------------------------------
// Item builders
// --------------------------------------------------------------------------

function makeId(prefix, n) {
  return `${prefix}${n + 1}`;
}

function buildQuiz(ctx, rules, rng) {
  const items = [];
  const used = new Set();
  const optionCount = rules.options;

  // A) "Which term is described as ...?" from definitions
  shuffle(ctx.definitions, rng).forEach((d) => {
    if (items.length >= rules.perLevel) return;
    if (words(d.definition).length > 28) return;
    const wrong = ctx.definitions
      .filter((o) => o.term.toLowerCase() !== d.term.toLowerCase() && !d.definition.toLowerCase().includes(o.term.toLowerCase()))
      .map((o) => o.term);
    const distractors = shuffle(wrong, rng).slice(0, optionCount - 1);
    if (distractors.length < optionCount - 1) return;
    const options = shuffle([d.term, ...distractors], rng);
    items.push({
      type: "QUIZ",
      prompt: `Which term matches this description?\n“${truncateWords(d.definition, 220)}”`,
      options,
      correctIndex: options.indexOf(d.term),
      explanation: `${d.sentence}`,
    });
    used.add(d.sentence);
  });

  // B) Cloze questions from the rest of the sentences
  shuffle(ctx.sentences, rng).forEach((s) => {
    if (items.length >= rules.perLevel) return;
    if (used.has(s)) return;
    const blank = chooseBlank(s, ctx);
    if (!blank) return;
    const distractors = buildDistractors(blank.answer, s, ctx, optionCount - 1, rng, rules.options === 4 && rules.timeSec <= 12);
    if (distractors.length < optionCount - 1) return;
    const options = shuffle([blank.answer, ...distractors], rng);
    items.push({
      type: "QUIZ",
      prompt: `Fill in the missing word:\n${blankOut(s, blank)}`,
      options,
      correctIndex: options.indexOf(blank.answer),
      explanation: s,
    });
    used.add(s);
  });

  return items.map((it, i) => ({ id: makeId("q", i), ...it }));
}

function buildTrueFalse(ctx, rules, rng) {
  const items = [];
  const target = rules.perLevel;
  const sentences = shuffle(ctx.sentences, rng);
  let wantFalse = false;

  for (const s of sentences) {
    if (items.length >= target) break;
    const blank = chooseBlank(s, ctx);
    if (!blank) continue;

    if (wantFalse) {
      const [swap] = buildDistractors(blank.answer, s, ctx, 1, rng, rules.timeSec <= 12);
      if (!swap) continue;
      items.push({
        type: "TRUE_FALSE",
        prompt: `${s.slice(0, blank.start)}${swap}${s.slice(blank.start + blank.answer.length)}`,
        answer: false,
        explanation: `Not correct. The text says: ${s}`,
      });
    } else {
      items.push({
        type: "TRUE_FALSE",
        prompt: s,
        answer: true,
        explanation: "This statement comes straight from the text.",
      });
    }
    wantFalse = !wantFalse;
  }
  return items.map((it, i) => ({ id: makeId("t", i), ...it }));
}

function buildFillBlank(ctx, rules, rng) {
  const items = [];
  const target = rules.perLevel;
  for (const s of shuffle(ctx.sentences, rng)) {
    if (items.length >= target) break;
    const blank = chooseBlank(s, ctx);
    if (!blank) continue;
    if (words(blank.answer).length > 3) continue;
    const ans = blank.answer;
    const hint = `${ans[0]}${" _".repeat(Math.max(0, ans.length - 1))}  (${ans.length} letters)`;
    items.push({
      type: "FILL_BLANK",
      prompt: blankOut(s, blank),
      hint,
      answer: ans,
      acceptable: [ans],
      explanation: s,
    });
  }
  return items.map((it, i) => ({ id: makeId("f", i), ...it }));
}

function buildMatch(ctx, rules, rng) {
  const defs = ctx.definitions.filter((d) => words(d.definition).length <= 22);
  if (defs.length < 3) return [];
  const pairsPerRound = Math.min(4, defs.length);
  const rounds = Math.max(1, Math.min(Math.ceil(rules.perLevel / 4), Math.floor(defs.length / pairsPerRound) || 1));
  const shuffled = shuffle(defs, rng);
  const items = [];
  for (let r = 0; r < rounds; r++) {
    const chunk = shuffled.slice(r * pairsPerRound, r * pairsPerRound + pairsPerRound);
    if (chunk.length < 3) break;
    const terms = chunk.map((d, i) => ({ id: `m${r + 1}t${i + 1}`, text: d.term }));
    const meanings = chunk.map((d, i) => ({ id: `m${r + 1}d${i + 1}`, text: truncateWords(d.definition, 110) }));
    const key = {};
    terms.forEach((t, i) => {
      key[t.id] = meanings[i].id;
    });
    items.push({
      id: `m${r + 1}`,
      type: "MATCH",
      prompt: "Match each term with its meaning",
      terms,
      meanings: shuffle(meanings, rng),
      key,
      explanation: chunk.map((d) => `${d.term}: ${d.definition}`).join("\n"),
    });
  }
  return items;
}

/** Looks for numbered steps ("1. ...", "Step 2: ...") or First/Then/Finally runs. */
function buildOrder(rawText, ctx, rng) {
  const lines = rawText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const groups = [];
  let cur = [];
  let lastNum = 0;
  const numRe = /^(?:step\s*)?(\d{1,2})\s*[.):\-–]\s*(.{6,200})$/i;
  lines.forEach((line) => {
    const m = numRe.exec(line);
    if (m) {
      const n = Number(m[1]);
      if (n === 1 || n === lastNum + 1) {
        if (n === 1 && cur.length) {
          if (cur.length >= 3) groups.push(cur);
          cur = [];
        }
        cur.push(m[2].replace(/[.\s]+$/, ""));
        lastNum = n;
        return;
      }
    }
    if (cur.length >= 3) groups.push(cur);
    cur = [];
    lastNum = 0;
  });
  if (cur.length >= 3) groups.push(cur);

  // First/Next/Then/Finally sentences in a row
  const seqRe = /^(first(?:ly)?|second(?:ly)?|third(?:ly)?|next|then|after that|finally|lastly)\b[\s,]+(.{8,})$/i;
  let run = [];
  ctx.allSentences.forEach((s) => {
    const m = seqRe.exec(s);
    if (m) run.push(s.replace(/[.\s]+$/, ""));
    else {
      if (run.length >= 3) groups.push(run);
      run = [];
    }
  });
  if (run.length >= 3) groups.push(run);

  return groups.slice(0, 3).map((steps, gi) => {
    const clipped = steps.slice(0, 6).map((s) => truncateWords(s, 140));
    const ids = clipped.map((_, i) => `o${gi + 1}s${i + 1}`);
    const steps_ = clipped.map((text, i) => ({ id: ids[i], text }));
    return {
      id: `o${gi + 1}`,
      type: "ORDER",
      prompt: "Put these steps in the correct order",
      steps: shuffle(steps_, rng),
      correctOrder: ids,
      explanation: clipped.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    };
  });
}

/** Curated questions already in LUCOUS (Question table / curriculum bank) -> quiz items. */
function normalizeBank(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((q) => {
      const options = [q.optionA, q.optionB, q.optionC, q.optionD].map((o) => String(o ?? "").trim());
      const correct = Number(q.correct);
      if (!q.text || options.some((o) => !o) || !Number.isInteger(correct) || correct < 0 || correct > 3) return null;
      return { text: String(q.text).trim(), options, correct, explanation: q.explanation ? String(q.explanation).trim() : "" };
    })
    .filter(Boolean)
    .slice(0, 40);
}

function buildBankQuiz(bank, rules, rng) {
  return shuffle(bank, rng)
    .slice(0, Math.max(rules.perLevel, 6))
    .map((q, i) => {
      const order = shuffle([0, 1, 2, 3], rng);
      const options = order.map((idx) => q.options[idx]);
      return {
        id: makeId("b", i),
        type: "QUIZ",
        prompt: q.text,
        options,
        correctIndex: order.indexOf(q.correct),
        explanation: q.explanation || `Correct answer: ${q.options[q.correct]}`,
      };
    });
}

function buildFlashcards(ctx, rng) {
  const cards = [];
  ctx.definitions.forEach((d) => {
    cards.push({ front: d.term, back: truncateWords(d.definition, 200) });
  });
  if (cards.length < 6) {
    ctx.keywords.slice(0, 20).forEach((kw) => {
      if (cards.length >= 12) return;
      const s = ctx.sentences.find((x) => new RegExp(`\\b${escapeRegExp(kw)}\\b`, "i").test(x) && !ctx.definitions.some((d) => d.sentence === x));
      if (s) cards.push({ front: kw, back: truncateWords(s, 200) });
    });
  }
  return shuffle(cards, rng)
    .slice(0, 20)
    .map((c, i) => ({ id: makeId("c", i), type: "FLASHCARD", ...c }));
}

// --------------------------------------------------------------------------
// Public: build a game
// --------------------------------------------------------------------------

function analyseText(text) {
  const clean = cleanText(text);
  const allSentences = splitSentences(clean);
  const sentences = allSentences.filter(usableSentence);
  const definitions = findDefinitions(sentences);
  const { scores, surface } = scoreKeywords(sentences, definitions);

  const keywordsLow = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([low]) => surface.get(low));

  // candidates = single keywords + defined terms (used as wrong options)
  const candidates = Array.from(new Set([...keywordsLow, ...definitions.map((d) => d.term)]));
  const numbers = Array.from(new Set((clean.match(/\b\d+(?:\.\d+)?%?/g) || []).filter((n) => n.length <= 6))).slice(0, 30);

  return {
    clean,
    allSentences,
    sentences,
    definitions,
    scores,
    keywords: keywordsLow,
    candidates,
    numbers,
  };
}

/**
 * @param {string} text
 * @param {object} [opts]
 * @param {string} [opts.title]
 * @param {string} [opts.difficulty]  EASY | MEDIUM | HARD
 * @param {string[]} [opts.formats]   subset of FORMATS (default: all that the text can support)
 * @param {number} [opts.variant]     change to get a different set from the same text
 * @param {object[]} [opts.bankQuestions] existing curated questions ({text, optionA..D, correct, explanation})
 */
function buildGame(text, opts = {}) {
  const difficulty = DIFFICULTIES.includes(String(opts.difficulty).toUpperCase())
    ? String(opts.difficulty).toUpperCase()
    : "MEDIUM";
  const rules = DIFFICULTY_RULES[difficulty];
  const wanted = (Array.isArray(opts.formats) && opts.formats.length ? opts.formats : FORMATS)
    .map((f) => String(f).toUpperCase())
    .filter((f) => FORMATS.includes(f));

  const ctx = analyseText(text);
  const bank = normalizeBank(opts.bankQuestions);
  const textOk = ctx.clean.length >= MIN_TEXT_CHARS && ctx.sentences.length >= MIN_SENTENCES;
  if (!textOk && bank.length < 3) {
    const err = new Error(
      `Not enough readable text to build a game (need at least ${MIN_TEXT_CHARS} characters and ${MIN_SENTENCES} normal sentences). If this came from a PDF, try a .docx or .txt version.`
    );
    err.code = "TEXT_TOO_SHORT";
    throw err;
  }

  const sourceHash = crypto
    .createHash("sha256")
    .update(`${ctx.clean}|${bank.map((q) => q.text).join("|")}`)
    .digest("hex")
    .slice(0, 24);
  const variant = Number(opts.variant) || 0;
  const rng = makeRng(hashSeed(`${sourceHash}:${difficulty}:${variant}`));

  const levels = [];
  const add = (type, title, icon, items) => {
    if (items.length) levels.push({ id: `L${levels.length + 1}`, type, title, icon, items });
  };

  if (textOk && wanted.includes("FLASHCARD")) {
    const cards = buildFlashcards(ctx, rng);
    if (cards.length >= 3) add("FLASHCARD", "Warm-up: Flip Cards", "🃏", cards);
  }
  if (bank.length >= 3 && wanted.includes("QUIZ")) add("QUIZ", "Curriculum Quiz", "📘", buildBankQuiz(bank, rules, rng));
  if (textOk) {
    if (wanted.includes("QUIZ")) add("QUIZ", "Quiz Arena", "🎯", buildQuiz(ctx, rules, rng));
    if (wanted.includes("MATCH")) add("MATCH", "Match the Pairs", "🧩", buildMatch(ctx, rules, rng));
    if (wanted.includes("TRUE_FALSE")) add("TRUE_FALSE", "True or False Blitz", "⚡", buildTrueFalse(ctx, rules, rng));
    if (wanted.includes("ORDER")) add("ORDER", "Sequence Challenge", "🔢", buildOrder(ctx.clean, ctx, rng));
    if (wanted.includes("FILL_BLANK")) add("FILL_BLANK", "Boss Level: Fill the Blank", "👑", buildFillBlank(ctx, rules, rng));
  }

  const playable = levels.filter((l) => l.type !== "FLASHCARD");
  if (!playable.length) {
    const err = new Error("This text did not contain enough clear facts or definitions to make questions. Try a longer or more detailed document.");
    err.code = "NOT_ENOUGH_FACTS";
    throw err;
  }

  const maxXp = playable.reduce(
    (sum, l) =>
      sum +
      l.items.reduce((s, it) => {
        if (it.type === "MATCH") return s + XP_PER_ITEM.MATCH * it.terms.length;
        return s + (XP_PER_ITEM[it.type] || 0);
      }, 0),
    0
  );

  return {
    title: opts.title || null,
    difficulty,
    rules: { lives: rules.lives, timeSec: rules.timeSec },
    sourceHash,
    variant,
    stats: {
      characters: ctx.clean.length,
      sentences: ctx.sentences.length,
      definitionsFound: ctx.definitions.length,
      keywords: ctx.keywords.slice(0, 15),
      levels: levels.length,
      questions: playable.reduce((n, l) => n + l.items.length, 0),
      maxXp,
    },
    levels,
  };
}

// --------------------------------------------------------------------------
// Playable (answers stripped) + scoring
// --------------------------------------------------------------------------

function toPlayable(game) {
  return {
    title: game.title,
    difficulty: game.difficulty,
    rules: game.rules,
    stats: { levels: game.stats.levels, questions: game.stats.questions, maxXp: game.stats.maxXp },
    levels: game.levels.map((l) => ({
      id: l.id,
      type: l.type,
      title: l.title,
      icon: l.icon,
      items: l.items.map((it) => {
        switch (it.type) {
          case "QUIZ":
            return { id: it.id, type: it.type, prompt: it.prompt, options: it.options };
          case "TRUE_FALSE":
            return { id: it.id, type: it.type, prompt: it.prompt };
          case "FILL_BLANK":
            return { id: it.id, type: it.type, prompt: it.prompt, hint: it.hint };
          case "MATCH":
            return { id: it.id, type: it.type, prompt: it.prompt, terms: it.terms, meanings: it.meanings };
          case "ORDER":
            return { id: it.id, type: it.type, prompt: it.prompt, steps: it.steps };
          default: // FLASHCARD is study-only; the answer is the point
            return { id: it.id, type: it.type, front: it.front, back: it.back };
        }
      }),
    })),
  };
}

/**
 * Scores a submission on the server.
 * @param {object} game     full game (with answers)
 * @param {object} answers  { [itemId]: value }
 *   QUIZ -> option index, TRUE_FALSE -> boolean, FILL_BLANK -> string,
 *   MATCH -> { [termId]: meaningId }, ORDER -> [stepId, ...]
 */
function scoreSubmission(game, answers) {
  const given = answers && typeof answers === "object" ? answers : {};
  const results = [];
  let earnedXp = 0;
  let maxXp = 0;
  let correctCount = 0;
  let totalCount = 0;
  let streak = 0;
  let bestStreak = 0;
  let streakBonus = 0;

  game.levels.forEach((level) => {
    if (level.type === "FLASHCARD") return;
    level.items.forEach((it) => {
      const a = given[it.id];
      let fraction = 0;
      let xpMax = XP_PER_ITEM[it.type] || 0;
      let detail = null;

      if (it.type === "QUIZ") {
        fraction = Number.isInteger(a) && a === it.correctIndex ? 1 : 0;
        detail = { correctIndex: it.correctIndex };
      } else if (it.type === "TRUE_FALSE") {
        fraction = typeof a === "boolean" && a === it.answer ? 1 : 0;
        detail = { answer: it.answer };
      } else if (it.type === "FILL_BLANK") {
        fraction = typeof a === "string" && answersMatch(a, it.acceptable) ? 1 : 0;
        detail = { answer: it.answer };
      } else if (it.type === "MATCH") {
        const pairs = a && typeof a === "object" ? a : {};
        const right = it.terms.filter((t) => pairs[t.id] === it.key[t.id]).length;
        fraction = it.terms.length ? right / it.terms.length : 0;
        xpMax = XP_PER_ITEM.MATCH * it.terms.length;
        detail = { key: it.key };
      } else if (it.type === "ORDER") {
        const seq = Array.isArray(a) ? a : [];
        const right = it.correctOrder.filter((id, i) => seq[i] === id).length;
        fraction = seq.length === it.correctOrder.length ? right / it.correctOrder.length : 0;
        detail = { correctOrder: it.correctOrder };
      }

      const isCorrect = fraction === 1;
      totalCount += 1;
      if (isCorrect) {
        correctCount += 1;
        streak += 1;
        bestStreak = Math.max(bestStreak, streak);
        if (streak > 2) streakBonus = Math.min(streakBonus + 2, 20);
      } else {
        streak = 0;
      }

      maxXp += xpMax;
      earnedXp += xpMax * fraction;
      results.push({ id: it.id, type: it.type, correct: isCorrect, fraction: Math.round(fraction * 100) / 100, explanation: it.explanation, ...detail });
    });
  });

  const perfect = totalCount > 0 && correctCount === totalCount;
  const baseXp = Math.round(earnedXp);
  const bonusXp = baseXp > 0 ? streakBonus + (perfect ? Math.round(maxXp * 0.2) : 0) : 0;
  return {
    correct: correctCount,
    total: totalCount,
    score: totalCount ? Math.round((correctCount / totalCount) * 10000) / 100 : 0,
    baseXp,
    bonusXp,
    bestStreak,
    perfect,
    maxXp,
    results,
  };
}

module.exports = {
  FORMATS,
  DIFFICULTIES,
  MIN_TEXT_CHARS,
  MIN_SENTENCES,
  MAX_TEXT_CHARS,
  XP_PER_ITEM,
  buildGame,
  toPlayable,
  scoreSubmission,
  // exported for tests
  analyseText,
  splitSentences,
  findDefinitions,
  answersMatch,
  cleanText,
};
