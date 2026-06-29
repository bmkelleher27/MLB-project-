import type { Server, Socket } from 'socket.io';
import { getLiveFeed } from '../mlbApi.js';
import { transformLiveFeed } from '../scorecard/transform.js';

const POLL_INTERVAL_MS = 5_000;

interface RoomState {
  subscriberCount: number;
  timer: NodeJS.Timeout | null;
  lastPayload: string | null;
}

const rooms = new Map<number, RoomState>();

function roomName(gamePk: number): string {
  return `game:${gamePk}`;
}

async function pollAndEmit(io: Server, gamePk: number): Promise<void> {
  const state = rooms.get(gamePk);
  if (!state) return;

  try {
    const raw = await getLiveFeed(gamePk);
    const scorecard = transformLiveFeed(raw);
    const payload = JSON.stringify(scorecard);
    if (payload !== state.lastPayload) {
      state.lastPayload = payload;
      io.to(roomName(gamePk)).emit('scorecard', scorecard);
    }
    // Game ended (or was never live) - no more events will arrive, stop polling.
    if (scorecard.status.abstractGameState !== 'Live' && state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  } catch (err) {
    console.error(`[gameRoom] poll failed for game ${gamePk}:`, (err as Error).message);
  }
}

function ensurePolling(io: Server, gamePk: number): void {
  const state = rooms.get(gamePk);
  if (!state || state.timer) return;
  state.timer = setInterval(() => {
    void pollAndEmit(io, gamePk);
  }, POLL_INTERVAL_MS);
}

export function registerGameRoomHandlers(io: Server): void {
  function unsubscribe(gamePk: number): void {
    const state = rooms.get(gamePk);
    if (!state) return;
    state.subscriberCount = Math.max(0, state.subscriberCount - 1);
    if (state.subscriberCount === 0) {
      if (state.timer) clearInterval(state.timer);
      rooms.delete(gamePk);
    }
  }

  io.on('connection', (socket: Socket) => {
    let subscribedGamePk: number | null = null;

    socket.on('subscribe', async (gamePkRaw: unknown) => {
      const gamePk = Number(gamePkRaw);
      if (!Number.isInteger(gamePk)) return;

      if (subscribedGamePk !== null) {
        socket.leave(roomName(subscribedGamePk));
        unsubscribe(subscribedGamePk);
      }
      subscribedGamePk = gamePk;
      socket.join(roomName(gamePk));

      let state = rooms.get(gamePk);
      if (!state) {
        state = { subscriberCount: 0, timer: null, lastPayload: null };
        rooms.set(gamePk, state);
      }
      state.subscriberCount++;

      try {
        const raw = await getLiveFeed(gamePk);
        const scorecard = transformLiveFeed(raw);
        state.lastPayload = JSON.stringify(scorecard);
        socket.emit('scorecard', scorecard);
        if (scorecard.status.abstractGameState === 'Live') {
          ensurePolling(io, gamePk);
        }
      } catch (err) {
        socket.emit('scorecard:error', { message: (err as Error).message });
      }
    });

    socket.on('unsubscribe', () => {
      if (subscribedGamePk !== null) {
        socket.leave(roomName(subscribedGamePk));
        unsubscribe(subscribedGamePk);
        subscribedGamePk = null;
      }
    });

    socket.on('disconnect', () => {
      if (subscribedGamePk !== null) {
        unsubscribe(subscribedGamePk);
        subscribedGamePk = null;
      }
    });
  });
}
