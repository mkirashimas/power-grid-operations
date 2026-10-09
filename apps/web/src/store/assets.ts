import { generateAssets, type Asset } from '@pgo/grid-model';

let assets: Asset[] | undefined;
let byId: Map<string, Asset> | undefined;

/**
 * Every synthetic asset, in index order. The grid is deterministic, so it is generated once on
 * first use (a few ms) instead of being fetched.
 */
export const getAssets = (): Asset[] => {
  assets ??= generateAssets();
  return assets;
};

/** The synthetic asset with this id, or undefined. */
export const findAsset = (id: string | null): Asset | undefined => {
  if (!id) return undefined;
  byId ??= new Map(getAssets().map((asset) => [asset.id, asset]));
  return byId.get(id);
};
