const express = require('express');
const db = require('../db/database');
const { requireAdmin } = require('./auth');

const router = express.Router();

// GET /api/users - list all users (admin-only)
router.get('/', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, name, created_at FROM users ORDER BY name').all();
  res.json(users);
});

// POST /api/users - add a new user, reject duplicate IDs (admin-only)
router.post('/', requireAdmin, (req, res) => {
  const { id, name } = req.body;

  if (!id || !name) {
    return res.status(400).json({ error: 'id and name are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (existing) {
    return res.status(409).json({ error: 'A user with this ID already exists' });
  }

  db.prepare('INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)')
    .run(id, name, new Date().toISOString());

  res.status(201).json({ id, name });
});

// DELETE /api/users/:id - remove a user (admin-only)
router.delete('/:id', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ success: true });
});

module.exports = router;
