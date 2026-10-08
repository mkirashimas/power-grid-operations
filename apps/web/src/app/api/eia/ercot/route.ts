import { getErcotData } from '../../../../server/eia';

/** ERCOT demand, day-ahead forecast, generation, interchange and generation by fuel (EIA). */
export const GET = async () => {
  const { live, snapshot } = await getErcotData();
  return Response.json({ live, ...snapshot });
};
