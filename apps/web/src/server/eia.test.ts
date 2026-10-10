import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchErcotSnapshot = vi.fn();

vi.mock('@pgo/grid-model', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@pgo/grid-model')>()),
  fetchErcotSnapshot,
}));

const load = async () => {
  vi.resetModules();
  return import('./eia');
};

describe('getErcotData', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
    fetchErcotSnapshot.mockReset();
  });

  it('serves the committed snapshot without an API key', async () => {
    vi.stubEnv('EIA_API_KEY', '');
    const { getErcotData, SNAPSHOT } = await load();

    await expect(getErcotData()).resolves.toEqual({ live: false, snapshot: SNAPSHOT });
    expect(fetchErcotSnapshot).not.toHaveBeenCalled();
  });

  it('fetches live data with an hourly cache when the key is set', async () => {
    vi.stubEnv('EIA_API_KEY', 'KEY');
    const live = { series: [] };
    fetchErcotSnapshot.mockResolvedValue(live);
    const { getErcotData } = await load();

    await expect(getErcotData()).resolves.toEqual({ live: true, snapshot: live });
    expect(fetchErcotSnapshot).toHaveBeenCalledWith('KEY', expect.any(Object), {
      next: { revalidate: 3600 },
      // A hanging request is cut off, so it can't hold up the page.
      signal: expect.any(AbortSignal),
    });
  });

  it('falls back to the snapshot when EIA fails, with one warning', async () => {
    vi.stubEnv('EIA_API_KEY', 'KEY');
    fetchErcotSnapshot.mockRejectedValue(
      new Error('EIA region-data request failed with status 502'),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error');
    const { getErcotData, SNAPSHOT } = await load();

    await expect(getErcotData()).resolves.toEqual({ live: false, snapshot: SNAPSHOT });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/status 502.*10 minutes/);
    expect(error).not.toHaveBeenCalled();
  });

  it('serves the snapshot without calling EIA for 10 minutes after a failure', async () => {
    vi.useFakeTimers();
    vi.stubEnv('EIA_API_KEY', 'KEY');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchErcotSnapshot.mockRejectedValueOnce(new Error('EIA region-data request failed'));
    const { getErcotData, SNAPSHOT } = await load();

    await getErcotData();
    vi.advanceTimersByTime(9 * 60_000);
    await expect(getErcotData()).resolves.toEqual({ live: false, snapshot: SNAPSHOT });
    expect(fetchErcotSnapshot).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);

    // After the window, EIA is tried again.
    const live = { series: [] };
    fetchErcotSnapshot.mockResolvedValueOnce(live);
    vi.advanceTimersByTime(2 * 60_000);
    await expect(getErcotData()).resolves.toEqual({ live: true, snapshot: live });
    expect(fetchErcotSnapshot).toHaveBeenCalledTimes(2);
  });
});
