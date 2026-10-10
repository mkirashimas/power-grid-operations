'use client';

import { Alert, Box, Button, Stack } from '@mui/material';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toLanguage } from '../../../i18n/language';
import { useAppDispatch, useAppSelector } from '../../../store';
import { findAsset, getAssets } from '../../../store/assets';
import { initialLiveFeed } from '../../../store/live/feed';
import { useLiveFeedQuery } from '../../../store/live/liveApi';
import { selectAsset, selectSelectedAssetId } from '../../../store/selectionSlice';
import { assetSeverity, LAYER_OF_KIND, MAP_LAYERS, toGeoJson, type MapLayer } from '../geo';
import { useMapUrlSync } from '../hooks/useMapUrlSync';
import { MAP_NAMESPACE } from '../i18n';
import { selectLayers } from '../slice';
import { AssetMap } from './AssetMap';
import { AssetTable } from './AssetTable';
import { ConnectionChip } from './ConnectionChip';
import { MapControls } from './MapControls';
import { SelectedAssetPanel } from './SelectedAssetPanel';

const EMPTY_FEED = initialLiveFeed();

/** The live map: controls, the map with the selected asset next to it, and a table view. */
export const MapView = ({ url }: { url: string }) => {
  const { t, i18n } = useTranslation(MAP_NAMESPACE);
  const dispatch = useAppDispatch();
  useMapUrlSync();
  const { data: feed = EMPTY_FEED } = useLiveFeedQuery(url);
  const layers = useAppSelector(selectLayers);
  const selected = findAsset(useAppSelector(selectSelectedAssetId));
  const [showTable, setShowTable] = useState(false);
  const [failed, setFailed] = useState(false);

  const assets = getAssets();
  const geo = useMemo(() => toGeoJson(assets), [assets]);
  const counts = useMemo(() => {
    const perLayer = Object.fromEntries(MAP_LAYERS.map((layer) => [layer, 0])) as Record<
      MapLayer,
      number
    >;
    assets.forEach((asset) => (perLayer[LAYER_OF_KIND[asset.kind]] += 1));
    return perLayer;
  }, [assets]);

  const severities = useMemo(() => {
    let warning = 0;
    let alarm = 0;
    assets.forEach(({ index }) => {
      const severity = assetSeverity(feed.assetLoading[index], feed.assetVoltage[index]);
      if (severity === 1) warning += 1;
      if (severity === 2) alarm += 1;
    });
    return { warning, alarm };
  }, [assets, feed.assetLoading, feed.assetVoltage]);

  const number = new Intl.NumberFormat(toLanguage(i18n.resolvedLanguage));
  const summary = t('summary', {
    count: number.format(assets.length),
    alarm: number.format(severities.alarm),
    warning: number.format(severities.warning),
  });
  const onSelect = (index: number) => dispatch(selectAsset(assets[index].id));
  const tableVisible = showTable || failed;

  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        useFlexGap
        sx={{ gap: 2, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <ConnectionChip status={feed.status} latencyMs={feed.latencyMs} />
        <MapControls counts={counts} />
      </Stack>

      {failed ? (
        <Alert severity="info">{t('failed')}</Alert>
      ) : (
        <Box
          sx={(theme) => ({
            display: 'grid',
            gap: 2,
            gridTemplateColumns: 'minmax(0, 1fr) 280px',
            alignItems: 'start',
            [theme.breakpoints.down('md')]: { gridTemplateColumns: 'minmax(0, 1fr)' },
          })}
        >
          <AssetMap
            assets={assets}
            geo={geo}
            loading={feed.assetLoading}
            voltage={feed.assetVoltage}
            changed={feed.changedAssets}
            layers={layers}
            selectedIndex={selected?.index ?? null}
            onSelect={onSelect}
            label={summary}
            onError={() => setFailed(true)}
          />
          <SelectedAssetPanel
            asset={selected}
            loadingPct={selected ? feed.assetLoading[selected.index] : undefined}
            voltagePu={selected ? feed.assetVoltage[selected.index] : undefined}
          />
        </Box>
      )}

      <Box>
        {!failed && (
          <Button aria-expanded={showTable} onClick={() => setShowTable((value) => !value)}>
            {showTable ? t('table.hide') : t('table.show')}
          </Button>
        )}
        {tableVisible && (
          <Box sx={{ mt: 1 }}>
            <AssetTable
              assets={assets}
              loading={feed.assetLoading}
              voltage={feed.assetVoltage}
              selectedIndex={selected?.index ?? null}
              onSelect={onSelect}
            />
          </Box>
        )}
      </Box>
    </Stack>
  );
};
