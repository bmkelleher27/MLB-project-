# MLB Live Scorecards

A live MLB scorebook. Browse each day's games, click through to a full
scorecard that updates in real time, drill into pitch-by-pitch detail, and
search any player to see how they were pitched — or how they pitched.

npm workspaces monorepo:

- `shared/` — types shared by both ends (consumed as TypeScript source, no build step)
- `backend/` — Express REST API + Socket.IO, proxying and transforming the MLB Stats API
- `frontend/` — React + Vite SPA
- `e2e/` — Playwright checks that drive the real stack

## Features

**Scorecard** — a traditional scorebook grid rendered from MLB's play-by-play:
shorthand notation (`6-3`, `K`, `ꓘ`, `1B-7`), diamond progress per plate
appearance, runner advancement annotations, and per-inning R/H/LOB. Games in
progress update over a socket. Extra-inning and batted-around innings get
continuation columns.

**Pitch-by-pitch** — every plate appearance with a strike-zone plot, pitch
movement, an estimated Stuff index, usage by count, and spray charts.

**Player profiles** — search any player, then see:
- the pitch mix thrown to them (or by them), with **AVG, SLG and whiff rate per pitch type**
- a 13-zone hot/cold heat map on MLB's Gameday grid
- month-by-month trends and platoon splits

**PDF export** — a print-tuned two-page landscape scorecard with style, ink-saver
and content options.

## Local development

```bash
npm install
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:5173
```

Copy `frontend/.env.example` and `backend/.env.example` to `.env` alongside them
if you need non-default settings; both work unconfigured for local development.

## Checks

```bash
npm run typecheck   # backend + frontend
npm run lint        # oxlint
npm test            # Vitest: backend logic + routes, frontend logic + components
npm run test:e2e    # Playwright against the real stack (starts both servers)
npm run build       # backend tsc + frontend vite build
```

CI (`.github/workflows/ci.yml`) runs everything except `test:e2e` on every push
and pull request. End-to-end runs as a separate, non-blocking job because it
depends on a live third-party API — a failure there can mean MLB is having a
moment rather than the change being broken.

### What's covered

Backend tests exercise the pure transform layer (notation, scorecard transform,
predictive metrics, Stuff, per-pitch-type aggregation) against saved feed
fixtures, plus HTTP-level route tests for validation, status codes and cache
headers. Frontend tests cover the pure lib modules and the chart components.
Statistical output is cross-checked against MLB's own published season lines —
summing per-pitch-type at-bats reproduces a player's official AVG/SLG exactly,
which is how a swing-classification bug was caught.

## Architecture notes

**Aggregation strategy.** Player profiles use MLB's pre-aggregated stat
endpoints (`pitchArsenal`, `hotColdZones`, `statSplits`, `byMonth`) rather than
replaying one ~1 MB game feed per game played. Per-pitch-type results do need
the raw `playLog`/`pitchLog`, so those are fetched, reduced immediately, and
**never cached raw** — only the small derived summary is kept.

**Caching.** The MLB proxy cache is bounded by both entry count and bytes,
because payloads range from 5 KB to 1.3 MB and an entry cap alone does not
bound memory. `GET /healthz` reports cache occupancy and heap use.

**Real-time.** The backend polls a game's feed every 5s only while at least one
client is subscribed, skips a tick if the previous poll is still in flight, and
stops after repeated failures so a bad game id can't drive an endless retry loop
against MLB.

## Deploying

The backend holds live state in memory (a polling loop per in-progress game)
and pushes updates over Socket.IO, so it needs a host that keeps a persistent
Node process running — it will not work on Vercel's serverless functions. The
frontend is a static SPA and deploys cleanly to Vercel.

### Backend → Render

`render.yaml` at the repo root is a Render Blueprint. In the Render dashboard:
New → Blueprint → connect this repo → Render reads `render.yaml` and creates the
`mlb-scorecards-backend` web service automatically. Render injects `PORT`
itself. Optional: `ALLOWED_ORIGINS` to restrict CORS to your frontend, and
`RATE_LIMIT_PER_MIN` to tune the per-IP limit (default 120).

Once deployed, note the service URL (e.g. `https://mlb-scorecards-backend.onrender.com`).

**Health check:** `GET /healthz` returns `200` with status, uptime, cache
occupancy and heap use. Point an uptime monitor at it; on Render's free tier a
periodic ping also keeps the instance from idling between games.

### Frontend → Vercel

`vercel.json` at the repo root configures the build for this monorepo (installs
at the repo root, builds only the `frontend` workspace, serves `frontend/dist`,
and rewrites all paths to `index.html` so client-side routing works on
refresh/deep links).

In the Vercel dashboard: New Project → import this repo → leave the Root
Directory as the repo root (don't point it at `frontend/`, or the workspace
install will fail) → add an environment variable:

```
VITE_API_URL=https://<your-render-backend-url>
```

then deploy. `VITE_API_URL` is read at build time, so re-deploy the frontend
after the backend URL is known or changes.

## Data

All statistics come from the public MLB Stats API (`statsapi.mlb.com`). That
data is MLB's and subject to their terms of use; this project is unofficial and
not affiliated with or endorsed by MLB. The code is MIT licensed — see
[LICENSE](LICENSE).
