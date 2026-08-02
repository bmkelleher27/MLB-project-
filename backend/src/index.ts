import { createServer } from 'node:http';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
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

const app = express();
app.use(cors());
// JSON payloads here compress 6-12x (a full-game at-bats body is ~200 KB raw,
// ~30 KB gzipped); Express does not compress on its own.
app.use(compression());

const startedAt = Date.now();

// Liveness/readiness probe for uptime monitoring (Render, UptimeRobot, etc.).
// Returns 200 with a small JSON body a monitor can assert on.
app.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
});

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

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
registerGameRoomHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`backend listening on http://localhost:${PORT}`);
});
