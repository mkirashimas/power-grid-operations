// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { makeStore } from '../../store';
import { incidentsApi } from './api';
import { closeIncidentsDb, DB_NAME } from './storage/db';

const deleteDatabase = () =>
  new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
  });

afterEach(async () => {
  await closeIncidentsDb();
  await deleteDatabase();
});

const { endpoints } = incidentsApi;

// RootState only knows the base API's tag types; the selectors expect this API's.
type IncidentsState = Parameters<ReturnType<typeof endpoints.listIncidents.select>>[0];
const stateOf = (store: ReturnType<typeof makeStore>) =>
  store.getState() as unknown as IncidentsState;

describe('incidents API', () => {
  it('lists the samples and refetches the list after a create', async () => {
    const store = makeStore();
    const list = store.dispatch(endpoints.listIncidents.initiate());
    expect((await list).data).toHaveLength(7);

    await store.dispatch(endpoints.createIncident.initiate({ title: 'Trip' })).unwrap();
    await expect.poll(() => endpoints.listIncidents.select()(stateOf(store)).data).toHaveLength(8);
    list.unsubscribe();
  });

  it('patches the cached report at once when saving, without refetching it', async () => {
    const store = makeStore();
    const report = store.dispatch(endpoints.getIncident.initiate('inc-sample-03'));
    await report;
    const { requestId } = endpoints.getIncident.select('inc-sample-03')(stateOf(store));

    const saving = store.dispatch(
      endpoints.updateIncident.initiate({ id: 'inc-sample-03', changes: { status: 'resolved' } }),
    );
    // Optimistic: visible before the write finishes.
    const cached = () => endpoints.getIncident.select('inc-sample-03')(stateOf(store));
    expect(cached().data?.status).toBe('resolved');
    await saving.unwrap();
    expect(cached().data?.resolvedAt).toEqual(expect.any(Number));
    // Same request: the report was not fetched again (that would reset the editor).
    expect(cached().requestId).toBe(requestId);
    report.unsubscribe();
  });

  it('returns null for a missing report and an error when updating it', async () => {
    const store = makeStore();
    expect((await store.dispatch(endpoints.getIncident.initiate('inc-missing'))).data).toBeNull();
    const result = await store.dispatch(
      endpoints.updateIncident.initiate({ id: 'inc-missing', changes: { title: 'x' } }),
    );
    expect(result.error).toMatchObject({ status: 'CUSTOM_ERROR' });
  });

  it('reset restores the samples', async () => {
    const store = makeStore();
    await store.dispatch(endpoints.deleteIncident.initiate('inc-sample-01')).unwrap();
    await store.dispatch(endpoints.resetIncidents.initiate()).unwrap();
    const { data } = await store.dispatch(
      endpoints.listIncidents.initiate(undefined, { forceRefetch: true }),
    );
    expect(data?.map(({ id }) => id).sort()).toEqual([
      'inc-sample-01',
      'inc-sample-02',
      'inc-sample-03',
      'inc-sample-04',
      'inc-sample-05',
      'inc-sample-06',
      'inc-sample-07',
    ]);
  });
});
