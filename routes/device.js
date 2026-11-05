const express = require('express');
const { pool } = require('../db/database');
const { requireAdmin } = require('./auth');

const router = express.Router();

// POST /api/device/register - claim the single authorized clock-in device
router.post('/register', async (req, res) => {
  const { device_token } = req.body;

  if (!device_token) {
    return res.status(400).json({ error: 'device_token is required' });
  }

  try {
    const { rows } = await pool.query('SELECT device_token FROM device WHERE id = 1');
    const current = rows[0];

    if (current && current.device_token) {
      if (current.device_token !== device_token) {
        return res.status(403).json({ error: 'A different device is already registered' });
      }
      return res.json({ success: true, already_registered: true });
    }

    await pool.query(
      `INSERT INTO device (id, device_token, registered_at) VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET device_token = excluded.device_token, registered_at = excluded.registered_at`,
      [device_token, new Date().toISOString()]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/device/register failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/device/status - is a device currently registered?
router.get('/status', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT device_token, registered_at FROM device WHERE id = 1');
    const current = rows[0];
    res.json({ registered: !!(current && current.device_token) });
  } catch (err) {
    console.error('GET /api/device/status failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/device/reset - clear the registered device (admin-only)
router.post('/reset', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM device WHERE id = 1');
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/device/reset failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
