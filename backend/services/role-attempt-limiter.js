/**
 * Role verification limit for login.
 *
 * The login page tells the backend which role the person selected (student,
 * teacher, parent, admin). If the email + password are correct but the account
 * belongs to a DIFFERENT role, that counts as a failed role verification.
 * After 5 failed role verifications the person is blocked for 15 minutes
 * (per IP address + email), so nobody can keep trying roles.
 *
 * Wrong passwords are not counted here, only wrong-role attempts.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

const VALID_ROLES = ["STUDENT", "TEACHER", "PARENT", "ADMIN"];
const records = new Map();

const keyOf = (ip, email) => `${ip || "unknown_ip"}|${String(email || "").toLowerCase()}`;

function normalizeRole(value) {
  const role = typeof value === "string" ? value.trim().toUpperCase() : "";
  return VALID_ROLES.includes(role) ? role : "";
}

function live(key, now) {
  const rec = records.get(key);
  if (!rec) return null;
  if (now > rec.resetAt) {
    records.delete(key);
    return null;
  }
  return rec;
}

function status(ip, email, now = Date.now()) {
  const rec = live(keyOf(ip, email), now);
  const count = rec ? rec.count : 0;
  return {
    blocked: count >= MAX_ATTEMPTS,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - count),
    retryAfterSec: rec && count >= MAX_ATTEMPTS ? Math.ceil((rec.resetAt - now) / 1000) : 0,
  };
}

function recordMismatch(ip, email, now = Date.now()) {
  const key = keyOf(ip, email);
  const rec = live(key, now) || { count: 0, resetAt: now + WINDOW_MS };
  rec.count += 1;
  records.set(key, rec);
  return status(ip, email, now);
}

function reset(ip, email) {
  records.delete(keyOf(ip, email));
}

function blockedMessage(retryAfterSec) {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Too many wrong-role attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

function mismatchMessage(actualRole, selectedRole, attemptsLeft) {
  const base = `This account is registered as ${actualRole.toLowerCase()}, not ${selectedRole.toLowerCase()}.`;
  return attemptsLeft > 0
    ? `${base} ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left.`
    : `${base} Too many wrong-role attempts, please try again in 15 minutes.`;
}

module.exports = {
  MAX_ATTEMPTS,
  WINDOW_MS,
  normalizeRole,
  status,
  recordMismatch,
  reset,
  blockedMessage,
  mismatchMessage,
};