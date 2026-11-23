"use strict";

/**
 * LUCOUS learning engagement engine (Phase 1).
 *
 * Reads the attempts and lesson progress that already exist, works out a
 * mastery level per topic, recommends the next activity, and decides whether a
 * reminder is worth sending. Rules are plain and explainable; there is no
 * machine learning yet.
 *
 *   Student action -> state -> recommendation -> reminder -> student response
 */

const IST = "Asia/Kolkata";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const LIMITS = {
  maxPerDay: 3, // reminders per student per day (IST)
  maxPerRun: 2, // new reminders created by one check
  cooldownMs: 20 * HOUR, // same task is not repeated sooner than this
  quietStartHour: 22, // no new reminders from 22:00 ...
  quietEndHour: 7, // ... until 07:00 IST
  weakBelow: 0.5, // below this mastery a topic counts as weak
  weakIdleMs: 12 * HOUR, // do not nudge right after the student worked on it
  practiceIdleMs: 6 * HOUR,
  comebackAfterMs: 3 * DAY,
};

// Meaningful event types the app may record (UI clicks are not events).
const EVENT_TYPES = new Set([
  "lesson_started", "lesson_completed", "video_completed", "topic_opened",
  "practice_started", "practice_completed", "hint_used", "retry_started",
  "test_started", "test_completed", "test_abandoned",
  "game_started", "game_completed",
  "ai_question_asked", "explanation_requested",
  "subject_opened", "resource_opened", "search_performed",
  "session_started", "session_ended",
]);

const MOCK_ID = /^[a-f0-9]{24}$/i;
const isMongoId = (v) => typeof v === "string" && MOCK_ID.test(v);

function enabled(prisma) {
  return Boolean(
    process.env.MONGODB_URI &&
      prisma &&
      prisma.studentNotification &&
      prisma.studentEvent &&
      prisma.studentEngagementSettings
  );
}

// ------------------------------- time helpers --------------------------------
const istDayKey = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(d);
const istHour = (d) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "2-digit", hourCycle: "h23" }).format(d));
function isQuietHours(d) {
  const h = istHour(d);
  return h >= LIMITS.quietStartHour || h < LIMITS.quietEndHour;
}

// --------------------------------- data load ---------------------------------
async function loadStudentData(prisma, userId) {
  const [attempts, progress, lastEvent] = await Promise.all([
    prisma.attempt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { topicId: true, mode: true, correct: true, total: true, createdAt: true },
    }),
    prisma.studentProgress.findMany({
      where: { userId },
      select: { completedAt: true, content: { select: { topicId: true } } },
    }),
    prisma.studentEvent.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const ids = new Set();
  attempts.forEach((a) => ids.add(String(a.topicId)));
  progress.forEach((p) => p.content && ids.add(String(p.content.topicId)));
  const topicIds = [...ids];

  let topics = [];
  let contents = [];
  if (topicIds.length) {
    [topics, contents] = await Promise.all([
      prisma.topic.findMany({
        where: { id: { in: topicIds } },
        select: {
          id: true,
          name: true,
          chapter: { select: { name: true, subject: { select: { name: true } } } },
        },
      }),
      prisma.learningContent.findMany({
        where: { topicId: { in: topicIds }, status: "PUBLISHED" },
        select: { topicId: true },
      }),
    ]);
  }
  return { attempts, progress, lastEvent, topics, contents };
}

// ------------------------------ learning state -------------------------------
const frac = (a) => (a.total > 0 ? Math.min(1, a.correct / a.total) : 0);
const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const round2 = (n) => Math.round(n * 100) / 100;
const maxDate = (dates) => dates.reduce((m, d) => (!m || d > m ? d : m), null);

/**
 * Mastery = recent accuracy x 0.50 + latest test x 0.30 + completion x 0.10
 *           + consistency x 0.10   (parts that do not exist yet are left out
 *           and the remaining weights are scaled up).
 */
function masteryFor(assessed, completion, now) {
  const parts = [];
  if (assessed.length) {
    parts.push([0.5, avg(assessed.slice(-3).map(frac))]);
    const tests = assessed.filter((a) => a.mode === "TEST" || a.mode === "RETEST");
    if (tests.length) parts.push([0.3, frac(tests[tests.length - 1])]);
    const days = new Set(
      assessed.filter((a) => now - a.createdAt <= 14 * DAY).map((a) => istDayKey(a.createdAt))
    );
    parts.push([0.1, Math.min(days.size, 4) / 4]);
  }
  if (completion != null) parts.push([0.1, completion]);
  if (!parts.length) return null;
  const w = parts.reduce((s, p) => s + p[0], 0);
  return round2(parts.reduce((s, p) => s + p[0] * p[1], 0) / w);
}

