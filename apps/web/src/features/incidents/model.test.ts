import { describe, expect, it } from 'vitest';
import {
  applyChanges,
  checkUpload,
  createIncident,
  filterIncidents,
  isPdf,
  linkedAssetIds,
  MAX_TITLE_LENGTH,
  MAX_UPLOAD_BYTES,
  mentionedAssetIds,
  plainText,
  type Incident,
} from './model';
import { SAMPLE_INCIDENTS } from './seed';

const NOW = Date.parse('2026-10-10T12:00:00Z');

const withBody = (ids: string[]): Incident['body'] => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Fault at ' },
        ...ids.map((id) => ({ type: 'mention', attrs: { id, label: id.toUpperCase() } })),
      ],
    },
  ],
});

describe('createIncident', () => {
  it('starts an open warning with unique assets and an empty body', () => {
    const incident = createIncident({ title: 'Trip', assetIds: ['ln-0001', 'ln-0001'], now: NOW });
    expect(incident).toMatchObject({
      title: 'Trip',
      severity: 'warning',
      status: 'open',
      assetIds: ['ln-0001'],
      startedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
      sample: false,
      attachments: [],
    });
    expect(incident.id).toMatch(/^inc-[0-9a-f]{8}$/);
  });

  it('cuts long titles', () => {
    expect(createIncident({ title: 'x'.repeat(500) }).title).toHaveLength(MAX_TITLE_LENGTH);
  });
});

describe('applyChanges', () => {
  const open = createIncident({ title: 'Trip', now: NOW });

  it('stamps the update time', () => {
    expect(applyChanges(open, { title: 'Line trip' }, NOW + 1)).toMatchObject({
      title: 'Line trip',
      updatedAt: NOW + 1,
    });
  });

  it('stamps resolvedAt when resolving and clears it when reopening', () => {
    const resolved = applyChanges(open, { status: 'resolved' }, NOW + 5);
    expect(resolved.resolvedAt).toBe(NOW + 5);
    const reopened = applyChanges(resolved, { status: 'investigating' }, NOW + 6);
    expect(reopened).not.toHaveProperty('resolvedAt');
  });

  it('keeps a resolved time that is edited later', () => {
    const resolved = applyChanges(open, { status: 'resolved' }, NOW + 5);
    expect(applyChanges(resolved, { resolvedAt: NOW + 60 }).resolvedAt).toBe(NOW + 60);
  });
});

describe('mentions', () => {
  it('lists mentioned assets once, in order', () => {
    expect(mentionedAssetIds(withBody(['sub-cst-001', 'ln-0001', 'sub-cst-001']))).toEqual([
      'sub-cst-001',
      'ln-0001',
    ]);
  });

  it('links header assets first, then mentions', () => {
    expect(
      linkedAssetIds({ assetIds: ['ln-0001'], body: withBody(['sub-cst-001', 'ln-0001']) }),
    ).toEqual(['ln-0001', 'sub-cst-001']);
  });

  it('includes mention labels in the plain text', () => {
    expect(plainText(withBody(['ln-0001']))).toBe('Fault at  LN-0001');
  });
});

describe('filterIncidents', () => {
  it('filters by status, newest activity first', () => {
    const open = filterIncidents(SAMPLE_INCIDENTS, 'open', '');
    expect(open.map(({ id }) => id)).toEqual(['inc-sample-03']);
    const all = filterIncidents(SAMPLE_INCIDENTS, 'all', '');
    expect(all.map(({ id }) => id)).toEqual(['inc-sample-03', 'inc-sample-02', 'inc-sample-01']);
  });

  it('searches the title, the text and the linked asset ids, ignoring case', () => {
    expect(filterIncidents(SAMPLE_INCIDENTS, 'all', 'INSULATOR').map(({ id }) => id)).toEqual([
      'inc-sample-01',
    ]);
    expect(filterIncidents(SAMPLE_INCIDENTS, 'all', 'ld-fwt-114').map(({ id }) => id)).toEqual([
      'inc-sample-02',
    ]);
    expect(filterIncidents(SAMPLE_INCIDENTS, 'resolved', 'gas')).toEqual([]);
  });
});

describe('uploads', () => {
  it('recognises the PDF signature', () => {
    expect(isPdf(new TextEncoder().encode('%PDF-1.7\n'))).toBe(true);
    expect(isPdf(new TextEncoder().encode('%PDF'))).toBe(false);
    expect(isPdf(new TextEncoder().encode('<html>'))).toBe(false);
  });

  it('checks size and type before reading the file', () => {
    const pdf = { name: 'record.pdf', type: 'application/pdf', size: 1000 };
    expect(checkUpload(pdf)).toBeNull();
    // Some systems report no MIME type; the extension and the signature check still apply.
    expect(checkUpload({ ...pdf, type: '' })).toBeNull();
    expect(checkUpload({ ...pdf, size: 0 })).toBe('empty');
    expect(checkUpload({ ...pdf, size: MAX_UPLOAD_BYTES + 1 })).toBe('size');
    expect(checkUpload({ name: 'notes.txt', type: 'text/plain', size: 10 })).toBe('type');
  });
});
