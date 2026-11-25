"use strict";
/**
 * Tests for the no-AI document -> game generator.   Run:  node test-doc-games.js
 * (pure logic; needs no database and no network)
 */
const assert = require("assert");
const gen = require("./services/text-game-generator");

const NOTES = `Photosynthesis is the process by which green plants prepare their own food using sunlight, water and carbon dioxide. It takes place mainly in the leaves of the plant.

Chlorophyll is the green pigment present in chloroplasts that absorbs sunlight. Stomata are tiny pores on the surface of leaves that allow exchange of gases. The roots absorb water and minerals from the soil and send them to the leaves through the xylem.

The process of photosynthesis can be summarised in the following steps:
1. Chlorophyll in the leaves absorbs energy from sunlight.
2. Water absorbed by the roots is split into hydrogen and oxygen.
3. Carbon dioxide enters the leaf through the stomata.
4. Hydrogen combines with carbon dioxide to form glucose.
5. Oxygen is released into the air as a by-product.

Glucose is a simple sugar that provides energy to the plant. Extra glucose is stored in the form of starch. Plants that make their own food are called autotrophs. About 21% of the atmosphere is oxygen, which is mostly produced by photosynthesis in plants and algae.

Respiration: the process in which food is broken down to release energy in all living cells. Transpiration refers to the loss of water vapour from the aerial parts of a plant, mainly through stomata. The xylem carries water upward while the phloem carries food to all parts of the plant.`;

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log("PASS", name);
  } catch (e) {
    console.error("FAIL", name, "\n   ", e.message);
    process.exitCode = 1;
  }
};

test("builds levels from plain text without any AI", () => {
  const g = gen.buildGame(NOTES, { title: "Photosynthesis" });
  assert(g.levels.length >= 4);
  assert(g.stats.questions >= 15);
  assert(g.levels.some((l) => l.type === "ORDER"), "numbered steps become an ordering level");
});

test("finds definitions", () => {
  const terms = gen.analyseText(NOTES).definitions.map((d) => d.term.toLowerCase());
  ["photosynthesis", "chlorophyll", "stomata", "respiration"].forEach((t) => assert(terms.includes(t), t));
  assert(!terms.includes("oxygen"), "'Oxygen is released...' is not a definition");
});

test("same text gives the same game; variant gives a different one", () => {
  const a = JSON.stringify(gen.buildGame(NOTES).levels);
  const b = JSON.stringify(gen.buildGame(NOTES).levels);
  const c = JSON.stringify(gen.buildGame(NOTES, { variant: 1 }).levels);
  assert.strictEqual(a, b);
  assert.notStrictEqual(a, c);
});

test("student payload never contains answers", () => {
  const p = JSON.stringify(gen.toPlayable(gen.buildGame(NOTES)));
  assert(!/correctIndex|"answer"|acceptable|correctOrder|"key"|explanation/.test(p));
});

test("quiz options are unique and contain the right answer exactly once", () => {
  gen.buildGame(NOTES).levels.filter((l) => l.type === "QUIZ").forEach((l) =>
    l.items.forEach((it) => {
      assert.strictEqual(new Set(it.options.map((o) => o.toLowerCase())).size, it.options.length);
      assert(it.correctIndex >= 0 && it.correctIndex < it.options.length);
    })
  );
});

test("perfect answers score 100%, empty answers score 0", () => {
  const g = gen.buildGame(NOTES);
  const ans = {};
  g.levels.forEach((l) => l.items.forEach((it) => {
    if (it.type === "QUIZ") ans[it.id] = it.correctIndex;
    if (it.type === "TRUE_FALSE") ans[it.id] = it.answer;
    if (it.type === "FILL_BLANK") ans[it.id] = it.answer;
    if (it.type === "MATCH") ans[it.id] = it.key;
    if (it.type === "ORDER") ans[it.id] = it.correctOrder;
  }));
  const perfect = gen.scoreSubmission(g, ans);
  assert.strictEqual(perfect.score, 100);
  assert(perfect.perfect && perfect.baseXp > 0 && perfect.bonusXp > 0);
  const none = gen.scoreSubmission(g, {});
  assert.strictEqual(none.correct, 0);
  assert.strictEqual(none.baseXp, 0);
});

test("fill-blank accepts case / article / one-letter typo, rejects wrong words", () => {
  assert(gen.answersMatch("  THE Photosynthesis ", "photosynthesis"));
  assert(gen.answersMatch("photosynthesys", "photosynthesis"));
  assert(!gen.answersMatch("respiration", "photosynthesis"));
  assert(!gen.answersMatch("22", "21"), "numbers must be exact");
});

test("too little text is rejected with a clear code", () => {
  assert.throws(() => gen.buildGame("Plants need water."), (e) => e.code === "TEXT_TOO_SHORT");
});

test("existing question bank becomes a quiz level (short lessons still work)", () => {
  const bank = [1, 2, 3, 4].map((i) => ({ text: `Question ${i}?`, optionA: "a", optionB: "b", optionC: "c", optionD: "d", correct: i % 4, explanation: "because" }));
  const g = gen.buildGame("Short lesson text.", { bankQuestions: bank });
  assert.strictEqual(g.levels[0].type, "QUIZ");
  const it = g.levels[0].items[0];
  const orig = bank.find((q) => q.text === it.prompt);
  assert.strictEqual(it.options[it.correctIndex], ["a", "b", "c", "d"][orig.correct]);
});

test("junk lines (CV / contact / headings) are not used as questions", () => {
  const junk = "John Doe | john@example.com | github.com/john | +91 99999 99999\nSKILLS PYTHON JAVA SQL DOCKER KUBERNETES\n".repeat(5);
  assert.throws(() => gen.buildGame(junk), (e) => e.code === "TEXT_TOO_SHORT");
});

console.log(`\n${passed} passed`);
