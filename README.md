# MLB Live Scorecards

A live MLB scorebook: a landing page of each day's games, click through to a
full scorecard that updates in real time as the game progresses.

npm workspaces monorepo:

- `shared/` - types shared by both ends
- `backend/` - Express REST API + Socket.IO (polls the MLB Stats API and pushes
  scorecard updates for games currently in progress)
- `frontend/` - React + Vite SPA

## Local development

```
npm install
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:5173
```

Copy `frontend/.env.example` to `frontend/.env` if you need to point the SPA
at a non-default backend URL during development.

## Tests

```
npm test               # Vitest — backend core logic (notation, transform,
                       # predictive, stuff, cache) against saved feed fixtures
```

## Deploying

The backend holds live state in memory (a polling loop per in-progress game)
and pushes updates over Socket.IO, so it needs a host that keeps a persistent
Node process running - it will not work on Vercel's serverless functions.
The frontend is a static SPA and deploys cleanly to Vercel.

### Backend -> Render

`render.yaml` at the repo root is a Render Blueprint. In the Render dashboard:
New -> Blueprint -> connect this repo -> Render reads `render.yaml` and
creates the `mlb-scorecards-backend` web service automatically. Render
injects `PORT` itself; no other environment variables are required.

Once deployed, note the service URL (e.g. `https://mlb-scorecards-backend.onrender.com`).

**Health check:** the backend exposes `GET /healthz`, which returns `200` with
`{ "status": "ok", "uptimeSeconds", "timestamp" }`. Point an uptime monitor
(Render health checks, UptimeRobot, etc.) at it; on Render's free tier a
periodic ping also keeps the instance from idling between games.

### Frontend -> Vercel

`vercel.json` at the repo root configures the build for this monorepo
(installs at the repo root, builds only the `frontend` workspace, serves
`frontend/dist`, and rewrites all paths to `index.html` so client-side
routing works on refresh/deep links).

In the Vercel dashboard: New Project -> import this repo -> leave the Root
Directory as the repo root (don't point it at `frontend/`, or the workspace
install will fail) -> add an environment variable:

```
VITE_API_URL=https://<your-render-backend-url>
```

then deploy. `VITE_API_URL` is read at build time, so re-deploy the frontend
after the backend URL is known or changes.
