"use strict";

const express = require("express");
const engine = require("../services/learning-engine");

/**
 * Student engagement API (mounted at /api/student/engagement).
 *   GET  /summary                  topic mastery + recommendations
 *   GET  /notifications            checks for reminders, returns the bell list
 *   POST /notifications/:id/read   opened
 *   POST /notifications/:id/click  student followed the reminder
 *   POST /notifications/read-all
 *   GET/PUT /settings              reminders on/off
 *   POST /events                   record a meaningful student event
 */
function createStudentEngagementRouter(prisma, requireStudent) {
  const router = express.Router();
  router.use(requireStudent);

  const off = (res, extra = {}) =>
    res.json({ success: true, available: false, notifications: [], unreadCount: 0, remindersEnabled: true, topics: [], recommendations: [], ...extra });

  const ready = (req) => engine.enabled(prisma) && engine.isMongoId(req.userId);
  const fail = (res, label, error) => {
    console.error(`${label}:`, error);
    res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  };

  router.get("/summary", async (req, res) => {
    if (!ready(req)) return off(res);
    try {
      res.json({ success: true, available: true, ...(await engine.getSummary(prisma, req.userId)) });
    } catch (e) {
      fail(res, "Engagement summary error", e);
    }
  });

  router.get("/notifications", async (req, res) => {
    if (!ready(req)) return off(res);
    try {
      const out = await engine.exclusive(req.userId, () => engine.refreshNotifications(prisma, req.userId));
      res.json({
        success: true, available: true,
        notifications: out.notifications, unreadCount: out.unreadCount,
        remindersEnabled: out.settings.remindersEnabled,
      });
    } catch (e) {
      fail(res, "Notifications error", e);
    }
  });

  const mark = (fields) => async (req, res) => {
    if (!ready(req)) return off(res);
    if (!engine.isMongoId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid id" });
    try {
      const now = new Date();
      await prisma.studentNotification.updateMany({
        where: { id: req.params.id, userId: req.userId },
        data: fields(now),
      });
      res.json({ success: true });
    } catch (e) {
      fail(res, "Notification update error", e);
    }
  };
  router.post("/notifications/:id/read", mark((now) => ({ readAt: now })));
  router.post("/notifications/:id/click", mark((now) => ({ readAt: now, clickedAt: now })));

  router.post("/notifications/read-all", async (req, res) => {
    if (!ready(req)) return off(res);
    try {
      await prisma.studentNotification.updateMany({
        where: { userId: req.userId, readAt: null },
        data: { readAt: new Date() },
      });
      res.json({ success: true });
    } catch (e) {
      fail(res, "Mark all read error", e);
    }
  });

  router.get("/settings", async (req, res) => {
    if (!ready(req)) return off(res);
    try {
      res.json({ success: true, ...(await engine.getSettings(prisma, req.userId)) });
    } catch (e) {
      fail(res, "Settings error", e);
    }
  });

  router.put("/settings", async (req, res) => {
    if (!ready(req)) return off(res);
    if (typeof req.body?.remindersEnabled !== "boolean") {
      return res.status(400).json({ success: false, message: "remindersEnabled must be true or false" });
    }
    try {
      res.json({ success: true, ...(await engine.saveSettings(prisma, req.userId, req.body.remindersEnabled)) });
    } catch (e) {
      fail(res, "Settings save error", e);
    }
  });

  router.post("/events", async (req, res) => {
    if (!ready(req)) return res.json({ success: true, recorded: false });
    try {
      await engine.recordEvent(prisma, req.userId, req.body || {});
      res.json({ success: true, recorded: true });
    } catch (e) {
      if (e.message === "Unknown event type") {
        return res.status(400).json({ success: false, message: e.message });
      }
      fail(res, "Event error", e);
    }
  });

  return router;
}

module.exports = { createStudentEngagementRouter };