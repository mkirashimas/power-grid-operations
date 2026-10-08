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
    });
  });

  it('falls back to the snapshot when EIA fails', async () => {
    vi.stubEnv('EIA_API_KEY', 'KEY');
    fetchErcotSnapshot.mockRejectedValue(
      new Error('EIA region-data request failed with status 503'),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { getErcotData, SNAPSHOT } = await load();

    await expect(getErcotData()).resolves.toEqual({ live: false, snapshot: SNAPSHOT });
  });
});
