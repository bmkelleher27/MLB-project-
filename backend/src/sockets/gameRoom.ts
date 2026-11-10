import type { Server, Socket } from 'socket.io';
import { getLiveFeed } from '../mlbApi.js';
import { buildGameAtBats } from '../scorecard/atbats.js';
import {
  loadScorecard,
  rememberAtBats,
  rememberScorecard,
  scorecardSignature,
} from '../scorecard/gameStore.js';
import { transformLiveFeed } from '../scorecard/transform.js';

const POLL_INTERVAL_MS = 5_000;

/**
 * A game that keeps failing upstream (a bogus id, or MLB erroring) must not be
 * polled forever — it would hammer MLB from this server's IP for as long as a
 * client stays connected.
 */
const MAX_CONSECUTIVE_FAILURES = 3;

interface RoomState {
  subscriberCount: number;
  timer: NodeJS.Timeout | null;
  /**
   * What the room was last sent, so an unchanged poll emits nothing. Written
   * only by the poller: it is a record of what *everyone* in the room has, and
   * a snapshot sent to one new subscriber does not change that.
   */
  lastSignature: string | null;
  lastAtBatsPayload: string | null;
  /** Guards against a slow upstream letting polls overlap and pile up. */
  polling: boolean;
  consecutiveFailures: number;
}

const rooms = new Map<number, RoomState>();

function roomName(gamePk: number): string {
  return `game:${gamePk}`;
}

function atBatsRoomName(gamePk: number): string {
  return `game:${gamePk}:atbats`;
}

function stopPolling(state: RoomState): void {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

async function pollAndEmit(io: Server, gamePk: number): Promise<void> {
  const state = rooms.get(gamePk);
  if (!state) return;
  // A poll still in flight means MLB is slower than the interval; skip this
  // tick rather than stacking concurrent fetches for the same game.
  if (state.polling) return;
  state.polling = true;

  try {
    const raw = await getLiveFeed(gamePk);
    const scorecard = rememberScorecard(transformLiveFeed(raw));
    // Compared without `updatedAt`, which is new on every transform and would
    // otherwise make every poll look like a change and push the full scorecard
    // to every viewer every five seconds.
    const signature = scorecardSignature(scorecard);
    if (signature !== state.lastSignature) {
      state.lastSignature = signature;
      io.to(roomName(gamePk)).emit('scorecard', scorecard);
    }

    // The pitch-by-pitch view shares this poll: build its payload from the same
    // raw feed (no extra MLB API call), but only when someone is watching it —
    // it is much heavier than the scorecard.
    if ((io.sockets.adapter.rooms.get(atBatsRoomName(gamePk))?.size ?? 0) > 0) {
      const atBats = rememberAtBats(buildGameAtBats(raw, gamePk));
      const atBatsPayload = JSON.stringify(atBats);
      if (atBatsPayload !== state.lastAtBatsPayload) {
        state.lastAtBatsPayload = atBatsPayload;
        io.to(atBatsRoomName(gamePk)).emit('atbats', atBats);
      }
    }

    state.consecutiveFailures = 0;

    // Only a Final game is guaranteed to produce no further events; keep polling
    // through Preview (so a pre-first-pitch subscriber sees it go Live) and Live.
    if (scorecard.status.abstractGameState === 'Final') {
      stopPolling(state);
    }
  } catch (err) {
    state.consecutiveFailures += 1;
    console.error(
      `[gameRoom] poll failed for game ${gamePk} (${state.consecutiveFailures}):`,
      (err as Error).message
    );
    if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      stopPolling(state);
      io.to(roomName(gamePk)).emit('scorecard:error', {
        message: 'Live updates stopped — this game could not be reached.',
      });
    }
  } finally {
    state.polling = false;
  }
}

function ensurePolling(io: Server, gamePk: number): void {
  const state = rooms.get(gamePk);
  if (!state || state.timer) return;
  // A room whose poller gave up earlier gets a clean slate when someone asks
  // again, rather than stopping at the first new failure.
  state.consecutiveFailures = 0;
  state.timer = setInterval(() => {
    void pollAndEmit(io, gamePk);
  }, POLL_INTERVAL_MS);
}

function acquireRoom(gamePk: number): RoomState {
  let state = rooms.get(gamePk);
  if (!state) {
    state = {
      subscriberCount: 0,
      timer: null,
      lastSignature: null,
      lastAtBatsPayload: null,
      polling: false,
      consecutiveFailures: 0,
    };
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
      stopPolling(state);
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
      acquireRoom(gamePk);

      try {
        // Served from the Final cache when the game is over, and sharing the
        // in-flight feed request with the page's REST call when it is not.
        const scorecard = await loadScorecard(gamePk);
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
