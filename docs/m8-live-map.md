# M8: Live map

**Branch:** `feature/m8`, created from `development` and merged back into it.

## Goal

A `/map` page shows the synthetic grid over Texas, coloured by live loading:

- **Base map:** OpenFreeMap vector tiles (no API key), `positron` in light mode and `dark` in
  dark mode. The OpenFreeMap / OpenMapTiles / OpenStreetMap attribution is always visible.
- **Assets:** 769 lines, 400 substations, 300 generators and 400 loads, coloured normal,
  warning (loading ≥ 90 %) or alarm (≥ 100 %, or voltage outside 0.95–1.05 pu). Colours change
  every second as the realtime service streams updates.
- **Layer toggles** and a **legend** that uses shape and text as well as colour.
- **Linked selection** (M7):
  - clicking an asset selects it
  - the selected asset gets a ring, and a side panel shows its live values
  - an asset selected elsewhere (a table, a shared link) is flown to
- **Show as table:** every asset with live loading, voltage and status, sortable and
  selectable by keyboard. It is the accessible alternative to the map canvas.

## Scope

### 1. Shared live feed (`apps/web/src/store/live`)

The WebSocket client moves out of the alarms feature, since a feature may not import another
feature. It becomes infrastructure, like `store/api.ts`:

| File         | Role                                                                   |
| ------------ | ---------------------------------------------------------------------- |
| `socket.ts`  | reconnecting WebSocket (moved from alarms)                             |
| `feed.ts`    | `LiveFeedState`, `applyMessage` (moved, plus per-asset values)         |
| `liveApi.ts` | `liveFeed` streaming query, `acknowledgeAlarm`, `watchAsset` mutations |

Alarms and map use the same cache entry, so there is one socket per tab.

### 2. Protocol (`@pgo/grid-model`)

- `hello` gains `assets`: `[index, loadingPct, voltagePu, …]` for every asset (about 30 KB),
  so the map is fully coloured from the first message.
- The simulator gains `snapshotAssets()`.
- Older clients ignore the new field.

### 3. Feature `apps/web/src/features/map`

- `geo.ts`: pure `toGeoJson(assets)`:
  - one point collection per kind, plus lines drawn between their two substations
  - feature ids are asset indexes
- `AssetMap`:
  - MapLibre is loaded with a dynamic `import()` (client only, only on this page)
  - live colours use **feature-state** on the assets that changed, not a full `setData`
  - a scheme change swaps the base style and re-adds the asset layers
- Layer visibility is mirrored in the URL (`layers`).

### 4. Details that needed care

- **MapLibre's worker:** MapLibre looks for its worker script next to its own module, which
  bundling moves.
  - `AssetMap` calls `setWorkerUrl` with a `new URL(…, import.meta.url)` for
    `maplibre-gl/dist/maplibre-gl-worker.mjs`.
  - That makes Turbopack emit the file and points MapLibre at it.
  - Without it the base map draws, but no tiles or assets do.
- **Hit testing:**
  - Clicks search ±5 px (±12 px for touch).
  - Upper layers win, then the nearest point. Assets can sit a few pixels apart, and the
    order of `queryRenderedFeatures` doesn't guarantee either.
- **Opening a shared link:** the map starts centred on `?asset=`, read from the URL when the map
  is created, so it doesn't depend on when the store receives the selection.
- **`data-ready`** on the map container marks when the asset layers exist (used by the e2e
  click test).

## Tests

- **Unit:**
  - `toGeoJson`
  - per-asset feed state
  - `snapshotAssets`
  - `hello` carries assets
  - URL `layers`
  - the moved live-feed tests
- **e2e:** OpenFreeMap requests are routed to a minimal local style, so tests don't depend on
  the network.
  - the map renders, with the attribution visible
  - layer toggles update the URL
  - the table lists 1,869 assets
  - selecting a row shows the side panel and the selection bar
  - `?asset=` opens with the asset selected
  - axe in light and dark mode
  - no horizontal page scroll on mobile

## Verification

```bash
yarn lint && yarn typecheck && yarn test && yarn e2e
```

Expected: all green.

```bash
yarn dev
```

Expected at http://localhost:3000/map:

- Texas, with coloured assets that change every few seconds
- clicking an asset shows the selection bar and the side panel
- **Open in Map** from the selection bar on another page flies to the asset
- dark mode switches the base map

## Manual steps

None.

## Credits

Map tiles by [OpenFreeMap](https://openfreemap.org), © OpenMapTiles, data ©
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
