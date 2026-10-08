import { DEFAULT_SEED, SYNTHETIC_LABEL } from '@pgo/grid-model';
import { getAssets } from '../../../server/assets';

/** The synthetic grid assets. Generated data, never EIA data. */
export const GET = () => {
  const assets = getAssets();
  return Response.json({
    label: SYNTHETIC_LABEL,
    synthetic: true,
    seed: DEFAULT_SEED,
    count: assets.length,
    assets,
  });
};
