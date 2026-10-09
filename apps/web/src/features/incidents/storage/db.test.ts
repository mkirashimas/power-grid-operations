// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createIncident } from '../model';
import { SAMPLE_INCIDENTS } from '../seed';
import {
  closeIncidentsDb,
  DB_NAME,
  deleteIncident,
  getFile,
  getIncident,
  listIncidents,
  putFile,
  putIncident,
  resetIncidents,
  updateIncident,
} from './db';
import { storeUpload, UploadError } from './uploads';

const deleteDatabase = () =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

const sampleIds = SAMPLE_INCIDENTS.map(({ id }) => id).sort();
const pdfFile = (name = 'record.pdf') =>
  new File(['%PDF-1.7\n% test\n'], name, { type: 'application/pdf' });

afterEach(async () => {
  await closeIncidentsDb();
  await deleteDatabase();
});

describe('incident storage', () => {
  it('seeds the samples when the database is created, and only then', async () => {
    expect((await listIncidents()).map(({ id }) => id).sort()).toEqual(sampleIds);
    await deleteIncident('inc-sample-01');
    await closeIncidentsDb();
    // Opening it again does not bring the deleted sample back.
    expect(await getIncident('inc-sample-01')).toBeNull();
  });

  it('creates, reads and updates a report', async () => {
    const incident = await putIncident(createIncident({ title: 'Trip' }));
    expect(await getIncident(incident.id)).toEqual(incident);
    const updated = await updateIncident(incident.id, (current) => ({
      ...current,
      title: 'Line trip',
    }));
    expect(updated?.title).toBe('Line trip');
    expect((await getIncident(incident.id))?.title).toBe('Line trip');
    expect(await updateIncident('inc-missing', (current) => current)).toBeNull();
  });

  it('keeps overlapping updates', async () => {
    const { id } = await putIncident(createIncident({ title: 'Trip' }));
    await Promise.all([
      updateIncident(id, (current) => ({ ...current, title: 'Line trip' })),
      updateIncident(id, (current) => ({ ...current, severity: 'alarm' })),
    ]);
    expect(await getIncident(id)).toMatchObject({ title: 'Line trip', severity: 'alarm' });
  });

  it('stores uploads and deletes them with their report', async () => {
    const incident = createIncident({ title: 'Trip' });
    const attachment = await storeUpload(pdfFile());
    await putIncident({ ...incident, attachments: [attachment] });
    const stored = await getFile(attachment.id);
    expect(await stored?.text()).toContain('%PDF-1.7');

    await deleteIncident(incident.id);
    expect(await getIncident(incident.id)).toBeNull();
    expect(await getFile(attachment.id)).toBeUndefined();
  });

  it('rejects files that are not PDFs', async () => {
    const fake = new File(['hello'], 'fake.pdf', { type: 'application/pdf' });
    await expect(storeUpload(fake)).rejects.toEqual(new UploadError('type'));
    await expect(storeUpload(new File(['x'], 'notes.txt'))).rejects.toMatchObject({
      problem: 'type',
    });
  });

  it('reset removes everything and restores the samples', async () => {
    await putIncident(createIncident({ title: 'Mine' }));
    await putFile('att-orphan', new Blob(['%PDF-']));
    await deleteIncident('inc-sample-02');

    await resetIncidents();
    expect((await listIncidents()).map(({ id }) => id).sort()).toEqual(sampleIds);
    expect(await getFile('att-orphan')).toBeUndefined();
  });
});
