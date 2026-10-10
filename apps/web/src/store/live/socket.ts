import type { ClientMessage, ServerMessage } from '@pgo/grid-model';
import type { ConnectionStatus } from './feed';

export interface LiveSocket {
  /** Sends if connected; returns false otherwise. */
  send: (message: ClientMessage) => boolean;
  close: () => void;
}

export interface LiveSocketOptions {
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
  minDelayMs?: number;
  maxDelayMs?: number;
  /** Failed attempts in a row before the status says "offline" (it keeps retrying). */
  offlineAfter?: number;
  /** For tests. */
  createSocket?: (url: string) => WebSocket;
}

const browserOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * A WebSocket that reconnects with exponential backoff (1 s, 2 s, 4 s … up to 30 s). Status
 * goes connecting → (hello) → live; after a drop, reconnecting, and offline after several
 * failures in a row. "live" itself is set by the `hello` message, not here.
 *
 * While the browser is offline it doesn't retry: the status is "offline" at once, and the
 * `online` event reconnects straight away with a fresh socket (and a fresh `hello` snapshot).
 */
export const openLiveSocket = (
  url: string,
  {
    onMessage,
    onStatus,
    minDelayMs = 1000,
    maxDelayMs = 30_000,
    offlineAfter = 5,
    createSocket = (target) => new WebSocket(target),
  }: LiveSocketOptions,
): LiveSocket => {
  let socket: WebSocket | null = null;
  let failures = 0;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const connect = () => {
    const current = createSocket(url);
    socket = current;
    current.onopen = () => {
      failures = 0;
    };
    current.onmessage = (event: MessageEvent<string>) => {
      try {
        onMessage(JSON.parse(event.data) as ServerMessage);
      } catch {
        // Ignore anything that is not JSON.
      }
    };
    current.onclose = () => {
      if (closed || socket !== current) return;
      failures += 1;
      if (browserOffline()) {
        onStatus('offline');
        return;
      }
      onStatus(failures >= offlineAfter ? 'offline' : 'reconnecting');
      timer = setTimeout(connect, Math.min(maxDelayMs, minDelayMs * 2 ** (failures - 1)));
    };
  };

  const handleOffline = () => onStatus('offline');
  // The old socket may look open but be dead: replace it rather than wait for its timeout.
  const handleOnline = () => {
    clearTimeout(timer);
    failures = 0;
    const previous = socket;
    onStatus('reconnecting');
    connect();
    previous?.close();
  };

  onStatus('connecting');
  connect();
  if (typeof window !== 'undefined') {
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
  }

  return {
    send: (message) => {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(message));
      return true;
    },
    close: () => {
      closed = true;
      clearTimeout(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('online', handleOnline);
      }
      socket?.close();
    },
  };
};
