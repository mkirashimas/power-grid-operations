import 'server-only';
import { fetchErcotSnapshot, lastDaysRange, type EiaSnapshot } from '@pgo/grid-model';
import snapshotJson from '@pgo/grid-model/snapshot';
import { cache } from 'react';

const HOUR_MS = 3_600_000;
const REVALIDATE_SECONDS = 3600;
const DAYS = 30;

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
  if (!apiKey) {
    return { live: false, snapshot: SNAPSHOT };
  }
  try {
    // Rounded to the hour, so every request within the hour hits the same cached URLs.
    const now = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
    const snapshot = await fetchErcotSnapshot(apiKey, lastDaysRange(DAYS, now), {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    return { live: true, snapshot };
  } catch (error) {
    console.error(
      'EIA request failed; serving the snapshot.',
      error instanceof Error ? error.message : error,
    );
    return { live: false, snapshot: SNAPSHOT };
  }
});
