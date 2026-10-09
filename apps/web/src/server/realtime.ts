import 'server-only';

/** Port of `yarn workspace @pgo/realtime dev`. */
const LOCAL_URL = 'ws://localhost:8081';

/**
 * WebSocket URL of the realtime service, read per request: `REALTIME_URL` on Cloud Run (set by
 * the deploy workflow), the local dev service otherwise. It is public, not a secret.
 */
export const getRealtimeUrl = () => process.env.REALTIME_URL || LOCAL_URL;
