import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import gameRouter from './routes/game.js';
import randomGameRouter from './routes/randomGame.js';
import scheduleRouter from './routes/schedule.js';
import { registerGameRoomHandlers } from './sockets/gameRoom.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

const app = express();
app.use(cors());

app.get('/healthz', (_req, res) => res.sendStatus(200));

app.use('/api/schedule', scheduleRouter);
app.use('/api/game', gameRouter);
app.use('/api/random-game', randomGameRouter);

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
registerGameRoomHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`backend listening on http://localhost:${PORT}`);
});
