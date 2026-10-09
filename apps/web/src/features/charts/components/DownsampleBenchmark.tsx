'use client';

import type { Algorithm } from '@pgo/downsample';
import {
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toLanguage } from '../../../i18n/language';
import { BENCHMARK_RANGES, type BenchmarkRange, type BenchmarkRow } from '../engine/run';
import { CHARTS_NAMESPACE } from '../i18n';

/** Pixel columns the benchmark downsamples to, so results compare across screens. */
export const BENCHMARK_BUCKETS = 1000;

type Status = 'idle' | 'running' | 'done' | 'failed';

interface Line {
  range: BenchmarkRange;
  algorithm: Algorithm;
  inputPoints: number;
  js?: number;
  wasm?: number;
}

/** One line per range and algorithm, with the JS and WASM times side by side. */
const toLines = (rows: BenchmarkRow[]): Line[] => {
  const lines = new Map<string, Line>();
  rows.forEach((row) => {
    const key = `${row.range}:${row.algorithm}`;
    const line = lines.get(key) ?? {
      range: row.range,
      algorithm: row.algorithm,
      inputPoints: row.inputPoints,
    };
    line[row.engine] = row.medianMs;
    lines.set(key, line);
  });
  const order = BENCHMARK_RANGES.map((range) => range.key);
  return [...lines.values()].sort((a, b) => order.indexOf(a.range) - order.indexOf(b.range));
};

/** "Run benchmark": times JS and WASM for both algorithms in the worker on this device. */
export const DownsampleBenchmark = ({
  run,
}: {
  run: (buckets: number) => Promise<BenchmarkRow[]>;
}) => {
  const { t, i18n } = useTranslation(CHARTS_NAMESPACE);
  const language = toLanguage(i18n.resolvedLanguage);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const formats = useMemo(
    () => ({
      count: new Intl.NumberFormat(language),
      ms: new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ratio: new Intl.NumberFormat(language, { maximumFractionDigits: 1 }),
    }),
    [language],
  );

  const start = () => {
    setStatus('running');
    run(BENCHMARK_BUCKETS)
      .then((rows) => {
        setLines(toLines(rows));
        setStatus('done');
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus('failed');
      });
  };

  const ms = (value?: number) =>
    value === undefined ? '–' : t('benchmark.ms', { value: formats.ms.format(value) });
  const caption = t('benchmark.caption', { buckets: formats.count.format(BENCHMARK_BUCKETS) });
  const message = {
    idle: '',
    running: t('benchmark.running'),
    done: t('benchmark.done'),
    failed: t('benchmark.failed', { message: error }),
  }[status];

  return (
    <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
      <Stack direction="row" useFlexGap sx={{ gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="outlined" size="small" onClick={start} disabled={status === 'running'}>
          {t('benchmark.run')}
        </Button>
        <Typography variant="body2" color="text.secondary" role="status">
          {message}
        </Typography>
      </Stack>
      {lines.length > 0 && (
        // Scrolls sideways on narrow screens, so it must be reachable by keyboard.
        <TableContainer role="region" aria-label={caption} tabIndex={0} sx={{ maxWidth: '100%' }}>
          <Table size="small">
            <caption>{caption}</caption>
            <TableHead>
              <TableRow>
                <TableCell>{t('benchmark.range')}</TableCell>
                <TableCell>{t('benchmark.algorithm')}</TableCell>
                <TableCell align="right">{t('benchmark.points')}</TableCell>
                <TableCell align="right">{t('downsampling.js')}</TableCell>
                <TableCell align="right">{t('downsampling.wasm')}</TableCell>
                <TableCell align="right">{t('benchmark.speedup')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={`${line.range}:${line.algorithm}`}>
                  <TableCell>{t(`labels.${line.range}`)}</TableCell>
                  <TableCell>{t(`downsampling.${line.algorithm}`)}</TableCell>
                  <TableCell align="right">{formats.count.format(line.inputPoints)}</TableCell>
                  <TableCell align="right">{ms(line.js)}</TableCell>
                  <TableCell align="right">{ms(line.wasm)}</TableCell>
                  <TableCell align="right">
                    {line.js !== undefined && line.wasm
                      ? t('benchmark.times', { value: formats.ratio.format(line.js / line.wasm) })
                      : '–'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
};
