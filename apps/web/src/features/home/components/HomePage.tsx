import { EIA_SOURCE, EIA_SOURCE_URL, periodToMs, type AssetKind } from '@pgo/grid-model';
import { Alert, Box, Stack, Typography } from '@mui/material';
import { SourceNote, StatCard, SyntheticBadge } from '@pgo/ui';
import { getRequestLanguage, getServerTranslation } from '../../../i18n/server';
import { getAssets } from '../../../server/assets';
import { getErcotData } from '../../../server/eia';
import { HOME_NAMESPACE } from '../i18n';
import { selectKpis, type Reading } from '../kpis';

// Grids size themselves from the available width, so no breakpoint switches are needed.
const cardGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
  gap: 2,
} as const;

const MODEL_KINDS: AssetKind[] = ['substation', 'line', 'generator', 'load'];

/** Server component: reads EIA data and the synthetic model on the server, in the request's language. */
export const HomePage = async () => {
  const [t, language, { live, snapshot }] = await Promise.all([
    getServerTranslation(HOME_NAMESPACE),
    getRequestLanguage(),
    getErcotData(),
  ]);
  const kpis = selectKpis(snapshot);
  const assets = getAssets();

  const megawatts = new Intl.NumberFormat(language, { maximumFractionDigits: 0 });
  const percent = new Intl.NumberFormat(language, {
    style: 'percent',
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  });
  // ERCOT operates on Central Time.
  const hour = new Intl.DateTimeFormat(language, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Chicago',
    timeZoneName: 'short',
  });
  const date = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' });

  const mw = (reading: Reading) => t('units.mw', { value: megawatts.format(reading.value) });
  const at = (reading: Reading) => hour.format(periodToMs(reading.period));

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
          {t('title')}
        </Typography>
        <Typography color="text.secondary">{t('intro')}</Typography>
      </Box>

      <Box component="section" aria-labelledby="ercot-heading">
        <Typography id="ercot-heading" variant="h6" component="h2" sx={{ mb: 2 }}>
          {t('ercot.heading')}
        </Typography>

        {kpis ? (
          <Box sx={cardGrid}>
            <StatCard label={t('kpi.demand')} value={mw(kpis.demand)} caption={at(kpis.demand)} />
            <StatCard
              label={t('kpi.forecast')}
              value={mw(kpis.forecast)}
              caption={at(kpis.forecast)}
            />
            <StatCard
              label={t('kpi.forecastError')}
              value={percent.format(kpis.forecastError)}
              caption={t('kpi.forecastErrorHint')}
            />
            {kpis.interchange && (
              <StatCard
                label={t('kpi.interchange')}
                value={mw(kpis.interchange)}
                caption={`${at(kpis.interchange)} · ${t('kpi.interchangeHint')}`}
              />
            )}
          </Box>
        ) : (
          <Alert severity="warning">{t('ercot.noData')}</Alert>
        )}

        <Box sx={{ mt: 2 }}>
          <SourceNote
            prefix={t('ercot.source')}
            name={EIA_SOURCE}
            href={EIA_SOURCE_URL}
            status={
              live
                ? t('ercot.live')
                : t('ercot.snapshot', { date: date.format(new Date(snapshot.fetchedAt)) })
            }
          />
        </Box>
      </Box>

      <Box component="section" aria-labelledby="model-heading">
        <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
          <Typography id="model-heading" variant="h6" component="h2">
            {t('model.heading')}
          </Typography>
          <SyntheticBadge label={t('model.synthetic')} />
        </Stack>
        <Box sx={cardGrid}>
          {MODEL_KINDS.map((kind) => (
            <StatCard
              key={kind}
              label={t(`model.kinds.${kind}`)}
              value={megawatts.format(assets.filter((asset) => asset.kind === kind).length)}
            />
          ))}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {t('model.note')}
        </Typography>
      </Box>
    </Stack>
  );
};
