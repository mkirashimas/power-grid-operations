// Writes the synthetic PDFs attached to the sample incident reports, into
// public/samples/incidents. Run with `yarn workspace @pgo/web samples:pdf` and commit the output.
// Every page says SYNTHETIC: these are generated for the demo, not real utility records.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

const OUT_DIR = path.join(import.meta.dirname, '../public/samples/incidents');
// A fixed date keeps the output identical between runs.
const DATE = new Date('2026-09-15T12:00:00Z');
const PAGE: [number, number] = [612, 792]; // US Letter, in points
const MARGIN = 56;
const INK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.38, 0.42, 0.48);
const RULE = rgb(0.8, 0.82, 0.86);
const ACCENT = rgb(0.13, 0.36, 0.62);

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** Draws text lines top-down from `y` and returns the next free y. */
const lines = (
  page: PDFPage,
  font: PDFFont,
  items: string[],
  y: number,
  { size = 10, x = MARGIN, gap = 4, color = INK } = {},
) => {
  items.forEach((text, index) => {
    page.drawText(text, { x, y: y - index * (size + gap), size, font, color });
  });
  return y - items.length * (size + gap);
};

/** Banner, title and footer shared by every page. */
const frame = (
  doc: PDFDocument,
  fonts: Fonts,
  title: string,
  subtitle: string,
  pageNumber: number,
  pageCount: number,
) => {
  const page = doc.addPage(PAGE);
  const [width, height] = PAGE;
  page.drawRectangle({ x: 0, y: height - 28, width, height: 28, color: rgb(0.99, 0.93, 0.8) });
  page.drawText('SYNTHETIC - generated sample for the Power Grid Operations demo', {
    x: MARGIN,
    y: height - 19,
    size: 9,
    font: fonts.bold,
    color: rgb(0.45, 0.28, 0),
  });
  page.drawText(title, { x: MARGIN, y: height - 72, size: 18, font: fonts.bold, color: INK });
  page.drawText(subtitle, {
    x: MARGIN,
    y: height - 92,
    size: 10,
    font: fonts.regular,
    color: MUTED,
  });
  page.drawLine({
    start: { x: MARGIN, y: height - 104 },
    end: { x: width - MARGIN, y: height - 104 },
    thickness: 1,
    color: RULE,
  });
  page.drawText("Not a real utility record. Asset names refer to the demo's synthetic grid.", {
    x: MARGIN,
    y: 32,
    size: 8,
    font: fonts.regular,
    color: MUTED,
  });
  page.drawText(`Page ${pageNumber} of ${pageCount}`, {
    x: width - MARGIN - 52,
    y: 32,
    size: 8,
    font: fonts.regular,
    color: MUTED,
  });
  return page;
};

const heading = (page: PDFPage, fonts: Fonts, text: string, y: number) => {
  page.drawText(text, { x: MARGIN, y, size: 12, font: fonts.bold, color: ACCENT });
  return y - 20;
};

/** A two-column table of label and value rows. */
const table = (
  page: PDFPage,
  fonts: Fonts,
  rows: [string, string][],
  y: number,
  labelWidth = 150,
) => {
  rows.forEach(([label, value], index) => {
    const rowY = y - index * 16;
    page.drawText(label, { x: MARGIN, y: rowY, size: 10, font: fonts.bold, color: INK });
    page.drawText(value, {
      x: MARGIN + labelWidth,
      y: rowY,
      size: 10,
      font: fonts.regular,
      color: INK,
    });
  });
  return y - rows.length * 16 - 8;
};

const newDocument = async (title: string) => {
  const doc = await PDFDocument.create();
  doc.setTitle(`${title} (synthetic)`);
  doc.setAuthor('Power Grid Operations demo');
  doc.setSubject('Synthetic sample document');
  doc.setProducer('pdf-lib');
  doc.setCreator('apps/web/scripts/sample-pdfs.ts');
  doc.setCreationDate(DATE);
  doc.setModificationDate(DATE);
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  return { doc, fonts };
};

