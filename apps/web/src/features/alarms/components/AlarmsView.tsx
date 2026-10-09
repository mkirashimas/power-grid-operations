'use client';

import { Panel, useAnnounce } from '@pgo/ui';
import { Stack } from '@mui/material';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../store';
import { findAsset } from '../../../store/assets';
import { selectSelectedAssetId } from '../../../store/selectionSlice';
import { useLiveFeedQuery, useWatchAssetMutation } from '../api';
import { useAlarmsUrlSync } from '../hooks/useAlarmsUrlSync';
import { useMessageRate } from '../hooks/useMessageRate';
import { ALARMS_NAMESPACE } from '../i18n';
import { countAlarms, initialLiveFeed } from '../live';
import { AlarmKpis } from './AlarmKpis';
import { AlarmTable } from './AlarmTable';
import { ConnectionChip } from './ConnectionChip';
import { LiveLoadChart } from './LiveLoadChart';
import { SelectedAssetLive } from './SelectedAssetLive';

const EMPTY_FEED = initialLiveFeed();
/** At most one spoken alarm per this many ms, so screen readers are not flooded. */
const ANNOUNCE_GAP_MS = 10_000;

/** The live alarm feed: connection, KPIs, live load chart and the alarm table. */
export const AlarmsView = ({ url }: { url: string }) => {
  const { t } = useTranslation(ALARMS_NAMESPACE);
  useAlarmsUrlSync();
  const { data: feed = EMPTY_FEED } = useLiveFeedQuery(url);
  const counts = useMemo(() => countAlarms(feed.alarms), [feed.alarms]);
  const updatesPerSecond = useMessageRate(feed.messageCount);

  // Follow the linked selection: the server then sends its values every tick. Sent again
  // after a reconnect, since a new connection starts without a watch.
  const selected = findAsset(useAppSelector(selectSelectedAssetId));
  const [watch] = useWatchAssetMutation();
  const live = feed.status === 'live';
  const selectedIndex = selected?.index ?? null;
  useEffect(() => {
    if (live) watch({ url, index: selectedIndex });
  }, [live, selectedIndex, url, watch]);

  // Announce new alarms (not warnings) politely, throttled; the first `hello` is not news.
  const announce = useAnnounce();
  const seen = useRef<{ newest: string | undefined; at: number } | null>(null);
  const newest = feed.alarms[0];
  useEffect(() => {
    if (feed.status !== 'live' || !newest) return;
    if (seen.current === null) {
      seen.current = { newest: newest.id, at: 0 };
      return;
    }
    if (newest.id === seen.current.newest) return;
    seen.current.newest = newest.id;
    const now = Date.now();
    if (newest.severity === 'alarm' && now - seen.current.at > ANNOUNCE_GAP_MS) {
      seen.current.at = now;
      announce(
        t('announce', { condition: t(`conditions.${newest.condition}`), asset: newest.assetName }),
      );
    }
  }, [feed.status, newest, announce, t]);

  return (
    <Stack spacing={3}>
      <ConnectionChip status={feed.status} latencyMs={feed.latencyMs} />
      <AlarmKpis counts={counts} updatesPerSecond={updatesPerSecond} />
      {selected && (
        <SelectedAssetLive
          asset={selected}
          values={feed.watched?.index === selected.index ? feed.watched : null}
        />
      )}
      <Panel title={t('chart.title')}>
        <LiveLoadChart history={feed.history} />
      </Panel>
      <Panel title={t('table.label')}>
        <AlarmTable url={url} alarms={feed.alarms} />
      </Panel>
    </Stack>
  );
};
