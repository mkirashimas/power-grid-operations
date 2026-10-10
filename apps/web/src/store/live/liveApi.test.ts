// @vitest-environment node
import type { LiveAlarm } from '@pgo/grid-model';
import { describe, expect, it, vi } from 'vitest';
import { makeStore } from '..';
import { liveApi } from './liveApi';
import type { LiveSocketOptions } from './socket';

// The socket itself is tested in socket.test.ts; here it is a stub the test drives.
const sockets: {
  url: string;
  options: LiveSocketOptions;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}[] = [];
vi.mock('./socket', () => ({
  openLiveSocket: (url: string, options: LiveSocketOptions) => {
    const socket = { url, options, send: vi.fn(() => true), close: vi.fn() };
    sockets.push(socket);
    return socket;
  },
}));

const URL = 'ws://realtime.test';
const ALARM: LiveAlarm = {
  id: 'a-1',
  assetIndex: 1100,
  assetId: 'ln-0001',
  assetName: 'L0001 CST-001–CST-030',
  kind: 'line',
  zone: 'coast',
  condition: 'overload',
  severity: 'alarm',
  value: 112,
  raisedAt: 1,
  clearedAt: null,
  acknowledgedAt: null,
};

const { endpoints } = liveApi;
const feedOf = (store: ReturnType<typeof makeStore>) =>
  endpoints.liveFeed.select(URL)(store.getState()).data;

describe('live feed endpoint', () => {
  it('opens one socket per URL and folds its messages into the cache', async () => {
    const store = makeStore();
    const first = store.dispatch(endpoints.liveFeed.initiate(URL));
    const second = store.dispatch(endpoints.liveFeed.initiate(URL));
    await first;
    await vi.waitFor(() => expect(sockets).toHaveLength(1));
    const [socket] = sockets;
    expect(feedOf(store)?.alarms).toEqual([]);

    socket.options.onStatus('reconnecting');
    socket.options.onMessage({ type: 'alarm', alarm: ALARM });
    expect(feedOf(store)).toMatchObject({ status: 'reconnecting', alarms: [ALARM] });

    // Acknowledgements go through the open socket.
    await store.dispatch(endpoints.acknowledgeAlarm.initiate({ url: URL, id: 'a-1' })).unwrap();
    expect(socket.send).toHaveBeenCalledWith({ type: 'ack', id: 'a-1' });

    // The socket closes when the last subscriber leaves.
    first.unsubscribe();
    second.unsubscribe();
    await vi.waitFor(() => expect(socket.close).toHaveBeenCalled());
    const ack = await store.dispatch(endpoints.acknowledgeAlarm.initiate({ url: URL, id: 'a-1' }));
    expect(ack.error).toMatchObject({ status: 'CUSTOM_ERROR', error: 'Not connected' });
  });
});
