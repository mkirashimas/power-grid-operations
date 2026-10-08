import 'server-only';
import { generateAssets, type Asset } from '@pgo/grid-model';

let assets: Asset[] | undefined;

/** The synthetic grid. Deterministic, so it is generated once per server process. */
export const getAssets = (): Asset[] => {
  assets ??= generateAssets();
  return assets;
};
