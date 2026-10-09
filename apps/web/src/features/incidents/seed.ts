import type { JSONContent } from '@tiptap/core';
import { findAsset } from '../../store/assets';
import type { Attachment, Incident } from './model';

// The sample reports seeded into a new database and restored by Reset. Their text is English
// sample data (like the asset names), not UI copy. The PDFs are synthetic (scripts/sample-pdfs.ts).

const SAMPLE_DIR = '/samples/incidents';
const at = (iso: string) => Date.parse(iso);

const text = (value: string, marks?: JSONContent['marks']): JSONContent => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
});
const bold = (value: string) => text(value, [{ type: 'bold' }]);
const mention = (id: string): JSONContent => ({
  type: 'mention',
  attrs: { id, label: findAsset(id)?.name ?? id },
});
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
const heading = (value: string): JSONContent => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [text(value)],
});
const bullets = (...items: JSONContent[][]): JSONContent => ({
  type: 'bulletList',
  content: items.map((content) => ({ type: 'listItem', content: [paragraph(...content)] })),
});
const tasks = (...items: [boolean, string][]): JSONContent => ({
  type: 'taskList',
  content: items.map(([checked, value]) => ({
    type: 'taskItem',
    attrs: { checked },
    content: [paragraph(text(value))],
  })),
});
const doc = (...content: JSONContent[]): JSONContent => ({ type: 'doc', content });

const sampleFile = (id: string, name: string, size: number, addedAt: number): Attachment => ({
  id,
  name,
  size,
  source: 'sample',
  url: `${SAMPLE_DIR}/${name}`,
  addedAt,
});

const lineTrip: Incident = {
  id: 'inc-sample-01',
  title: 'L0001 tripped on a permanent phase-to-ground fault',
  severity: 'alarm',
  status: 'resolved',
  assetIds: ['ln-0001'],
  startedAt: at('2026-09-14T19:02:11Z'),
  resolvedAt: at('2026-09-14T21:40:00Z'),
  body: doc(
    heading('Summary'),
    paragraph(
      text('At 14:02 CDT the zone 1 distance relay at '),
      mention('sub-cst-001'),
      text(' tripped '),
      mention('ln-0001'),
      text(' for a phase B to ground fault. Reclosing was '),
      bold('unsuccessful'),
      text(' and the line locked out. Flow moved to the parallel paths into '),
      mention('sub-cst-030'),
      text('; no other line exceeded its rating.'),
    ),
    heading('Timeline'),
    bullets(
      [text('14:02 Fault, trip and failed reclose (relay event record attached).')],
      [text('14:20 Patrol dispatched to the computed fault location, 18.4 km from CST-001.')],
      [text('15:05 Damaged insulator string found on structure 74.')],
      [text('16:40 Line restored under switching order SO-2026-0914-01 (attached).')],
    ),
    heading('Action items'),
    tasks(
      [true, 'Replace the insulator string on structure 74.'],
      [true, 'Restore the line and confirm loading.'],
      [false, 'Inspect the neighbouring structures for the same insulator batch.'],
    ),
  ),
  attachments: [
    sampleFile('att-sample-relay', 'relay-event-record.pdf', 5_425, at('2026-09-14T19:30:00Z')),
    sampleFile('att-sample-order', 'switching-order.pdf', 3_349, at('2026-09-14T21:45:00Z')),
  ],
  sample: true,
  createdAt: at('2026-09-14T19:10:00Z'),
  updatedAt: at('2026-09-15T14:00:00Z'),
};

const undervoltage: Incident = {
  id: 'inc-sample-02',
  title: 'Undervoltage at FWT Load 114 during the evening peak',
  severity: 'warning',
  status: 'investigating',
  assetIds: ['ld-fwt-114'],
  startedAt: at('2026-09-21T23:45:00Z'),
  body: doc(
    heading('Summary'),
    paragraph(
      text('Voltage at '),
      mention('ld-fwt-114'),
      text(
        ' stayed below 0.95 pu for about 90 minutes around the evening peak. The lowest reading was ',
      ),
      bold('0.93 pu'),
      text('. Load was well inside its rating, so the cause looks like missing reactive support.'),
    ),
    heading('Findings so far'),
    bullets(
      [text('The capacitor bank at the serving substation was out for maintenance.')],
      [text('The post-event load review is attached.')],
    ),
    heading('Action items'),
    tasks(
      [false, 'Return the capacitor bank to service before the next peak.'],
      [false, 'Review the Far West voltage schedule.'],
    ),
  ),
  attachments: [
    sampleFile('att-sample-load', 'post-event-load.pdf', 3_651, at('2026-09-22T15:00:00Z')),
  ],
  sample: true,
  createdAt: at('2026-09-22T01:30:00Z'),
  updatedAt: at('2026-09-22T15:00:00Z'),
};

const forcedOutage: Incident = {
  id: 'inc-sample-03',
  title: 'CST Gas 003 forced outage',
  severity: 'alarm',
  status: 'open',
  assetIds: ['gen-cst-003'],
  startedAt: at('2026-10-02T11:12:00Z'),
  body: doc(
    heading('Summary'),
    paragraph(
      mention('gen-cst-003'),
      text(
        ' tripped offline at 06:12 CDT on a boiler feed pump failure, removing about 640 MW. Reserves covered the loss; the unit is unavailable until repairs are done.',
      ),
    ),
    heading('Action items'),
    tasks(
      [false, 'Get a return-to-service estimate from the plant.'],
      [false, 'Check the Coast zone reserve margin for the evening peak.'],
    ),
  ),
  attachments: [],
  sample: true,
  createdAt: at('2026-10-02T11:30:00Z'),
  updatedAt: at('2026-10-02T11:30:00Z'),
};

export const SAMPLE_INCIDENTS: readonly Incident[] = [lineTrip, undervoltage, forcedOutage];
