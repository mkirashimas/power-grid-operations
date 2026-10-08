import {
  ASSET_KINDS,
  statusOf,
  statusSeverity,
  WEATHER_ZONES,
  type Asset,
  type TelemetryColumns,
} from '@pgo/grid-model';
import type { TelemetryDataset } from './types';

/** Precomputes the keys every query needs: row status and per-asset sort ranks. */
export const createDataset = (assets: Asset[], columns: TelemetryColumns): TelemetryDataset => {
  const severity = new Uint8Array(columns.length);
  for (let row = 0; row < columns.length; row += 1) {
    severity[row] = statusSeverity(statusOf(columns.loadingPct[row], columns.voltagePu[row]));
  }

  const assetNameRank = new Uint16Array(assets.length);
  [...assets]
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
    .forEach((asset, rank) => {
      assetNameRank[asset.index] = rank;
    });

  return {
    assets,
    columns,
    severity,
    assetNameRank,
    kindIndex: Uint8Array.from(assets, (asset) => ASSET_KINDS.indexOf(asset.kind)),
    zoneIndex: Uint8Array.from(assets, (asset) => WEATHER_ZONES.indexOf(asset.zone)),
  };
};
