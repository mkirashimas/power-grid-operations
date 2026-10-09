'use client';

import { StatCard } from '@pgo/ui';
import { Box } from '@mui/material';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toLanguage } from '../../../i18n/language';
import { ALARMS_NAMESPACE } from '../i18n';
import type { AlarmCounts } from '../live';

/** Active alarms, active warnings, unacknowledged and the message rate. */
export const AlarmKpis = ({
  counts,
  updatesPerSecond,
}: {
  counts: AlarmCounts;
  updatesPerSecond: number;
}) => {
  const { t, i18n } = useTranslation(ALARMS_NAMESPACE);
  const language = toLanguage(i18n.resolvedLanguage);
  const formats = useMemo(
    () => ({
      count: new Intl.NumberFormat(language),
      rate: new Intl.NumberFormat(language, { maximumFractionDigits: 1 }),
    }),
    [language],
  );

  return (
    <Box
      data-testid="alarm-kpis"
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))',
      }}
    >
      <StatCard label={t('kpi.activeAlarms')} value={formats.count.format(counts.activeAlarms)} />
      <StatCard
        label={t('kpi.activeWarnings')}
        value={formats.count.format(counts.activeWarnings)}
      />
      <StatCard
        label={t('kpi.unacknowledged')}
        value={formats.count.format(counts.unacknowledged)}
      />
      <StatCard
        label={t('kpi.updates')}
        value={formats.rate.format(updatesPerSecond)}
        caption={t('kpi.updatesCaption')}
      />
    </Box>
  );
};
