import { api } from '../api';
import { applyMessage, initialLiveFeed, type LiveFeedState } from './feed';
import { openLiveSocket, type LiveSocket } from './socket';

// One socket per realtime URL while its cache entry is in use; mutations send through it.
const sockets = new Map<string, LiveSocket>();

/**
 * The live feed from the realtime service, shared by every view that shows live data (alarms,
 * map): one cache entry, so one WebSocket per tab. The query itself resolves at once with an empty
 * feed; `onCacheEntryAdded` then opens the WebSocket and folds every message into the cache.
 */
export const liveApi = api.injectEndpoints({
  endpoints: (build) => ({
    liveFeed: build.query<LiveFeedState, string>({
      queryFn: () => ({ data: initialLiveFeed() }),
      // Close the socket as soon as the page that uses it goes away.
      keepUnusedDataFor: 0,
      async onCacheEntryAdded(url, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
        try {
          await cacheDataLoaded;
        } catch {
          return;
        }
        const socket = openLiveSocket(url, {
          onMessage: (message) =>
            updateCachedData((draft) => applyMessage(draft, message, Date.now())),
          onStatus: (status) =>
            updateCachedData((draft) => {
              draft.status = status;
            }),
        });
        sockets.set(url, socket);
        await cacheEntryRemoved;
        socket.close();
        sockets.delete(url);
      },
    }),
    /** Sends an acknowledgement; the server broadcasts the updated alarm to every client. */
    acknowledgeAlarm: build.mutation<null, { url: string; id: string }>({
      queryFn: ({ url, id }) =>
        sockets.get(url)?.send({ type: 'ack', id })
          ? { data: null }
          : { error: { status: 'CUSTOM_ERROR', error: 'Not connected' } },
    }),
    /** Asks the server for one asset's values every tick (null stops). */
    watchAsset: build.mutation<null, { url: string; index: number | null }>({
      queryFn: ({ url, index }) =>
        sockets.get(url)?.send({ type: 'watch', index })
          ? { data: null }
          : { error: { status: 'CUSTOM_ERROR', error: 'Not connected' } },
    }),
  }),
});

export const { useLiveFeedQuery, useAcknowledgeAlarmMutation, useWatchAssetMutation } = liveApi;
