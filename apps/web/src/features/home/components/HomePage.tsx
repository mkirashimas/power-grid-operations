import { EIA_SOURCE, EIA_SOURCE_URL, periodToMs, type AssetKind } from '@pgo/grid-model';
import { Alert, Box, Card, CardContent, Chip, Link, Stack, Typography } from '@mui/material';
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

interface KpiCardProps {
  label: string;
  value: string;
  caption: string;
}

const KpiCard = ({ label, value, caption }: KpiCardProps) => (
  <Card variant="outlined">
    <CardContent>
      <Typography variant="body2" color="text.secondary" component="h3">
        {label}
      </Typography>
      <Typography variant="h5" component="p" sx={{ my: 0.5, fontWeight: 600 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {caption}
      </Typography>
    </CardContent>
  </Card>
);

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
            <KpiCard label={t('kpi.demand')} value={mw(kpis.demand)} caption={at(kpis.demand)} />
            <KpiCard
              label={t('kpi.forecast')}
              value={mw(kpis.forecast)}
              caption={at(kpis.forecast)}
            />
            <KpiCard
              label={t('kpi.forecastError')}
              value={percent.format(kpis.forecastError)}
              caption={t('kpi.forecastErrorHint')}
            />
            {kpis.interchange && (
              <KpiCard
                label={t('kpi.interchange')}
                value={mw(kpis.interchange)}
                caption={`${at(kpis.interchange)} · ${t('kpi.interchangeHint')}`}
              />
            )}
          </Box>
        ) : (
          <Alert severity="warning">{t('ercot.noData')}</Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {t('ercot.source')}{' '}
          <Link href={EIA_SOURCE_URL} color="inherit">
            {EIA_SOURCE}
          </Link>
          {' · '}
          {live
            ? t('ercot.live')
            : t('ercot.snapshot', { date: date.format(new Date(snapshot.fetchedAt)) })}
        </Typography>
      </Box>

      <Box component="section" aria-labelledby="model-heading">
        <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
          <Typography id="model-heading" variant="h6" component="h2">
            {t('model.heading')}
          </Typography>
          <Chip label={t('model.synthetic')} size="small" variant="outlined" />
        </Stack>
        <Box sx={cardGrid}>
          {MODEL_KINDS.map((kind) => (
            <KpiCard
              key={kind}
              label={t(`model.kinds.${kind}`)}
              value={megawatts.format(assets.filter((asset) => asset.kind === kind).length)}
              caption={t('model.synthetic')}
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
