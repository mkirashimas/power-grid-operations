import {
  parseClientMessage,
  type LiveSimulator,
  type LoadPoint,
  type ServerMessage,
} from '@pgo/grid-model';
import { WebSocket } from 'ws';

export interface HubOptions {
  simulator: LiveSimulator;
  tickMs: number;
  /** Points of load history sent on connect (default: 10 minutes at 1 s). */
  historySize?: number;
  /** Alarms sent on connect. */
  helloAlarms?: number;
  /** Acks accepted per connection per second; extra ones are dropped. */
  ackLimit?: number;
  /** Ping interval; connections that miss a pong are closed. */
  heartbeatMs?: number;
  now?: () => number;
}

export interface Hub {
  attach: (socket: WebSocket) => void;
  clientCount: () => number;
  close: () => void;
}

/**
 * Connects WebSocket clients to one shared simulator. The simulator steps every `tickMs`
 * while at least one client is connected and pauses when the last one leaves; on resume it
 * continues at the current time without replaying the gap.
 */
export const createHub = ({
  simulator,
  tickMs,
  historySize = 600,
  helloAlarms = 200,
  ackLimit = 10,
  heartbeatMs = 30_000,
  now = Date.now,
}: HubOptions): Hub => {
  const clients = new Set<WebSocket>();
  const alive = new WeakMap<WebSocket, boolean>();
  /** Asset index each connection follows (`watch`). */
  const watched = new Map<WebSocket, number>();
  let history: LoadPoint[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;

  const send = (socket: WebSocket, data: string) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(data);
  };
  const broadcast = (message: ServerMessage) => {
    const data = JSON.stringify(message);
    clients.forEach((socket) => send(socket, data));
  };

  const step = () => {
    const { tick, alarms } = simulator.step(now());
    history.push({ time: tick.time, load: tick.load });
    // Keep the last `historySize` steps of time, which also drops points from before a pause.
    const oldest = tick.time - historySize * tickMs;
    if (history[0].time <= oldest || history.length > historySize) {
      history = history.filter((point) => point.time > oldest).slice(-historySize);
    }
    broadcast({ type: 'tick', tick });
    alarms.forEach((alarm) => broadcast({ type: 'alarm', alarm }));
    watched.forEach((index, socket) => {
      const values = simulator.assetValues(index);
      if (values) {
        const message: ServerMessage = { type: 'asset', time: tick.time, index, ...values };
        send(socket, JSON.stringify(message));
      }
    });
  };

  const heartbeat = setInterval(() => {
    clients.forEach((socket) => {
      if (!alive.get(socket)) {
        socket.terminate();
        return;
      }
      alive.set(socket, false);
      socket.ping();
    });
  }, heartbeatMs);
  heartbeat.unref();

  const stop = () => {
    clearInterval(timer);
    timer = undefined;
  };

  const attach = (socket: WebSocket) => {
    if (!timer) {
      step();
      timer = setInterval(step, tickMs);
    }
    const hello: ServerMessage = {
      type: 'hello',
      serverTime: now(),
      tickMs,
      history,
      alarms: simulator.recentAlarms(helloAlarms),
      assets: simulator.snapshotAssets(),
    };
    send(socket, JSON.stringify(hello));
    clients.add(socket);
    alive.set(socket, true);

    let windowStart = now();
    let acks = 0;
    socket.on('pong', () => alive.set(socket, true));
    socket.on('message', (data, isBinary) => {
      if (isBinary) return;
      const message = parseClientMessage(data.toString());
      if (!message) return;
      if (message.type === 'watch') {
        if (message.index === null) watched.delete(socket);
        else watched.set(socket, message.index);
        return;
      }
      const time = now();
      if (time - windowStart >= 1000) {
        windowStart = time;
        acks = 0;
      }
      acks += 1;
      if (acks > ackLimit) return;
      const alarm = simulator.acknowledge(message.id, time);
      if (alarm) broadcast({ type: 'alarm', alarm });
    });
    socket.on('close', () => {
      clients.delete(socket);
      watched.delete(socket);
      if (clients.size === 0) stop();
    });
    socket.on('error', () => socket.terminate());
  };

  return {
    attach,
    clientCount: () => clients.size,
    close: () => {
      stop();
      clearInterval(heartbeat);
      clients.forEach((socket) => socket.terminate());
      clients.clear();
    },
  };
};
