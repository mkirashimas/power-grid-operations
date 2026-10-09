'use client';

import type { Asset } from '@pgo/grid-model';
import { StatCard } from '@pgo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toLanguage } from '../../../i18n/language';
import { ALARMS_NAMESPACE } from '../i18n';
import type { WatchedAsset } from '../live';

const TIME_ZONE = 'America/Chicago';

/** Live loading and voltage of the selected asset, updated every tick by the server. */
export const SelectedAssetLive = ({
  asset,
  values,
}: {
  asset: Asset;
  /** Null until the first update for this asset arrives. */
  values: WatchedAsset | null;
}) => {
  const { t, i18n } = useTranslation(ALARMS_NAMESPACE);
  const language = toLanguage(i18n.resolvedLanguage);
  const formats = useMemo(
    () => ({
      pct: new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      pu: new Intl.NumberFormat(language, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
      time: new Intl.DateTimeFormat(language, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: TIME_ZONE,
      }),
    }),
    [language],
  );

  return (
    <div data-testid="selected-asset-live">
      <StatCard
        label={t('selected.title')}
        value={asset.name}
        caption={
          values
            ? `${t('selected.values', {
                loading: t('units.pct', { value: formats.pct.format(values.loadingPct) }),
                voltage: t('units.pu', { value: formats.pu.format(values.voltagePu) }),
              })} · ${t('selected.updated', { time: formats.time.format(values.time) })}`
            : t('selected.waiting')
        }
      />
    </div>
  );
};
