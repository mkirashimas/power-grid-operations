// Entry point: `yarn workspace @pgo/realtime start` (Cloud Run sets PORT=8080).
import { startRealtimeServer } from './app.ts';

const number = (value: string | undefined) => {
  const parsed = Number(value);
  return value !== undefined && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const realtime = await startRealtimeServer({
  port: number(process.env.PORT) ?? 8081,
  tickMs: number(process.env.TICK_MS),
  eventRate: number(process.env.ALARM_RATE),
});
console.log(`Realtime service listening on port ${realtime.port}`);

// Cloud Run sends SIGTERM before stopping an instance.
const shutdown = () => {
  realtime.close().then(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
