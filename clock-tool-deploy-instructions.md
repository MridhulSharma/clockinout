# Clock Tool — Migrate to Postgres and Deploy to Render

## Goal
Move the clock-in/clock-out tool off the host laptop and onto free hosting, so it no longer depends on a machine that sleeps, moves, or gets closed.

- **Web service:** Render, free tier. Its filesystem is ephemeral — nothing durable may be written to disk.
- **Database:** Neon, free tier, external Postgres. This is why the ephemeral disk stops mattering.
- **Result:** a public HTTPS URL reachable from any network, with no Tailscale and no host laptop.

Work through the phases in order. Test at the end of each phase before continuing.

---

## Phase 0 — Before touching code

1. Commit the current working state to git so there's a clean rollback point.
2. Confirm `db/clock.db` and `.env` are still in `.gitignore`. They must not be committed — `.env` holds the admin password.
3. Decide whether existing data matters. If `clock.db` only holds test users and test punches, start the new database empty. If any of it is real, say so and migrate it deliberately in Phase 2 rather than letting it get stranded on the laptop.

---

## Phase 1 — Create the Neon database

1. Sign up at neon.com (or neon.tech) with a personal account.
2. Create a project. Note the region — pick one near the worksite.
3. Copy the connection string. It looks like:
   `postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`
4. Check Neon's current free-tier terms on signup — storage cap, and whether an idle project suspends. Confirm the data itself persists rather than expiring on a timer. This matters: the whole reason for leaving Render's own free Postgres is that it expires after 30 days.
5. Put the connection string in local `.env` as `DATABASE_URL` for development.