function statusFor(mastery) {
  if (mastery == null) return "not-practised";
  if (mastery < 0.4) return "needs-foundation";
  if (mastery < 0.7) return "developing";
  if (mastery < 0.85) return "strong";
  return "mastered";
}

function computeState(data, now = new Date()) {
  const meta = new Map(
    data.topics.map((t) => [
      String(t.id),
      { name: t.name, subject: t.chapter?.subject?.name || null, chapter: t.chapter?.name || null },
    ])
  );
  const totalContent = new Map();
  data.contents.forEach((c) => {
    const k = String(c.topicId);
    totalContent.set(k, (totalContent.get(k) || 0) + 1);
  });
  const done = new Map(); // topicId -> { count, last }
  data.progress.forEach((p) => {
    if (!p.content) return;
    const k = String(p.content.topicId);
    const cur = done.get(k) || { count: 0, last: null };
    cur.count += 1;
    cur.last = maxDate([cur.last, new Date(p.completedAt)].filter(Boolean));
    done.set(k, cur);
  });
  const byTopic = new Map();
  data.attempts
    .filter((a) => a.mode !== "PLAY")
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((a) => {
      const k = String(a.topicId);
      if (!byTopic.has(k)) byTopic.set(k, []);
      byTopic.get(k).push({ ...a, createdAt: new Date(a.createdAt) });
    });

  const topicIds = new Set([...byTopic.keys(), ...done.keys()]);
  const topics = [];
  for (const id of topicIds) {
    const assessed = byTopic.get(id) || [];
    const d = done.get(id) || { count: 0, last: null };
    const total = totalContent.get(id) || 0;
    const completion = total > 0 ? Math.min(1, d.count / total) : null;
    const mastery = masteryFor(assessed, completion, now);
    const lastActivityAt = maxDate(
      [assessed.length ? assessed[assessed.length - 1].createdAt : null, d.last].filter(Boolean)
    );
    const m = meta.get(id) || { name: "this topic", subject: null, chapter: null };
    topics.push({
      topicId: id,
      name: m.name,
      subject: m.subject,
      chapter: m.chapter,
      mastery,
      status: statusFor(mastery),
      attempts: assessed.length,
      lessonsCompleted: d.count,
      lastActivityAt,
      lastLessonAt: d.last,
    });
  }

  const overall = maxDate(
    [
      ...data.attempts.map((a) => new Date(a.createdAt)),
      ...data.progress.map((p) => new Date(p.completedAt)),
      data.lastEvent ? new Date(data.lastEvent.createdAt) : null,
    ].filter(Boolean)
  );
  return { topics, lastActivityAt: overall };
}

// ----------------------------- recommendations -------------------------------
const pct = (m) => Math.round(m * 100);
const practiceHref = (id) => `/student/practice?topicId=${id}`;
const testHref = (id) => `/student/test?topicId=${id}`;