const relayEventRecord = async () => {
  const title = 'Relay event record';
  const subtitle = 'Line L0001 CST-001 to CST-030, 138 kV - event of 2026-09-14';
  const { doc, fonts } = await newDocument(title);

  let page = frame(doc, fonts, title, subtitle, 1, 2);
  let y = heading(page, fonts, 'Event summary', 664);
  y = table(
    page,
    fonts,
    [
      ['Protected element', 'L0001 CST-001 to CST-030 (138 kV, 245 MW rating)'],
      ['Relay', 'Line distance relay, terminal CST-001'],
      ['Trigger', 'Zone 1 distance element, phase B to ground'],
      ['Fault inception', '2026-09-14 14:02:11.204 CDT'],
      ['Breaker', 'CB-112 opened in 3.1 cycles'],
      ['Reclose', 'One shot at 30 cycles, unsuccessful; lockout'],
    ],
    y,
  );
  y = heading(page, fonts, 'Sequence of events', y - 10);
  y = lines(
    page,
    fonts.regular,
    [
      '14:02:11.204   Zone 1 pickup, phase B to ground',
      '14:02:11.219   Trip output asserted',
      '14:02:11.256   Breaker CB-112 open, current interrupted',
      '14:02:11.758   Reclose attempt 1',
      '14:02:11.771   Zone 1 pickup on reclose, fault still present',
      '14:02:11.802   Breaker CB-112 open, reclosing locked out',
      '14:02:12.010   Remote terminal CST-030 open (transfer trip received)',
    ],
    y,
    { gap: 6 },
  );

  page = frame(doc, fonts, title, subtitle, 2, 2);
  y = heading(page, fonts, 'Fault values', 664);
  y = table(
    page,
    fonts,
    [
      ['Faulted phase current', '6.84 kA'],
      ['Residual current', '6.12 kA'],
      ['Phase B voltage at fault', '0.41 pu'],
      ['Fault resistance', '2.3 ohm (estimated)'],
      ['Fault location', '18.4 km from CST-001 (37 % of line length)'],
    ],
    y,
    180,
  );
  y = heading(page, fonts, 'Analysis', y - 10);
  lines(
    page,
    fonts.regular,
    [
      'The relay operated correctly: a permanent phase B to ground fault inside zone 1.',
      'The unsuccessful reclose confirms the fault was not transient.',
      'Patrol found a damaged insulator string on structure 74, near the computed location.',
      'No misoperation. Recommended: replace the insulator string, then restore the line',
      'under switching order SO-2026-0914-01.',
    ],
    y,
    { gap: 6 },
  );
  return doc;
};

const switchingOrder = async () => {
  const title = 'Switching order SO-2026-0914-01';
  const subtitle = 'Isolate and restore L0001 CST-001 to CST-030';
  const { doc, fonts } = await newDocument(title);
  const page = frame(doc, fonts, title, subtitle, 1, 1);
  let y = heading(page, fonts, 'Isolation', 664);
  y = lines(
    page,
    fonts.regular,
    [
      '1.  Confirm CB-112 at CST-001 is open and locked out.',
      '2.  Confirm the remote breaker at CST-030 is open.',
      '3.  Open disconnect switches DS-112A and DS-112B at CST-001.',
      '4.  Open the line disconnect at CST-030.',
      '5.  Apply working grounds at both terminals. Issue clearance to the line crew.',
    ],
    y,
    { gap: 8 },
  );
  y = heading(page, fonts, 'Restoration', y - 14);
  y = lines(
    page,
    fonts.regular,
    [
      '6.  Line crew releases the clearance. Remove working grounds at both terminals.',
      '7.  Close the line disconnect at CST-030, then DS-112A and DS-112B at CST-001.',
      '8.  Reset the lockout on CB-112.',
      '9.  Energise from CST-001: close CB-112. Check voltage at CST-030.',
      '10. Close the breaker at CST-030. Confirm flow and loading on L0001.',
    ],
    y,
    { gap: 8 },
  );
  y = heading(page, fonts, 'Approvals', y - 14);
  table(
    page,
    fonts,
    [
      ['Prepared by', 'Shift engineer (sample)'],
      ['Approved by', 'Transmission operator (sample)'],
      ['Completed', '2026-09-14 16:40 CDT'],
    ],
    y,
  );
  return doc;
};

