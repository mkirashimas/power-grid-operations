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
  | { type: 'alarm'; alarm: LiveAlarm }
  /** The watched asset's values, sent every tick to the client that asked (`watch`). */
  | { type: 'asset'; time: number; index: number; loadingPct: number; voltagePu: number };

/** Messages from the browser to the realtime service, as JSON. */
export type ClientMessage =
  | { type: 'ack'; id: string }
  /** Follow one asset (its index in the synthetic grid) every tick; null stops. */
  | { type: 'watch'; index: number | null };

/** Assets in the synthetic grid fit in this range (telemetry stores the index as Uint16). */
const MAX_ASSET_INDEX = 65_535;

/** Largest client message the service accepts, in bytes. */
export const MAX_CLIENT_MESSAGE_BYTES = 1024;

/** Parses a client message; anything malformed or unknown is null. */
export const parseClientMessage = (raw: string): ClientMessage | null => {
  try {
    const message: unknown = JSON.parse(raw);
    if (typeof message !== 'object' || message === null || !('type' in message)) return null;
    if (
      message.type === 'ack' &&
      'id' in message &&
      typeof message.id === 'string' &&
      /^A\d{1,12}$/.test(message.id)
    ) {
      return { type: 'ack', id: message.id };
    }
    if (
      message.type === 'watch' &&
      'index' in message &&
      (message.index === null ||
        (Number.isInteger(message.index) &&
          (message.index as number) >= 0 &&
          (message.index as number) <= MAX_ASSET_INDEX))
    ) {
      return { type: 'watch', index: message.index as number | null };
    }
  } catch {
    // Not JSON.
  }
  return null;
};
