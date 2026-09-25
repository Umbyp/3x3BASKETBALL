/**
 * Minimal server-side admin session — replaces the old client-bundled
 * password check (TournamentPage.jsx used to compare against a string
 * shipped in the browser JS, which anyone could read). The password now
 * only ever lives in this process's environment; a correct login returns
 * an opaque bearer token the client attaches to the few admin-only
 * endpoints in server.js. Not Firebase Auth — a lightweight in-memory
 * session is enough for this app's threat model (a small tournament
 * admin tool, not a bank).
 */
import crypto from "crypto";

const TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const tokens = new Map(); // token -> expiresAt

setInterval(() => {
  const now = Date.now();
  for (const [t, exp] of tokens) if (now > exp) tokens.delete(t);
}, 10 * 60 * 1000).unref();

export function checkPassword(pw) {
  const expected = process.env.ADMIN_PASSWORD || "admin1234";
  return typeof pw === "string" && pw === expected;
}

export function issueToken() {
  const token = crypto.randomBytes(24).toString("hex");
  tokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

export function verifyToken(token) {
  if (!token) return false;
  const exp = tokens.get(token);
  if (!exp) return false;
  if (Date.now() > exp) { tokens.delete(token); return false; }
  return true;
}

// ── Tiny in-memory rate limiter for /admin/login (brute-force protection) ──
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;
const attempts = new Map(); // ip -> timestamps[]

export function checkRateLimit(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  list.push(now);
  attempts.set(ip, list);
  return list.length <= RATE_LIMIT_MAX;
}
