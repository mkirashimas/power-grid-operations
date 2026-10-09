import {
  createLiveSimulator,
  findSeries,
  generateAssets,
  MAX_CLIENT_MESSAGE_BYTES,
  type EiaSnapshot,
} from '@pgo/grid-model';
import snapshot from '@pgo/grid-model/snapshot' with { type: 'json' };
import { createServer, type Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { createHub, type Hub } from './hub.ts';

export interface RealtimeOptions {
  port: number;
  tickMs?: number;
  /** Chance of a disturbance per step; higher values make alarms frequent (tests, demos). */
  eventRate?: number;
}

export interface RealtimeServer {
  server: Server;
  hub: Hub;
  /** The bound port (useful when started on port 0). */
  port: number;
  close: () => Promise<void>;
}

/**
 * HTTP server with `GET /healthz`; every WebSocket upgrade joins the live feed. The demand
 * shape comes from the committed EIA snapshot, so the service needs no API key.
 */
export const startRealtimeServer = ({
  port,
  tickMs = 1000,
  eventRate,
}: RealtimeOptions): Promise<RealtimeServer> => {
  const demand = findSeries(snapshot as EiaSnapshot, 'demand')?.points ?? [];
  const simulator = createLiveSimulator({ assets: generateAssets(), demand, eventRate });
  const hub = createHub({ simulator, tickMs });

  const server = createServer((request, response) => {
    if (request.url === '/healthz') {
      response.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      return;
    }
    response.writeHead(426, { 'content-type': 'text/plain' }).end('WebSocket only');
  });
  const sockets = new WebSocketServer({ server, maxPayload: MAX_CLIENT_MESSAGE_BYTES });
  sockets.on('connection', (socket) => hub.attach(socket));

  return new Promise((resolve) => {
    server.listen(port, () => {
      const address = server.address();
      resolve({
        server,
        hub,
        port: typeof address === 'object' && address ? address.port : port,
        close: () =>
          new Promise<void>((done) => {
            hub.close();
            sockets.close();
            server.close(() => done());
          }),
      });
    });
  });
};
