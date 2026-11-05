const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('./auth');

const router = express.Router();

// POST /api/device/register - claim the single authorized clock-in device
router.post('/register', (req, res) => {
  const { device_token } = req.body;

  if (!device_token) {
    return res.status(400).json({ error: 'device_token is required' });
  }

  const current = db.prepare('SELECT device_token FROM device WHERE id = 1').get();

  if (current && current.device_token) {
    if (current.device_token !== device_token) {
      return res.status(403).json({ error: 'A different device is already registered' });
    }
    return res.json({ success: true, already_registered: true });
  }

  db.prepare(`
    INSERT INTO device (id, device_token, registered_at) VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET device_token = excluded.device_token, registered_at = excluded.registered_at
  `).run(device_token, new Date().toISOString());

  res.json({ success: true });
});

// GET /api/device/status - is a device currently registered?
router.get('/status', (req, res) => {
  const current = db.prepare('SELECT device_token, registered_at FROM device WHERE id = 1').get();
  res.json({ registered: !!(current && current.device_token) });
});

// POST /api/device/reset - clear the registered device (admin-only)
router.post('/reset', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM device WHERE id = 1').run();
  res.json({ success: true });
});

module.exports = router;
