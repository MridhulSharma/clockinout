# Clock-In / Clock-Out Tool

A simple local-network attendance tool. One device (a kiosk) lets people clock in/out by
entering their ID. A separate admin device shows a live dashboard of who's in, who's out,
and lets you manage users. Everything runs from one small server on a laptop/PC already on
your network — there's no cloud service and no internet connection required.

## 1. Install and start the server

On the host computer (the laptop/PC that will stay on and run the server):

```
npm install
npm start
```

The server listens on the port set in `.env` (default `3000`). You should see:

```
Clock-in server listening on port 3000
```

## 2. What URL to open on each device

Both devices must be on the **same WiFi/LAN** as the host computer.

First, find the host computer's local IP address (see step 4 below), e.g. `192.168.1.42`.

- **Clock device (kiosk)** — open in a browser and leave it open:
  `http://<host-ip>:3000/clock/`
- **Admin device** — open whenever you need to check the dashboard:
  `http://<host-ip>:3000/admin/`

The first device to open the clock page automatically becomes the one authorized
device. Any other browser/device that tries to clock in will be rejected until the
admin resets the authorized device (see the "Reset authorized device" button on the
dashboard).

## 3. Admin password

The admin password lives in the `.env` file at the project root:

```
ADMIN_PASSWORD=changeme123
```

To change it, edit that line and restart the server (`npm start`). Never commit `.env`
to version control or share it outside the people who should have admin access.

## 4. Finding the host computer's local IP address

- **Windows:** open Command Prompt and run `ipconfig`. Look for the "IPv4 Address"
  under your active network adapter (Wi-Fi or Ethernet), e.g. `192.168.1.42`.
- **Mac:** run `ifconfig` in Terminal, or check System Settings → Network.
- **Linux:** run `ip addr` in a terminal.

Both the clock device and the admin device need to type this IP (with `:3000` and the
right path) into their browser's address bar.

## 5. Keeping the server running

The server needs to stay running for the tool to work. Two easy options:

**Option A — pm2 (recommended, restarts automatically if it crashes or the machine reboots):**

```
npm install -g pm2
pm2 start server.js --name clock-tool
pm2 save
pm2 startup
```

`pm2 startup` prints a command — run that once to make pm2 (and your app) start
automatically when the computer reboots.

**Option B — OS-level startup entry:**
- Windows: create a shortcut to `npm start` (run from the project folder) in the
  `shell:startup` folder, or use Task Scheduler to run it at login.
- Mac/Linux: add a `launchd`/`systemd` entry that runs `npm start` from the project
  directory on boot.

## 6. Backing up data

All attendance and user data lives in a single file: `db/clock.db`. To back it up,
just copy that file somewhere safe (e.g. a USB drive or cloud storage folder) while
the server is stopped, or periodically while it's running — SQLite handles this safely.

To restore, stop the server, replace `db/clock.db` with your backup copy, and start
the server again.

## 7. Replacing the kiosk device / resetting the authorized device

Only one device can be authorized to clock people in/out at a time. If the kiosk
tablet or computer is replaced, or you need to move the clock page to a new device:

1. Log in to the admin dashboard (`/admin/`).
2. Click **"Reset Authorized Device."**
3. Open the clock page (`/clock/`) on the new device — it will automatically become
   the new authorized device.

## Troubleshooting: devices can't reach the server

If the clock or admin device genuinely cannot reach the host computer (e.g. they're
on a guest WiFi network that isolates devices from each other), don't change any code.
Instead, install [Tailscale](https://tailscale.com) (free) on the host machine and on
both devices — it makes them reachable as if they were on the same network with no
code changes required.

## Project structure

```
clock-tool/
  server.js          - Express app entry point
  .env               - port, admin password (never commit this)
  db/
    database.js       - SQLite schema/setup
    clock.db          - the database file (created automatically, not committed)
  routes/
    users.js           - user CRUD (admin-only)
    attendance.js      - clock in/out + dashboard summary
    device.js          - single authorized device lock
    auth.js             - admin login/session
  public/
    clock/              - kiosk clock in/out page
    admin/              - admin dashboard
```
