// Downloads the last 30 days of ERCOT data from the EIA API and writes the committed snapshot.
// Usage: yarn data:fetch   (reads EIA_API_KEY from apps/web/.env.local)

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fetchErcotSnapshot, lastDaysRange } from '../src/eia.ts';

const DAYS = 30;
const OUTPUT = new URL('../data/ercot-snapshot.json', import.meta.url);

const apiKey = process.env.EIA_API_KEY;
if (!apiKey) {
  console.error('EIA_API_KEY is not set. Add it to apps/web/.env.local.');
  process.exit(1);
}

const range = lastDaysRange(DAYS);
console.log(`Fetching ERCOT data from EIA for ${range.start} to ${range.end} (UTC)...`);

const snapshot = await fetchErcotSnapshot(apiKey, range);

// One series per line keeps diffs readable without making the file huge.
const body = [
  '{',
  ...Object.entries(snapshot)
    .filter(([key]) => key !== 'series')
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`),
  '  "series": [',
  snapshot.series.map((series) => `    ${JSON.stringify(series)}`).join(',\n'),
  '  ]',
  '}',
  '',
].join('\n');

await writeFile(OUTPUT, body);

console.log(`Wrote ${fileURLToPath(OUTPUT)}`);
snapshot.series.forEach((series) => {
  const values = series.points.filter((point) => point.value !== null).length;
  console.log(
    `  ${series.id.padEnd(12)} ${String(series.points.length).padStart(4)} hours, ${values} with values`,
  );
});