function recommend(state) {
  const recs = [];
  for (const t of state.topics) {
    const base = { topicId: t.topicId, topicName: t.name, subject: t.subject, mastery: t.mastery };
    if (t.attempts === 0 && t.lessonsCompleted > 0) {
      recs.push({
        ...base, id: `practice:${t.topicId}`, kind: "practice", priority: 70,
        title: `Practise ${t.name}`,
        reason: `You finished the ${t.name} lesson but haven't practised it yet. Ten questions will show what stuck.`,
        href: practiceHref(t.topicId),
      });
    } else if (t.mastery != null && t.mastery < 0.4) {
      recs.push({
        ...base, id: `learn:${t.topicId}`, kind: "learn", priority: 90,
        title: `Go back to the basics of ${t.name}`,
        reason: `Your ${t.name} mastery is ${pct(t.mastery)}%. Revisit the lesson with the AI Teacher, then practise.`,
        href: "/student/learn",
      });
    } else if (t.mastery != null && t.mastery < 0.7) {
      recs.push({
        ...base, id: `practice:${t.topicId}`, kind: "practice", priority: 75,
        title: `Practise ${t.name}`,
        reason: `Your ${t.name} mastery is ${pct(t.mastery)}%. Targeted practice can lift it.`,
        href: practiceHref(t.topicId),
      });
    } else if (t.mastery != null && t.mastery < 0.85) {
      recs.push({
        ...base, id: `practice:${t.topicId}`, kind: "practice", priority: 40,
        title: `Keep ${t.name} sharp`,
        reason: `You're at ${pct(t.mastery)}% in ${t.name}. A bit more practice will move you to mastery.`,
        href: practiceHref(t.topicId),
      });
    } else if (t.mastery != null) {
      recs.push({
        ...base, id: `test:${t.topicId}`, kind: "test", priority: 30,
        title: `Take a ${t.name} test`,
        reason: `You're strong in ${t.name} (${pct(t.mastery)}%). A test will confirm it.`,
        href: testHref(t.topicId),
      });
    }
  }
  return recs.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

// ------------------------- reminder candidates & tone ------------------------
function buildCandidates(state, now) {
  const out = [];
  for (const t of state.topics) {
    const idle = t.lastActivityAt ? now - t.lastActivityAt : Infinity;
    if (t.mastery != null && t.mastery < LIMITS.weakBelow && t.attempts > 0 && idle >= LIMITS.weakIdleMs) {
      out.push({
        key: `weak:${t.topicId}`, kind: "weak-topic", topicId: t.topicId, topicName: t.name,
        priority: Math.min(100, Math.round(60 + (LIMITS.weakBelow - t.mastery) * 80)),
        href: practiceHref(t.topicId), activitySince: t.lastActivityAt || new Date(0),
        canBeStrict: true,
      });
    } else if (t.attempts === 0 && t.lessonsCompleted > 0 && t.lastLessonAt && now - t.lastLessonAt >= LIMITS.practiceIdleMs) {
      out.push({
        key: `practice:${t.topicId}`, kind: "practice-missing", topicId: t.topicId, topicName: t.name,
        priority: 65, href: practiceHref(t.topicId), activitySince: t.lastActivityAt || new Date(0),
        canBeStrict: true,
      });
    }
  }
  if (state.lastActivityAt && now - state.lastActivityAt >= LIMITS.comebackAfterMs) {
    out.push({
      key: "comeback", kind: "comeback", topicId: null, topicName: null,
      priority: 30, href: "/student/dashboard", activitySince: state.lastActivityAt,
      canBeStrict: false,
    });
  }
  return out.sort((a, b) => b.priority - a.priority);
}

function toneStats(existing) {
  const stats = {};
  for (const t of ["friendly", "encouraging", "strict"]) stats[t] = { sent: 0, opened: 0, completed: 0 };
  for (const n of existing) {
    const s = stats[n.tone];
    if (!s) continue;
    s.sent += 1;
    if (n.readAt) s.opened += 1;
    if (n.completed) s.completed += 1;
  }
  return stats;
}

/**
 * Stage 1 friendly, stage 2 encouraging, stage 3 strict (firm but respectful).
 * If strict reminders keep being ignored, change approach instead of nagging.
 */
function pickTone(stage, candidate, stats) {
  let tone = stage <= 1 ? "friendly" : stage === 2 ? "encouraging" : "strict";
  if (tone === "strict" && !candidate.canBeStrict) tone = "encouraging";
  if (tone === "strict" && stats.strict.sent >= 2 && stats.strict.opened === 0) tone = "encouraging";
  return tone;
}

function buildMessage(c, tone) {
  const topic = c.topicName;
  const T = {
    "weak-topic": {
      friendly: ["Time to practise", `🎯 ${topic} needs a little attention. A quick 10-question practice can help.`],
      encouraging: ["You're getting there", `🔥 You're making progress. One more ${topic} practice session can strengthen it.`],
      strict: ["Practice still pending", `⚠️ ${topic} is still below target. Complete a practice session today to stay on track.`],
    },
    "practice-missing": {
      friendly: ["Your practice is waiting", `📘 You finished the ${topic} lesson. Practise it now so it sticks.`],
      encouraging: ["One step left", `💪 Your ${topic} lesson is done and practice is the last step. You've got this.`],
      strict: ["Practice incomplete", `⚠️ Your ${topic} practice is still incomplete. Complete it today to stay on schedule.`],
    },
    comeback: {
      friendly: ["We've missed you", "👋 Pick up where you left off. Even 10 minutes today helps."],
      encouraging: ["A short session today", "🌱 A short session today keeps your learning moving."],
      strict: ["A short session today", "🌱 A short session today keeps your learning moving."],
    },
  };
  const [title, message] = T[c.kind][tone];
  return { title, message };
}

// ------------------------------ settings & events ----------------------------
async function getSettings(prisma, userId) {
  const row = await prisma.studentEngagementSettings.findUnique({ where: { userId } });
  return { remindersEnabled: row ? row.remindersEnabled : true };
}
async function saveSettings(prisma, userId, remindersEnabled) {
  await prisma.studentEngagementSettings.upsert({
    where: { userId },
    update: { remindersEnabled },
    create: { userId, remindersEnabled },
  });
  return { remindersEnabled };
}

async function recordEvent(prisma, userId, input) {
  const eventType = String(input.eventType || "");
  if (!EVENT_TYPES.has(eventType)) throw new Error("Unknown event type");
  const int = (v, max) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Math.max(0, Math.min(max, Math.round(Number(v)))) : undefined);
  await prisma.studentEvent.create({
    data: {
      userId,
      eventType,
      topicId: isMongoId(input.topicId) ? input.topicId : undefined,
      resourceId: input.resourceId ? String(input.resourceId).slice(0, 80) : undefined,
      durationSec: int(input.durationSec, 86400),
      score: int(input.score, 100000),
      total: int(input.total, 100000),
    },
  });
}

