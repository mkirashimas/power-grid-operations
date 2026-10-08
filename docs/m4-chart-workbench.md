# M4: Chart workbench

**Branch:** `feature/m4`, created from `development` and merged back into it.

## Goal

A `/charts` page with stacked canvas charts that share one time axis:

- real ERCOT data from EIA: forecast vs actual, generation by fuel, interchange
- a synthetic 1-second load series of about 2.6M points

The charts support zoom, pan, an overview brush and a crosshair synced across every pane. They
are fully operable by keyboard, and each one has a table view for screen readers. The
high-resolution pane is drawn through JS min/max downsampling; M5 adds a Rust/WASM version to
compare against it.

## Scope

### 1. Data

- **EIA (real):** the last 30 days, hourly, read on the server with `getErcotData()`:
  - demand
  - day-ahead forecast
  - net generation by fuel
  - total interchange
- **Synthetic:** `generateHighResLoad(demand)` in `@pgo/grid-model` builds a 1-second system
  load over the same 30 days:
  - the interpolated EIA demand, plus seeded noise and short spikes
  - about 2.6M points as typed arrays, generated in the browser
  - labelled **synthetic**

### 2. Chart primitives (`@pgo/ui`, `components/charts/`)

| Piece                        | Role                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `ChartWorkbench`             | owns the shared time range and the crosshair; lays out panes and the overview           |
| `TimeSeriesPane`             | HiDPI canvas pane drawing line, band and stacked-area series, with axes from `d3-scale` |
| `OverviewBrush`              | the full range in miniature, with a draggable and resizable window                      |
| `downsampleMinMax`           | keeps the first, min, max and last point per pixel column: no peak is lost              |
| `palette.chart.series[0..5]` | series colours for both schemes, ≥ 3:1 against the background (checked by a test)       |

**Interaction:**

- Mouse: the wheel zooms around the pointer, dragging pans, and a double-click resets.
- Toolbar: zoom in and out, reset, and presets (24 h / 7 d / 30 d).
- Keyboard, once a chart has focus:

  | Key           | Action                   |
  | ------------- | ------------------------ |
  | ← / →         | move the crosshair       |
  | Shift + ← / → | pan                      |
  | + / −         | zoom                     |
  | Home / End    | crosshair to start / end |
  | Esc           | clear the crosshair      |

**Accessibility:**

- Each pane is `role="img"`, with a summary of its series, range and min/max.
- The crosshair values are announced politely.
- **Show as table** lists the visible points in `VirtualGrid`.

### 3. Page (`apps/web/src/features/charts`)

1. Demand vs day-ahead forecast, with the forecast error as a band
2. Generation by fuel (stacked area)
3. Net interchange (zero baseline)
4. 1-second synthetic load, with a readout like "2,592,000 → 1,840 points drawn in 6 ms"

- The time range is mirrored in the URL (`from`, `to`), so a view can be shared.
- The page credits EIA as the source, and the synthetic pane carries a **Synthetic** badge.
- `PATHS.CHARTS` is `/charts`, with a sidebar item and translations in 5 languages.

## Tests

- **Unit:**
  - zoom and pan math (clamping, zoom around a point)
  - `downsampleMinMax` (keeps extremes, bounded output)
  - high-resolution generation
  - palette contrast
  - keyboard handling
  - `role="img"` labels
  - table toggle
- **e2e:**
  - four panes render
  - keyboard zoom changes the range and the URL
  - dragging the brush moves the range
  - the crosshair readout updates in every pane
  - the table view lists points
  - axe in light and dark mode
  - no horizontal page scroll on mobile
- **Storybook:** chart stories pass axe in both schemes.

## Verification

```bash
yarn lint && yarn typecheck && yarn test && yarn e2e
```

Expected: all green.

```bash
yarn dev
```

Expected at http://localhost:3000/charts:

- zooming and panning stay smooth, and the crosshair follows in every pane
- the brush moves the range
- everything works from the keyboard
- **Show as table** lists the points

## Manual steps after development

None.

## Measured performance

Chromium, desktop, production build. The synthetic 1-second load series is downsampled to the
pane width on every draw.

| Visible range | Points in range | Points drawn | Downsample + draw |
| ------------- | --------------- | ------------ | ----------------- |
| 24 h          | 39,602          | 1,572        | 0.8 ms            |
| 7 days        | 558,002         | 3,223        | 4.7 ms            |
| 30 days       | 2,588,401       | 3,427        | 19.7 ms           |

Generating the series takes about 420 ms, once, on the main thread after the first paint.
M5 moves generation and downsampling into a worker and adds a Rust/WASM implementation to
compare.

**Notes:**

- Plain mouse-wheel scrolling keeps scrolling the page. Ctrl + wheel (and trackpad pinch,
  which sends Ctrl) zooms the chart, so stacked charts never trap the page scroll.
- Server components pass the EIA snapshot as plain JSON. The typed arrays are built in the
  browser.
