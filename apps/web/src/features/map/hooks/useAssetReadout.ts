import { statusOf, type Asset } from '@pgo/grid-model';
import { useTranslation } from 'react-i18next';
import { toLanguage } from '../../../i18n/language';
import { MAP_NAMESPACE } from '../i18n';

const NO_VALUE = '–';

/**
 * An asset's facts and live values as translated, formatted text, for the selected-asset panel
 * and the hover tooltip. Live values are `–` until the feed has sent them.
 */
export const useAssetReadout = (
  asset: Asset,
  loadingPct: number | undefined,
  voltagePu: number | undefined,
) => {
  const { t, i18n } = useTranslation(MAP_NAMESPACE);
  const language = toLanguage(i18n.resolvedLanguage);
  const number = (digits: number) =>
    new Intl.NumberFormat(language, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  const live = loadingPct !== undefined && voltagePu !== undefined;
  const status = live ? statusOf(loadingPct, voltagePu) : undefined;

  return {
    status,
    statusLabel: status ? t(`legend.${status}`) : undefined,
    kind: t(`kinds.${asset.kind}`),
    zone: t(`zones.${asset.zone}`),
    rating: t('units.mw', { value: number(0).format(asset.capacityMw) }),
    loading: live ? t('units.pct', { value: number(1).format(loadingPct) }) : NO_VALUE,
    voltage: live ? t('units.pu', { value: number(3).format(voltagePu) }) : NO_VALUE,
  };
};