// ------------------------------ reminder engine ------------------------------
const locks = new Map();
function exclusive(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(key, next);
  next.finally(() => {
    if (locks.get(key) === next) locks.delete(key);
  }).catch(() => {});
  return next;
}

async function refreshNotifications(prisma, userId, now = new Date()) {
  const settings = await getSettings(prisma, userId);
  const data = await loadStudentData(prisma, userId);
  const state = computeState(data, now);
  const candidates = buildCandidates(state, now);
  const byKey = new Map(candidates.map((c) => [c.key, c]));

  const existing = await prisma.studentNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // 1. Close reminders whose task is finished, or that the student acted on.
  const toClose = existing.filter((n) => {
    if (n.resolvedAt) return false;
    const c = byKey.get(n.key);
    return !c || c.activitySince > new Date(n.createdAt);
  });
  if (toClose.length) {
    await prisma.studentNotification.updateMany({
      where: { id: { in: toClose.map((n) => n.id) } },
      data: { resolvedAt: now, completed: true },
    });
    toClose.forEach((n) => {
      n.resolvedAt = now;
      n.completed = true;
    });
  }

  // 2. Create new reminders, within the limits.
  if (settings.remindersEnabled && !isQuietHours(now)) {
    const today = istDayKey(now);
    let sentToday = existing.filter((n) => istDayKey(new Date(n.createdAt)) === today).length;
    const stats = toneStats(existing);
    let created = 0;
    for (const c of candidates) {
      if (created >= LIMITS.maxPerRun || sentToday >= LIMITS.maxPerDay) break;
      const chain = existing.filter((n) => n.key === c.key && !n.resolvedAt);
      if (chain.length && now - new Date(chain[0].createdAt) < LIMITS.cooldownMs) continue;
      const lastSame = existing.find((n) => n.key === c.key);
      if (lastSame && now - new Date(lastSame.createdAt) < LIMITS.cooldownMs) continue;
      const stage = Math.min(3, chain.length + 1);
      const tone = pickTone(stage, c, stats);
      const { title, message } = buildMessage(c, tone);
      const row = await prisma.studentNotification.create({
        data: {
          userId, key: c.key, kind: c.kind, tone, stage, title, message,
          href: c.href, topicId: isMongoId(c.topicId) ? c.topicId : undefined,
        },
      });
      existing.unshift(row);
      stats[tone].sent += 1;
      created += 1;
      sentToday += 1;
    }
  }

  const rows = await prisma.studentNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return {
    settings,
    notifications: rows.map(toClient),
    unreadCount: rows.filter((n) => !n.readAt && !n.resolvedAt).length,
  };
}

function toClient(n) {
  return {
    id: String(n.id), kind: n.kind, tone: n.tone, stage: n.stage,
    title: n.title, message: n.message, href: n.href || null,
    readAt: n.readAt || null, resolvedAt: n.resolvedAt || null, createdAt: n.createdAt,
  };
}

async function getSummary(prisma, userId, now = new Date()) {
  const data = await loadStudentData(prisma, userId);
  const state = computeState(data, now);
  return {
    topics: state.topics
      .map((t) => ({ topicId: t.topicId, name: t.name, subject: t.subject, mastery: t.mastery, status: t.status, attempts: t.attempts }))
      .sort((a, b) => (a.mastery ?? 2) - (b.mastery ?? 2)),
    recommendations: recommend(state),
  };
}

module.exports = {
  EVENT_TYPES, LIMITS, enabled, isMongoId,
  computeState, recommend, buildCandidates, pickTone,
  refreshNotifications, getSummary, getSettings, saveSettings, recordEvent,
  exclusive, toClient,
};