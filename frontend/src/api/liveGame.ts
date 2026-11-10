/**
 * Follows a game over the socket.
 *
 * The socket client is imported on demand: most scorecards opened are finished
 * games that will never change, and those pages have no reason to download
 * socket.io or hold a connection open.
 *
 * The subscription is re-sent on every (re)connect. The server tracks rooms per
 * connection, so after a dropped connection — a phone coming back from the
 * background, a backend restart — a client that subscribed only once would stay
 * connected but silently stop receiving updates.
 */
export function followGame(
  subscribeEvent: 'subscribe' | 'subscribe:atbats',
  gamePk: number,
  // Each event carries its own payload type; the socket's listener signature is
  // untyped, so this is the one place that has to be too.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handlers: Record<string, (payload: any) => void>
): () => void {
  let stopped = false;
  let teardown: (() => void) | null = null;

  void import('./socket').then(({ getSocket }) => {
    if (stopped) return;
    const socket = getSocket();
    const subscribe = () => socket.emit(subscribeEvent, gamePk);

    for (const [event, handler] of Object.entries(handlers)) socket.on(event, handler);
    socket.on('connect', subscribe);
    // Before the first connect the 'connect' listener does the subscribing;
    // emitting here as well would queue a second, duplicate subscription.
    if (socket.connected) subscribe();

    teardown = () => {
      socket.off('connect', subscribe);
      for (const [event, handler] of Object.entries(handlers)) socket.off(event, handler);
      // Nothing to cancel server-side if the connection is already gone, and a
      // queued 'unsubscribe' would only be replayed against a later page.
      if (socket.connected) socket.emit('unsubscribe');
    };
  });

  return () => {
    stopped = true;
    teardown?.();
  };
}
