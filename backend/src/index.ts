import { createServer } from 'node:http';
import compression from 'compression';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import { cacheStats } from './mlbApi.js';
import gameRouter from './routes/game.js';
import randomGameRouter from './routes/randomGame.js';
import scheduleRouter from './routes/schedule.js';
import dailyStarsRouter from './routes/dailyStars.js';
import { seasonRouter, teamsRouter } from './routes/season.js';
import playerRouter from './routes/player.js';
import playerProfileRouter from './routes/playerProfile.js';
import playerSearchRouter from './routes/playerSearch.js';
import seasonPredictiveRouter from './routes/seasonPredictive.js';
import { registerGameRoomHandlers } from './sockets/gameRoom.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

/**
 * Comma-separated list of allowed browser origins. Unset means "any origin",
 * which is the right default for a public read-only API and for local dev, but
 * a deployment that wants to keep its backend to its own frontend sets
 * ALLOWED_ORIGINS to do so.
 */
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOrigin = allowedOrigins.length > 0 ? allowedOrigins : '*';

const app = express();

// Render/Vercel put this behind a proxy; without this the rate limiter would
// see the proxy's IP for every client and throttle everyone as one.
app.set('trust proxy', 1);

app.use(cors({ origin: corsOrigin }));
// JSON payloads here compress 6-12x (a full-game at-bats body is ~200 KB raw,
// ~30 KB gzipped); Express does not compress on its own.
app.use(compression());

/**
 * Every route here fans out to MLB's public API on our IP. Without a cap, one
 * scripted client can both exhaust this server's memory and get the deployment
 * IP-banned upstream, which would take the whole app down. The limit is
 * deliberately generous for humans and tight enough to stop a crawl.
 */
const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.RATE_LIMIT_PER_MIN ?? 120),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
});

const startedAt = Date.now();

// Liveness/readiness probe for uptime monitoring (Render, UptimeRobot, etc.).
// Reports cache occupancy too, so memory pressure is visible before it bites.
// Not rate limited: monitors poll it frequently by design.
app.get('/healthz', (_req, res) => {
  const cache = cacheStats();
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    cache: {
      entries: cache.entries,
      megabytes: Math.round((cache.bytes / 1024 / 1024) * 100) / 100,
      budgetMegabytes: Math.round(cache.maxBytes / 1024 / 1024),
    },
    memory: {
      heapUsedMegabytes: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 10) / 10,
    },
  });
});

app.use('/api', apiLimiter);

app.use('/api/schedule', scheduleRouter);
app.use('/api/daily-stars', dailyStarsRouter);
app.use('/api/game', gameRouter);
app.use('/api/random-game', randomGameRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/season/predictive', seasonPredictiveRouter);
app.use('/api/season', seasonRouter);
app.use('/api/players/search', playerSearchRouter);
// Mounted before the game-log router so '/:id/profile' resolves ahead of '/:id'.
app.use('/api/player', playerProfileRouter);
app.use('/api/player', playerRouter);

// Unknown API paths get JSON, not Express's default HTML error page.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'not found' });
});

// Anything a route throws (or forwards) lands here as JSON rather than an HTML
// stack trace. The detail is logged server-side and not sent to the client.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[unhandled]', err.stack ?? err.message);
  if (res.headersSent) return;
  res.status(500).json({ error: 'internal server error' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: corsOrigin } });
registerGameRoomHandlers(io);

// A rejected promise or thrown error outside a request must not take the
// process down silently; log it so the platform's restart is explainable.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.stack ?? err.message);
});

httpServer.listen(PORT, () => {
  console.log(`backend listening on http://localhost:${PORT}`);
});
