import 'server-only';
import { fetchErcotSnapshot, lastDaysRange, type EiaSnapshot } from '@pgo/grid-model';
import snapshotJson from '@pgo/grid-model/snapshot';
import { cache } from 'react';

const HOUR_MS = 3_600_000;
const REVALIDATE_SECONDS = 3600;
const DAYS = 30;
/** After a failure, serve the snapshot this long before trying EIA again. */
const RETRY_AFTER_MS = 10 * 60_000;
/** A hanging EIA request must not hold up the page. */
const EIA_TIMEOUT_MS = 8_000;

// Per server instance: while EIA is down, requests get the snapshot at once instead of each
// waiting for EIA to fail (failed fetches are not cached).
let retryAt = 0;

/** Committed download from `yarn data:fetch`; used without an API key or when EIA fails. */
export const SNAPSHOT = snapshotJson as unknown as EiaSnapshot;

export interface ErcotData {
  /** True when the data came from the EIA API just now (or its hourly cache). */
  live: boolean;
  snapshot: EiaSnapshot;
}

/**
 * ERCOT data from EIA: live (cached for an hour) when EIA_API_KEY is set, otherwise the
 * committed snapshot. The key is only read here, on the server.
 */
export const getErcotData = cache(async (): Promise<ErcotData> => {
  const apiKey = process.env.EIA_API_KEY;
  if (!apiKey || Date.now() < retryAt) {
    return { live: false, snapshot: SNAPSHOT };
  }
  try {
    // Rounded to the hour, so every request within the hour hits the same cached URLs.
    const now = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
    const snapshot = await fetchErcotSnapshot(apiKey, lastDaysRange(DAYS, now), {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(EIA_TIMEOUT_MS),
    });
    return { live: true, snapshot };
  } catch (error) {
    // An expected, handled outage (the page shows "snapshot"): a warning, once per window.
    retryAt = Date.now() + RETRY_AFTER_MS;
    console.warn(
      `EIA unavailable (${error instanceof Error ? error.message : String(error)}); ` +
        `serving the snapshot for ${RETRY_AFTER_MS / 60_000} minutes.`,
    );
    return { live: false, snapshot: SNAPSHOT };
  }
});
