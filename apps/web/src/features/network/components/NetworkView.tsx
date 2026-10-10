'use client';

import { WEATHER_ZONES, type TelemetryStatus } from '@pgo/grid-model';
import { Panel, SegmentedControl } from '@pgo/ui';
import { Box, MenuItem, Stack, TextField } from '@mui/material';
import { useCallback, useDeferredValue, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../../store';
import { findAsset, getAssets } from '../../../store/assets';
import { initialLiveFeed } from '../../../store/live/feed';
import { useLiveFeedQuery } from '../../../store/live/liveApi';
import { selectAsset, selectSelectedAssetId } from '../../../store/selectionSlice';
import { compareStudies, prepareNetwork, runStudy, type StudyEdit } from '../engine/study';
import { useNetworkUrlSync } from '../hooks/useNetworkUrlSync';
import { NETWORK_NAMESPACE } from '../i18n';
import {
  applyEdit,
  clearEdits,
  removeEdit,
  selectNetwork,
  setMode,
  setZone,
  type NetworkMode,
  type ZoneScope,
} from '../slice';
import { liveStatus, studyStatus } from '../status';
import { buildTree } from '../tree';
import { AssetTree } from './AssetTree';
import { StudyResults } from './StudyResults';
import { TopologyGraph } from './TopologyGraph';
import { WhatIfPanel } from './WhatIfPanel';

const EMPTY_FEED = initialLiveFeed();
const ZONE_OPTIONS: readonly ZoneScope[] = ['all', ...WEATHER_ZONES];

/** Asset tree, topology graph and what-if editor, all on the linked selection. */
export const NetworkView = ({ url }: { url: string }) => {
  const { t } = useTranslation(NETWORK_NAMESPACE);
  const dispatch = useAppDispatch();
  useNetworkUrlSync();
  const viewState = useAppSelector(selectNetwork);
  const { zone } = viewState;
  // The controls follow the store at once; the study, the graph and the tree follow at low
  // priority (interruptible), so a click responds immediately even though re-rendering the
  // 1,169-element graph takes a few hundred ms on slower machines.
  const mode = useDeferredValue(viewState.mode);
  const edits = useDeferredValue(viewState.edits);
  const selectedId = useAppSelector(selectSelectedAssetId);
  const selected = findAsset(selectedId);
  const { data: feed = EMPTY_FEED } = useLiveFeedQuery(url);

  const assets = getAssets();
  const network = useMemo(() => prepareNetwork(assets), [assets]);
  const tree = useMemo(() => buildTree(assets), [assets]);
  const lineOf = useMemo(
    () => new Map(network.lines.map((line, index) => [line.asset.id, index])),
    [network],
  );

  // Base case once; the study whenever the edits change (a few ms for 400 buses).
  const base = useMemo(() => runStudy(network, []), [network]);
  const study = useMemo(() => runStudy(network, edits), [network, edits]);
  const comparison = useMemo(() => compareStudies(network, base, study), [network, base, study]);
  const deEnergized = useMemo(
    () => new Set(mode === 'study' ? study.deEnergized : []),
    [mode, study],
  );

  const live = useCallback(
    (assetIndex: number) =>
      liveStatus(feed.assetLoading[assetIndex], feed.assetVoltage[assetIndex]),
    [feed.assetLoading, feed.assetVoltage],
  );
  const lineStatus = useCallback(
    (line: number) =>
      mode === 'study'
        ? { status: studyStatus(study.loadingPct[line]), tripped: !study.inService[line] }
        : { status: live(network.lines[line].asset.index), tripped: false },
    [mode, study, live, network],
  );
  const busStatus = useCallback(
    (bus: number): TelemetryStatus =>
      mode === 'study' ? 'normal' : live(network.buses[bus].index),
    [mode, live, network],
  );
  const statusOf = useCallback(
    (id: string): TelemetryStatus | undefined => {
      const line = lineOf.get(id);
      if (mode === 'study' && line !== undefined) return lineStatus(line).status;
      const asset = findAsset(id);
      return asset ? live(asset.index) : undefined;
    },
    [mode, lineOf, lineStatus, live],
  );

  const select = useCallback((id: string) => dispatch(selectAsset(id)), [dispatch]);
  const visibleBuses = network.buses.filter((bus) => zone === 'all' || bus.zone === zone);
  const visibleIds = new Set(visibleBuses.map((bus) => bus.id));
  const visibleLines = network.lines.filter(
    (line) =>
      visibleIds.has(network.buses[line.from].id) && visibleIds.has(network.buses[line.to].id),
  );

  return (
    <Stack spacing={2}>
      <Stack direction="row" useFlexGap sx={{ gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <SegmentedControl<NetworkMode>
          label={t('mode.label')}
          value={viewState.mode}
          options={[
            { value: 'live', label: t('mode.live') },
            { value: 'study', label: t('mode.study') },
          ]}
          onChange={(value) => dispatch(setMode(value))}
        />
        <TextField
          select
          size="small"
          label={t('zone.label')}
          value={zone}
          onChange={(event) => dispatch(setZone(event.target.value as ZoneScope))}
          sx={{ minWidth: 180 }}
        >
          {ZONE_OPTIONS.map((option) => (
            <MenuItem key={option} value={option}>
              {option === 'all' ? t('zone.all') : t(`zones.${option}`)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Box
        sx={(theme) => ({
          display: 'grid',
          gap: 2,
          alignItems: 'start',
          gridTemplateColumns: 'minmax(240px, 300px) minmax(0, 1fr) minmax(280px, 340px)',
          [theme.breakpoints.down('lg')]: {
            gridTemplateColumns: 'minmax(240px, 300px) minmax(0, 1fr)',
          },
          [theme.breakpoints.down('md')]: { gridTemplateColumns: 'minmax(0, 1fr)' },
        })}
      >
        <Panel title={t('tree.title')} headingLevel={2}>
          <AssetTree tree={tree} statusOf={statusOf} selectedId={selectedId} onSelect={select} />
        </Panel>
        <Panel title={t('graph.title')} headingLevel={2}>
          <TopologyGraph
            network={network}
            zone={zone}
            busStatus={busStatus}
            lineStatus={lineStatus}
            deEnergized={deEnergized}
            selectedId={selectedId}
            onSelect={select}
            label={t('graph.label', {
              substations: visibleBuses.length,
              lines: visibleLines.length,
            })}
            hint={t('graph.hint')}
          />
        </Panel>
        <Box
          sx={(theme) => ({
            [theme.breakpoints.down('lg')]: { gridColumn: '1 / -1' },
          })}
        >
          <Panel title={t('editor.heading')} headingLevel={2}>
            <Stack spacing={3}>
              <WhatIfPanel
                selected={selected}
                edits={viewState.edits}
                onApply={(edit: StudyEdit) => dispatch(applyEdit(edit))}
                onRemove={(edit: StudyEdit) => dispatch(removeEdit(edit))}
                onReset={() => dispatch(clearEdits())}
              />
              <StudyResults
                hasEdits={edits.length > 0}
                study={study}
                comparison={comparison}
                onSelect={select}
              />
            </Stack>
          </Panel>
        </Box>
      </Box>
    </Stack>
  );
};
