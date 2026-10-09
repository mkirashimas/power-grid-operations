import type { ServerMessage } from '@pgo/grid-model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { startRealtimeServer, type RealtimeServer } from './app.ts';

/** A client that collects messages and can wait for one that matches. */
const connect = async (port: number) => {
  const socket = new WebSocket(`ws://localhost:${port}`);
  const messages: ServerMessage[] = [];
  const waiters: { test: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] =
    [];
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString()) as ServerMessage;
    messages.push(message);
    waiters.filter((w) => w.test(message)).forEach((w) => w.resolve(message));
  });
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  const next = <T extends ServerMessage>(test: (m: ServerMessage) => m is T, timeoutMs = 5000) =>
    new Promise<T>((resolve, reject) => {
      const found = messages.find(test);
      if (found) return resolve(found);
      const timer = setTimeout(() => reject(new Error('timed out')), timeoutMs);
      waiters.push({
        test,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m as T);
        },
      });
    });
  return { socket, messages, next };
};

const isHello = (m: ServerMessage): m is Extract<ServerMessage, { type: 'hello' }> =>
  m.type === 'hello';
const isTick = (m: ServerMessage): m is Extract<ServerMessage, { type: 'tick' }> =>
  m.type === 'tick';
const isAlarm = (m: ServerMessage): m is Extract<ServerMessage, { type: 'alarm' }> =>
  m.type === 'alarm';

describe('realtime service', () => {
  let realtime: RealtimeServer;
  beforeEach(async () => {
    realtime = await startRealtimeServer({ port: 0, tickMs: 50, eventRate: 0.5 });
  });
  afterEach(() => realtime.close());

  it('answers the health check and refuses plain HTTP', async () => {
    const health = await fetch(`http://localhost:${realtime.port}/healthz`);
    expect(health.status).toBe(200);
    expect(await health.text()).toBe('ok');
    expect((await fetch(`http://localhost:${realtime.port}/`)).status).toBe(426);
  });

  it('greets a client with history, then streams ticks and alarms', async () => {
    const client = await connect(realtime.port);
    const hello = await client.next(isHello);
    expect(hello.tickMs).toBe(50);
    expect(hello.history.length).toBeGreaterThan(0);

    const tick = await client.next(isTick);
    expect(tick.tick.load).toBeGreaterThan(0);
    expect(tick.tick.zones).toHaveLength(8);
    const alarm = await client.next(isAlarm);
    expect(alarm.alarm.id).toMatch(/^A\d+$/);
    client.socket.close();
  });

  it('broadcasts an acknowledgement to every client', async () => {
    const first = await connect(realtime.port);
    const second = await connect(realtime.port);
    const { alarm } = await first.next(isAlarm);

    first.socket.send(JSON.stringify({ type: 'ack', id: alarm.id }));
    const isAcked = (m: ServerMessage): m is Extract<ServerMessage, { type: 'alarm' }> =>
      m.type === 'alarm' && m.alarm.id === alarm.id && m.alarm.acknowledgedAt !== null;
    await expect(second.next(isAcked)).resolves.toBeDefined();
    await expect(first.next(isAcked)).resolves.toBeDefined();
    first.socket.close();
    second.socket.close();
  });

  it('sends the watched asset every tick, only to the client that asked', async () => {
    const watcher = await connect(realtime.port);
    const other = await connect(realtime.port);
    watcher.socket.send(JSON.stringify({ type: 'watch', index: 7 }));
    const isAsset = (m: ServerMessage): m is Extract<ServerMessage, { type: 'asset' }> =>
      m.type === 'asset';
    const asset = await watcher.next(isAsset);
    expect(asset).toMatchObject({ index: 7 });
    expect(asset.loadingPct).toBeGreaterThanOrEqual(0);
    expect(asset.voltagePu).toBeGreaterThan(0.8);

    await other.next(isTick);
    await other.next(isTick);
    expect(other.messages.some(isAsset)).toBe(false);

    watcher.socket.send(JSON.stringify({ type: 'watch', index: null }));
    await watcher.next(isTick);
    const count = watcher.messages.filter(isAsset).length;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(watcher.messages.filter(isAsset).length).toBeLessThanOrEqual(count + 1);
    watcher.socket.close();
    other.socket.close();
  });

  it('ignores malformed messages and closes oversized ones', async () => {
    const client = await connect(realtime.port);
    client.socket.send('not json');
    client.socket.send(JSON.stringify({ type: 'ack', id: 'A999999' }));
    await client.next(isTick);
    expect(client.socket.readyState).toBe(WebSocket.OPEN);

    const closed = new Promise<number>((resolve) => client.socket.once('close', resolve));
    client.socket.send('x'.repeat(4096));
    // 1009: message too big.
    await expect(closed).resolves.toBe(1009);
  });

  it('pauses the simulation when the last client leaves', async () => {
    const client = await connect(realtime.port);
    await client.next(isTick);
    expect(realtime.hub.clientCount()).toBe(1);
    const closed = new Promise((resolve) => client.socket.once('close', resolve));
    client.socket.close();
    await closed;
    await expect.poll(() => realtime.hub.clientCount()).toBe(0);
  });
});
