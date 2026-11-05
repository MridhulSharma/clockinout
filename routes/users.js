const express = require('express');
const { pool } = require('../db/database');
const { requireAdmin } = require('./auth');

const router = express.Router();

// GET /api/users - list all users (admin-only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, created_at FROM users ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('GET /api/users failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/users - add a new user, reject duplicate IDs (admin-only)
router.post('/', requireAdmin, async (req, res) => {
  const { id, name } = req.body;

  if (!id || !name) {
    return res.status(400).json({ error: 'id and name are required' });
  }

  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (rows[0]) {
      return res.status(409).json({ error: 'A user with this ID already exists' });
    }

    await pool.query('INSERT INTO users (id, name, created_at) VALUES ($1, $2, $3)', [
      id,
      name,
      new Date().toISOString(),
    ]);

    res.status(201).json({ id, name });
  } catch (err) {
    console.error('POST /api/users failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/users/:id - remove a user (admin-only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/users failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
