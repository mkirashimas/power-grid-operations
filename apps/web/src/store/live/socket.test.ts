import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionStatus } from './feed';
import { openLiveSocket } from './socket';

/** Just enough of a WebSocket to drive the reconnect logic. */
class FakeSocket {
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.();
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

describe('openLiveSocket', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const sockets: FakeSocket[] = [];
    const statuses: ConnectionStatus[] = [];
    const messages: unknown[] = [];
    const live = openLiveSocket('ws://test', {
      onMessage: (message) => messages.push(message),
      onStatus: (status) => statuses.push(status),
      offlineAfter: 3,
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });
    return { live, sockets, statuses, messages };
  };

  it('parses messages and sends only while open', () => {
    const { live, sockets, messages } = setup();
    expect(live.send({ type: 'ack', id: 'A1' })).toBe(false);
    sockets[0].open();
    sockets[0].onmessage?.({ data: '{"type":"tick"}' });
    sockets[0].onmessage?.({ data: 'garbage' });
    expect(messages).toEqual([{ type: 'tick' }]);
    expect(live.send({ type: 'ack', id: 'A1' })).toBe(true);
    expect(sockets[0].sent).toEqual(['{"type":"ack","id":"A1"}']);
  });

  it('reconnects with exponential backoff and reports offline after repeated failures', () => {
    const { sockets, statuses } = setup();
    sockets[0].open();
    sockets[0].drop();
    expect(statuses).toEqual(['connecting', 'reconnecting']);

    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);

    sockets[1].drop();
    vi.advanceTimersByTime(2000);
    expect(sockets).toHaveLength(3);
    sockets[2].drop();
    expect(statuses.at(-1)).toBe('offline');

    // A successful connection resets the backoff.
    vi.advanceTimersByTime(4000);
    sockets[3].open();
    sockets[3].drop();
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(5);
  });

  it('stops reconnecting once closed', () => {
    const { live, sockets, statuses } = setup();
    sockets[0].open();
    live.close();
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
    expect(statuses).toEqual(['connecting']);
  });
});
