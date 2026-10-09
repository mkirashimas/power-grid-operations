import type { LiveAlarm, LiveTick } from './live.ts';

/** A point of the system-load history sent on connect. */
export interface LoadPoint {
  time: number;
  load: number;
}

/** Messages from the realtime service to the browser, as JSON. */
export type ServerMessage =
  | {
      type: 'hello';
      /** Server clock, epoch ms. */
      serverTime: number;
      tickMs: number;
      /** System load, oldest first (up to the last 10 minutes). */
      history: LoadPoint[];
      /** Recent alarms, newest first. */
      alarms: LiveAlarm[];
    }
  | { type: 'tick'; tick: LiveTick }
  | { type: 'alarm'; alarm: LiveAlarm };

/** Messages from the browser to the realtime service, as JSON. */
export type ClientMessage = { type: 'ack'; id: string };

/** Largest client message the service accepts, in bytes. */
export const MAX_CLIENT_MESSAGE_BYTES = 1024;

/** Parses a client message; anything malformed or unknown is null. */
export const parseClientMessage = (raw: string): ClientMessage | null => {
  try {
    const message: unknown = JSON.parse(raw);
    if (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === 'ack' &&
      'id' in message &&
      typeof message.id === 'string' &&
      /^A\d{1,12}$/.test(message.id)
    ) {
      return { type: 'ack', id: message.id };
    }
  } catch {
    // Not JSON.
  }
  return null;
};