**Test:** connect with `psql "$DATABASE_URL"` (or Neon's web SQL editor) and run `SELECT 1;`.

---

## Phase 2 — Rewrite the data layer

Replace `better-sqlite3` with `pg`:
```
npm uninstall better-sqlite3
npm install pg
```

### Connection (`db/database.js`)
```js
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
module.exports = pool;
```

### Schema
Create the same three tables, with Postgres types:
- `users` — `id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT`
- `attendance` — `id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id TEXT REFERENCES users(id), clock_in_time TEXT, clock_out_time TEXT, date TEXT`
- `device` — `id INTEGER PRIMARY KEY CHECK (id = 1), device_token TEXT, registered_at TEXT`

Keep timestamps as TEXT. They're already stored that way and already working; changing to `TIMESTAMPTZ` in the same pass as everything else adds timezone questions on top of a migration. Leave it for later if at all.

Run the schema with `CREATE TABLE IF NOT EXISTS` at startup, as the SQLite version did.

### Query conversion — this is the bulk of the work
Three mechanical changes, applied everywhere:

1. **Placeholders:** `?` becomes `$1`, `$2`, `$3` — numbered, in order.
2. **Call shape:**
   - `db.prepare(sql).get(args)` → `const { rows } = await pool.query(sql, [args]); rows[0]`
   - `db.prepare(sql).all(args)` → `const { rows } = await pool.query(sql, [args]); rows`
   - `db.prepare(sql).run(args)` → `await pool.query(sql, [args])`
3. **Async propagation:** every function that queries becomes `async`, every caller `await`s it, and every route handler becomes `async` with try/catch around the body. This is where bugs hide — a missing `await` returns a Promise instead of a row, and the symptom is usually a confusing "undefined" rather than a clean error.

Example:
```js
// before
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// after
const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
const user = rows[0];
```

### Watch for
- `INSERT` that needs the new row's id: add `RETURNING id` — Postgres has no `lastInsertRowid`.
- Any raw SQLite-only syntax (`INSERT OR REPLACE`, `AUTOINCREMENT`) must be rewritten. `INSERT ... ON CONFLICT ... DO UPDATE` is the Postgres equivalent.
- The clock-in/clock-out logic must keep behaving exactly as before: no open record → insert a new row; open record found → update that specific row by its own `id`, never by `user_id` alone. This is the bug that deleted history earlier. Re-test it specifically.

**Test (locally, against Neon):** run the server, then exercise every route — add a user, list users, delete a user, register a device, reject a second device, clock in, clock out, clock the same user in and out a second time, confirm both cycles persist, admin login with right and wrong passwords.

---

## Phase 3 — Make the app deployable

1. **Port:** Render assigns the port. The server must use `process.env.PORT`:
   ```js
   const PORT = process.env.PORT || 3000;
   app.listen(PORT, () => console.log(`Server running on ${PORT}`));
   ```
   A hardcoded 3000 will deploy successfully and then fail health checks.
2. **No local file writes.** Confirm nothing writes to disk expecting it to persist — the SQLite file is gone, but check for logs or uploads too. The background image in `public/assets/` is fine; it ships with the code and is read-only.
3. **`package.json`:** add `"start": "node server.js"` and set the `engines.node` version to match what you develop on.
4. **Secrets:** `.env` is not deployed. `DATABASE_URL` and `ADMIN_PASSWORD` get set in Render's dashboard instead.

---

## Phase 4 — Harden the admin login (do this before the URL exists)

Until now the only real protection was that outsiders couldn't reach the server. On a public URL that protection is gone.

1. Replace the admin password with a long random one — 20+ characters from a password manager, not a word.
2. Add `express-rate-limit` to the login route: a handful of attempts per IP per 15 minutes. Without it, one shared password on an open form is brute-forceable at leisure.
3. Confirm the login response is identical for "wrong password" and any other failure, so it leaks nothing.
4. Confirm the session token isn't something guessable or static.

**Test:** wrong password is rejected; repeated wrong attempts start getting blocked; correct password still works.

---

## Phase 5 — Deploy

1. Push to GitHub.
2. In Render: New → Web Service → connect the repo.
3. Settings:
   - Build command: `npm install`
   - Start command: `node server.js`
   - Instance type: Free
4. Environment variables: `DATABASE_URL` (the Neon string) and `ADMIN_PASSWORD` (the new one).
5. Deploy and watch the logs until it reports listening.

**Test:** open `https://<app>.onrender.com/health` and confirm the ok response.

---

## Phase 6 — Claim the clock device immediately

The device lock is first-come: whoever loads `/clock` first takes the slot. On a public URL that could be a stranger or a crawler.

1. The moment the deploy is live, open `https://<app>.onrender.com/clock` **on the real clock device, before sharing the URL with anyone.**
2. Confirm it registered — submit a test ID and get a real response, not an authorization error.
3. Then open `/clock` on any other device and confirm it is rejected.
4. The same applies after every device reset: reset, then immediately claim from the intended device.

Note: the app is now served over HTTPS, which is a secure context, so `crypto.randomUUID()` works again. The non-crypto fallback added earlier is harmless and can stay.

---

## Phase 7 — Full end-to-end test on the live URL

1. Admin: log in, add two users.
2. Clock device: clock user A in; clock user B in.
3. Admin: refresh, both show Active with correct times.
4. Clock device: clock A out.
5. Admin: A shows clocked out with both times; B still Active.
6. Clock device: clock A in and out again.
7. Admin: **both** of A's completed cycles appear in history. This is the regression that bit before.
8. Second device: `/clock` is rejected.
9. Admin: remove a user; confirm they can no longer clock in.

---

## Phase 8 — Living with the free tier

- **Cold starts.** The service sleeps after about 15 minutes idle and takes roughly 30-50 seconds to wake. The first person at shift start will wait. Tell them it's normal rather than letting them think it's broken.
- **Optional mitigation:** a scheduled ping a few minutes before each shift keeps it warm. Note that Render free services have a monthly instance-hour budget, so pinging around the clock will burn it — ping only near the hours that matter.
- **Backups.** Nothing is on the laptop anymore. Export the Neon database on a schedule you're comfortable with, and keep the export somewhere other than Neon.
- **Retire the old setup.** Stop the laptop server, remove the old Tailscale bookmarks, and replace them everywhere with the new URL so there's no ambiguity about which one is real.

---

## Ground rules
- Test after every phase; do not proceed on a failing test.
- Commit after each phase, so any one of them can be rolled back alone.
- Never commit `.env` or any connection string.
- The async refactor in Phase 2 is the likeliest source of subtle bugs. A missing `await` fails quietly. Prefer finding them with tests over reading for them.
