# HOL Year Wheel — Highs & Lows

Live event tool for HOL Community Day. ~40 people submit one highlight and one
lowlight from the last 12 months (month + up to 3 words) on their phones; a
big screen shows them landing live on a twin horizontal timeline.

- `/` — mobile submission form
- `/display` — big-screen live visualization

Data is stored in memory only (no database) — it resets when the server
restarts. That's intentional for a single-event tool, but it also means:
**don't redeploy or let the free-tier server sleep/restart during the event.**

## Run locally

```bash
npm install
npm start
```

Then open `http://localhost:3000` for the form and `http://localhost:3000/display`
for the big screen.

## Before the event: clear test data

While rehearsing you'll create test submissions. Wipe them right before doors
open:

```bash
curl -X POST "https://YOUR-DEPLOYED-URL/api/reset?key=YOUR_ADMIN_KEY"
```

The admin key defaults to `hol-admin` — set your own via the `ADMIN_KEY`
environment variable on your host.

## Deploy (Render, free tier, supports WebSockets)

1. Push this folder to a new GitHub repo.
2. On [render.com](https://render.com), New → Web Service → connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add an environment variable `ADMIN_KEY` set to something private.
5. Deploy. Render gives you a public URL like `https://hol-year-wheel.onrender.com`.
6. Generate a QR code pointing at that URL (root `/`) for attendees, and open
   `/display` on the laptop connected to the venue screen.

Free-tier Render services spin down after inactivity and take ~30–60s to wake
on the first request — open the URL yourself a few minutes before the event
starts so it's warm when attendees scan the QR code.
