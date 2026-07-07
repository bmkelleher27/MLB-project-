import type { Server, Socket } from 'socket.io';
import { getLiveFeed } from '../mlbApi.js';
import { buildGameAtBats } from '../scorecard/atbats.js';
import { transformLiveFeed } from '../scorecard/transform.js';

const POLL_INTERVAL_MS = 5_000;

interface RoomState {
  subscriberCount: number;
  timer: NodeJS.Timeout | null;
  lastPayload: string | null;
  lastAtBatsPayload: string | null;
}

const rooms = new Map<number, RoomState>();

function roomName(gamePk: number): string {
  return `game:${gamePk}`;
}

function atBatsRoomName(gamePk: number): string {
  return `game:${gamePk}:atbats`;
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

    // The pitch-by-pitch view shares this poll: build its payload from the same
    // raw feed (no extra MLB API call), but only when someone is watching it —
    // it is much heavier than the scorecard.
    if ((io.sockets.adapter.rooms.get(atBatsRoomName(gamePk))?.size ?? 0) > 0) {
      const atBats = buildGameAtBats(raw, gamePk);
      const atBatsPayload = JSON.stringify(atBats);
      if (atBatsPayload !== state.lastAtBatsPayload) {
        state.lastAtBatsPayload = atBatsPayload;
        io.to(atBatsRoomName(gamePk)).emit('atbats', atBats);
      }
    }

    // Only a Final game is guaranteed to produce no further events; keep polling
    // through Preview (so a pre-first-pitch subscriber sees it go Live) and Live.
    if (scorecard.status.abstractGameState === 'Final' && state.timer) {
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

function acquireRoom(gamePk: number): RoomState {
  let state = rooms.get(gamePk);
  if (!state) {
    state = { subscriberCount: 0, timer: null, lastPayload: null, lastAtBatsPayload: null };
    rooms.set(gamePk, state);
  }
  state.subscriberCount++;
  return state;
}

export function registerGameRoomHandlers(io: Server): void {
  function release(gamePk: number): void {
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
    let subscribedAtBatsPk: number | null = null;

    function dropScorecardSub(): void {
      if (subscribedGamePk !== null) {
        socket.leave(roomName(subscribedGamePk));
        release(subscribedGamePk);
        subscribedGamePk = null;
      }
    }

    function dropAtBatsSub(): void {
      if (subscribedAtBatsPk !== null) {
        socket.leave(atBatsRoomName(subscribedAtBatsPk));
        release(subscribedAtBatsPk);
        subscribedAtBatsPk = null;
      }
    }

    socket.on('subscribe', async (gamePkRaw: unknown) => {
      const gamePk = Number(gamePkRaw);
      if (!Number.isInteger(gamePk)) return;

      dropScorecardSub();
      subscribedGamePk = gamePk;
      socket.join(roomName(gamePk));
      const state = acquireRoom(gamePk);

      try {
        const raw = await getLiveFeed(gamePk);
        const scorecard = transformLiveFeed(raw);
        state.lastPayload = JSON.stringify(scorecard);
        socket.emit('scorecard', scorecard);
        // Poll for anything not yet Final: a Preview game may transition to Live
        // while this client is watching, and it must receive those updates.
        if (scorecard.status.abstractGameState !== 'Final') {
          ensurePolling(io, gamePk);
        }
      } catch (err) {
        socket.emit('scorecard:error', { message: (err as Error).message });
      }
    });

    // The pitch-by-pitch page loads its initial data over REST; this subscription
    // only streams subsequent changes, so no snapshot is emitted here.
    socket.on('subscribe:atbats', (gamePkRaw: unknown) => {
      const gamePk = Number(gamePkRaw);
      if (!Number.isInteger(gamePk)) return;

      dropAtBatsSub();
      subscribedAtBatsPk = gamePk;
      socket.join(atBatsRoomName(gamePk));
      acquireRoom(gamePk);
      // The first poll stops itself if the game turns out to be Final.
      ensurePolling(io, gamePk);
    });

    socket.on('unsubscribe', () => {
      dropScorecardSub();
      dropAtBatsSub();
    });

    socket.on('disconnect', () => {
      dropScorecardSub();
      dropAtBatsSub();
    });
  });
}
