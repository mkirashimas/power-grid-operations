import { generateAssets, type Asset } from '@pgo/grid-model';

let byId: Map<string, Asset> | undefined;

/**
 * The synthetic asset with this id, or undefined. The grid is deterministic, so it is
 * generated once on first use (a few ms) instead of being fetched.
 */
export const findAsset = (id: string | null): Asset | undefined => {
  if (!id) return undefined;
  byId ??= new Map(generateAssets().map((asset) => [asset.id, asset]));
  return byId.get(id);
};
