const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// In-memory session store: token -> expiry timestamp.
// Sessions reset when the server restarts, which is fine for a local admin tool.
const sessions = new Map();
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { password } = req.body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
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
