import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Incident } from '../model';
import { SAMPLE_INCIDENTS } from '../seed';

// Reports live in the visitor's browser only: the demo is open, so nothing is sent anywhere.

export const DB_NAME = 'pgo-incidents';
const DB_VERSION = 1;

interface IncidentsDb extends DBSchema {
  incidents: { key: string; value: Incident };
  /** Uploaded PDFs, keyed by attachment id. */
  files: { key: string; value: Blob };
}

type Db = IDBPDatabase<IncidentsDb>;

let opening: Promise<Db> | undefined;

/** Opens the database once per page; creating it seeds the sample reports. */
export const openIncidentsDb = (): Promise<Db> => {
  opening ??= openDB<IncidentsDb>(DB_NAME, DB_VERSION, {
    upgrade: (db, _oldVersion, _newVersion, transaction) => {
      db.createObjectStore('incidents', { keyPath: 'id' });
      db.createObjectStore('files');
      const store = transaction.objectStore('incidents');
      SAMPLE_INCIDENTS.forEach((incident) => void store.put(structuredClone(incident)));
    },
  }).catch((error: unknown) => {
    opening = undefined;
    throw error;
  });
  return opening;
};

/** Closes and forgets the connection (tests delete the database between cases). */
export const closeIncidentsDb = async () => {
  const db = await opening?.catch(() => undefined);
  db?.close();
  opening = undefined;
};

export const listIncidents = async (): Promise<Incident[]> =>
  (await openIncidentsDb()).getAll('incidents');

export const getIncident = async (id: string): Promise<Incident | null> =>
  (await (await openIncidentsDb()).get('incidents', id)) ?? null;

export const putIncident = async (incident: Incident): Promise<Incident> => {
  await (await openIncidentsDb()).put('incidents', incident);
  return incident;
};

/**
 * Reads, changes and writes a report in one transaction, so overlapping saves (the title and
 * the body autosave) never overwrite each other. Null if it doesn't exist.
 */
export const updateIncident = async (
  id: string,
  update: (incident: Incident) => Incident,
): Promise<Incident | null> => {
  const db = await openIncidentsDb();
  const tx = db.transaction('incidents', 'readwrite');
  const current = await tx.store.get(id);
  const next = current ? update(current) : null;
  if (next) await tx.store.put(next);
  await tx.done;
  return next;
};

/** Deletes a report and its uploaded files. */
export const deleteIncident = async (id: string) => {
  const db = await openIncidentsDb();
  const tx = db.transaction(['incidents', 'files'], 'readwrite');
  const incident = await tx.objectStore('incidents').get(id);
  await Promise.all([
    tx.objectStore('incidents').delete(id),
    ...(incident?.attachments ?? [])
      .filter((attachment) => attachment.source === 'upload')
      .map((attachment) => tx.objectStore('files').delete(attachment.id)),
    tx.done,
  ]);
};

export const putFile = async (id: string, blob: Blob) => {
  await (await openIncidentsDb()).put('files', blob, id);
};

export const getFile = async (id: string): Promise<Blob | undefined> =>
  (await openIncidentsDb()).get('files', id);

export const deleteFile = async (id: string) => {
  await (await openIncidentsDb()).delete('files', id);
};

/** Removes every report and upload, then seeds the samples again. */
export const resetIncidents = async () => {
  const db = await openIncidentsDb();
  const tx = db.transaction(['incidents', 'files'], 'readwrite');
  const incidents = tx.objectStore('incidents');
  await Promise.all([
    incidents.clear(),
    tx.objectStore('files').clear(),
    ...SAMPLE_INCIDENTS.map((incident) => incidents.put(structuredClone(incident))),
    tx.done,
  ]);
};