const postEventLoad = async () => {
  const title = 'Post-event load review';
  const subtitle = 'Far West load FWT Load 114 - evening peak, 2026-09-21';
  const { doc, fonts } = await newDocument(title);
  const page = frame(doc, fonts, title, subtitle, 1, 1);
  let y = heading(page, fonts, 'Load and voltage, 15-minute averages', 664);

  // A small line chart: load (MW) over 6 hours, with the undervoltage window shaded.
  const chart = { x: MARGIN + 30, y: y - 230, width: 440, height: 210 };
  const load = [
    92, 95, 99, 104, 110, 118, 127, 135, 142, 149, 155, 161, 166, 170, 172, 171, 168, 163, 156, 148,
    139, 130, 122, 115, 109,
  ].map((value) => Math.round(value * 0.7));
  const min = 50;
  const max = 130;
  const px = (index: number) => chart.x + (index / (load.length - 1)) * chart.width;
  const py = (value: number) => chart.y + ((value - min) / (max - min)) * chart.height;
  page.drawRectangle({
    x: px(11),
    y: chart.y,
    width: px(17) - px(11),
    height: chart.height,
    color: rgb(0.99, 0.9, 0.85),
  });
  page.drawText('Undervoltage (< 0.95 pu)', {
    x: px(11) + 4,
    y: chart.y + chart.height - 12,
    size: 8,
    font: fonts.regular,
    color: rgb(0.6, 0.2, 0.1),
  });
  [50, 70, 90, 110, 130].forEach((value) => {
    page.drawLine({
      start: { x: chart.x, y: py(value) },
      end: { x: chart.x + chart.width, y: py(value) },
      thickness: 0.5,
      color: RULE,
    });
    page.drawText(`${value}`, {
      x: MARGIN,
      y: py(value) - 3,
      size: 8,
      font: fonts.regular,
      color: MUTED,
    });
  });
  ['16:00', '17:30', '19:00', '20:30', '22:00'].forEach((label, index) => {
    page.drawText(label, {
      x: chart.x + (index / 4) * chart.width - 12,
      y: chart.y - 14,
      size: 8,
      font: fonts.regular,
      color: MUTED,
    });
  });
  load.slice(1).forEach((value, index) => {
    page.drawLine({
      start: { x: px(index), y: py(load[index]) },
      end: { x: px(index + 1), y: py(value) },
      thickness: 1.6,
      color: ACCENT,
    });
  });
  page.drawText('MW', {
    x: MARGIN,
    y: chart.y + chart.height + 10,
    size: 8,
    font: fonts.bold,
    color: MUTED,
  });

  y = heading(page, fonts, 'Findings', chart.y - 40);
  lines(
    page,
    fonts.regular,
    [
      'Load peaked at 120 MW at 19:30, 69 % of the 173 MW rating.',
      'Voltage stayed below 0.95 pu for 90 minutes; the lowest reading was 0.93 pu.',
      'The capacitor bank at the serving substation was out of service for maintenance.',
      'Recommended: return the capacitor bank before the next peak, and review the',
      'voltage schedule for the Far West zone.',
    ],
    y,
    { gap: 6 },
  );
  return doc;
};

const SAMPLES = {
  'relay-event-record.pdf': relayEventRecord,
  'switching-order.pdf': switchingOrder,
  'post-event-load.pdf': postEventLoad,
};

await mkdir(OUT_DIR, { recursive: true });
for (const [name, build] of Object.entries(SAMPLES)) {
  const doc = await build();
  const bytes = await doc.save({ useObjectStreams: false });
  await writeFile(path.join(OUT_DIR, name), bytes);
  console.log(`${name}: ${bytes.length.toLocaleString('en-US')} bytes`);
}
