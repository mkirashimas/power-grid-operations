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

/**
 * A WebSocket that reconnects with exponential backoff (1 s, 2 s, 4 s … up to 30 s). Status
 * goes connecting → (hello) → live; after a drop, reconnecting, and offline after several
 * failures in a row. "live" itself is set by the `hello` message, not here.
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
      onStatus(failures >= offlineAfter ? 'offline' : 'reconnecting');
      timer = setTimeout(connect, Math.min(maxDelayMs, minDelayMs * 2 ** (failures - 1)));
    };
  };

  onStatus('connecting');
  connect();

  return {
    send: (message) => {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(message));
      return true;
    },
    close: () => {
      closed = true;
      clearTimeout(timer);
      socket?.close();
    },
  };
};
