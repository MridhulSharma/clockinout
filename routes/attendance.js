const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('./auth');

const router = express.Router();

function todayDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// POST /api/clock - clock a user in or out
router.post('/', (req, res) => {
  const { user_id, device_token } = req.body;

  if (!user_id || !device_token) {
    return res.status(400).json({ error: 'user_id and device_token are required' });
  }

  const device = db.prepare('SELECT device_token FROM device WHERE id = 1').get();
  if (!device || !device.device_token || device.device_token !== device_token) {
    return res.status(403).json({ error: 'This device is not authorized to clock in/out' });
  }

  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(user_id);
  if (!user) {
    return res.status(404).json({ error: 'Unknown user ID' });
  }

  const openRecord = db.prepare(
    'SELECT id FROM attendance WHERE user_id = ? AND clock_out_time IS NULL ORDER BY id DESC LIMIT 1'
  ).get(user_id);

  const now = new Date().toISOString();

  if (!openRecord) {
    db.prepare(
      'INSERT INTO attendance (user_id, clock_in_time, clock_out_time, date) VALUES (?, ?, NULL, ?)'
    ).run(user_id, now, todayDate());

    return res.json({ action: 'clocked_in', name: user.name, time: now });
  }

  db.prepare('UPDATE attendance SET clock_out_time = ? WHERE id = ?').run(now, openRecord.id);

  res.json({ action: 'clocked_out', name: user.name, time: now });
});

// GET /api/clock/summary - each user's latest attendance status (admin-only, for the dashboard)
router.get('/summary', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id as user_id, u.name,
           a.clock_in_time, a.clock_out_time, a.date
    FROM users u
    LEFT JOIN attendance a ON a.id = (
      SELECT id FROM attendance WHERE user_id = u.id ORDER BY id DESC LIMIT 1
    )
    ORDER BY u.name
  `).all();

  const summary = rows.map((r) => ({
    user_id: r.user_id,
    name: r.name,
    status: r.clock_in_time
      ? (r.clock_out_time ? 'clocked_out' : 'active')
      : 'never_clocked_in',
    clock_in_time: r.clock_in_time,
    clock_out_time: r.clock_out_time,
    date: r.date,
  }));

  res.json(summary);
});

// GET /api/clock/history - every completed attendance record, most recent first (admin-only)
router.get('/history', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT a.id, a.user_id, COALESCE(u.name, a.user_id) as name,
           a.clock_in_time, a.clock_out_time, a.date
    FROM attendance a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.clock_out_time IS NOT NULL
    ORDER BY a.clock_in_time DESC
  `).all();

  res.json(rows);
});

module.exports = router;
