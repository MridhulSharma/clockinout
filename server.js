require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { initSchema } = require('./db/database');
const usersRouter = require('./routes/users');
const deviceRouter = require('./routes/device');
const attendanceRouter = require('./routes/attendance');
const { router: authRouter } = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Render terminates TLS at a proxy, so the client IP arrives in X-Forwarded-For.
// Without this every request looks like the proxy and the login rate limiter
// would throttle all users as one. 1 = trust a single hop, not the whole chain.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/users', usersRouter);
app.use('/api/device', deviceRouter);
app.use('/api/clock', attendanceRouter);
app.use('/api/admin', authRouter);

app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use('/clock', express.static(path.join(__dirname, 'public/clock')));
app.use('/admin', express.static(path.join(__dirname, 'public/admin')));

// Create the tables before accepting traffic, so a bad DATABASE_URL fails loudly
// at startup instead of turning every request into a 500.
initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Clock-in server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialise the database schema:', err);
    process.exit(1);
  });
