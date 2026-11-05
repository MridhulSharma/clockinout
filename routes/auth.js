const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// In-memory session store: token -> expiry timestamp.
// Sessions reset when the server restarts, which only forces a fresh admin login.
const sessions = new Map();
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

// One shared password on a public form is brute-forceable at leisure without this.
// Counts every attempt, successful or not, so a correct guess part-way through a
// burst does not buy the attacker a fresh allowance.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Same body as a rejected password, so a blocked attempt reveals nothing extra.
  message: { error: 'Incorrect password' },
});

// Compare in constant time so response timing does not leak how much of the
// password was correct.
function passwordMatches(supplied) {
  const expected = process.env.ADMIN_PASSWORD;
  if (typeof supplied !== 'string' || !expected) {
    return false;
  }
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

// POST /api/admin/login
router.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body || {};

  if (!passwordMatches(password)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_DURATION_MS);

  res.json({ token });
});

// Middleware to protect admin-only routes
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const expiresAt = token ? sessions.get(token) : null;

  if (!expiresAt || expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

module.exports = { router, requireAdmin };
