require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
require('./db/database');
const usersRouter = require('./routes/users');
const deviceRouter = require('./routes/device');
const attendanceRouter = require('./routes/attendance');
const { router: authRouter } = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => {
  console.log(`Clock-in server listening on port ${PORT}`);
});
