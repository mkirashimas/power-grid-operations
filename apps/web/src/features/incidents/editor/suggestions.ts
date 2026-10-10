import type { Asset } from '@pgo/grid-model';

export const MAX_SUGGESTIONS = 8;

// Lower is better: the name starts with the query, the id does, a word in the name does,
// then the name contains it anywhere.
const rank = (asset: Asset, needle: string) => {
  const name = asset.name.toLowerCase();
  if (name.startsWith(needle)) return 0;
  if (asset.id.startsWith(needle)) return 1;
  if (name.split(/[\s–-]+/).some((word) => word.startsWith(needle))) return 2;
  if (name.includes(needle) || asset.id.includes(needle)) return 3;
  return -1;
};

/**
 * Assets for the @-mention list: best matches first, then grid order. An empty query lists the
 * first substations, so the list is never empty while typing starts.
 */
export const suggestAssets = (
  assets: readonly Asset[],
  query: string,
  limit = MAX_SUGGESTIONS,
): Asset[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return assets.filter((asset) => asset.kind === 'substation').slice(0, limit);
  return assets
    .map((asset) => ({ asset, rank: rank(asset, needle) }))
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.asset.index - b.asset.index)
    .slice(0, limit)
    .map(({ asset }) => asset);
};
