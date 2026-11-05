const express = require('express');
const { pool } = require('../db/database');
const { requireAdmin } = require('./auth');

const router = express.Router();

function todayDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// POST /api/clock - clock a user in or out
router.post('/', async (req, res) => {
  const { user_id, device_token } = req.body;

  if (!user_id || !device_token) {
    return res.status(400).json({ error: 'user_id and device_token are required' });
  }

  try {
    const deviceResult = await pool.query('SELECT device_token FROM device WHERE id = 1');
    const device = deviceResult.rows[0];
    if (!device || !device.device_token || device.device_token !== device_token) {
      return res.status(403).json({ error: 'This device is not authorized to clock in/out' });
    }

    const userResult = await pool.query('SELECT id, name FROM users WHERE id = $1', [user_id]);
    const user = userResult.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'Unknown user ID' });
    }

    const openResult = await pool.query(
      'SELECT id FROM attendance WHERE user_id = $1 AND clock_out_time IS NULL ORDER BY id DESC LIMIT 1',
      [user_id]
    );
    const openRecord = openResult.rows[0];

    const now = new Date().toISOString();

    if (!openRecord) {
      await pool.query(
        'INSERT INTO attendance (user_id, clock_in_time, clock_out_time, date) VALUES ($1, $2, NULL, $3)',
        [user_id, now, todayDate()]
      );

      return res.json({ action: 'clocked_in', name: user.name, time: now });
    }

    // Close that one record by its own id. Updating by user_id alone is the bug
    // that destroyed history before.
    await pool.query('UPDATE attendance SET clock_out_time = $1 WHERE id = $2', [now, openRecord.id]);

    res.json({ action: 'clocked_out', name: user.name, time: now });
  } catch (err) {
    console.error('POST /api/clock failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/clock/summary - each user's latest attendance status (admin-only, for the dashboard)
router.get('/summary', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id as user_id, u.name,
             a.clock_in_time, a.clock_out_time, a.date
      FROM users u
      LEFT JOIN attendance a ON a.id = (
        SELECT id FROM attendance WHERE user_id = u.id ORDER BY id DESC LIMIT 1
      )
      ORDER BY u.name
    `);

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
  } catch (err) {
    console.error('GET /api/clock/summary failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/clock/history - every completed attendance record, most recent first (admin-only)
router.get('/history', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.id, a.user_id, COALESCE(u.name, a.user_id) as name,
             a.clock_in_time, a.clock_out_time, a.date
      FROM attendance a
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.clock_out_time IS NOT NULL
      ORDER BY a.clock_in_time DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error('GET /api/clock/history failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
