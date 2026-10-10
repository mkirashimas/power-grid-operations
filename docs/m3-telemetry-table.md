# M3: Telemetry table

**Branch:** `feature/m3`, created from `development` and merged back into it.

## Goal

A `/telemetry` page showing all 1,076,544 synthetic telemetry rows:

- virtual scrolling
- multi-column sort, filters, and grouping with collapsible groups
- full keyboard operation (ARIA grid pattern)
- a timing readout for every operation

All data work runs in a Web Worker, so the page never freezes.

## Scope

### 1. Data path

- The page is a **server component**.
  - It reads the EIA demand series (about 720 hourly points) with `getErcotData()` and passes
    it to the client view.
  - The view credits EIA, because the load shape comes from EIA data. The rows themselves are
    labelled **synthetic**.
- A **Web Worker** generates the data with `@pgo/grid-model`.
  - It runs `generateAssets()` and `generateTelemetry()`: the same seeded data the server would
    produce, in about 0.2 s and with no download.
  - It keeps the columns in its own memory and answers queries.
- **Query flow:**
  1. The main thread sends a query spec: sort, filters, grouping and expanded groups.
  2. The worker returns the display order as a transferable `Uint32Array`, plus group summaries
     and timings.
  3. On start, the worker also transfers one copy of the columns (about 23 MB) to the page, so
     the grid reads cell values synchronously. The worker keeps its own copy for queries.

### 2. Query engine (`apps/web/src/features/telemetry/engine/`)

Pure functions, run by the worker and unit-tested in Node.

- **Status:** `statusOf(loadingPct, voltagePu)` in `@pgo/grid-model`, reused by the alarm feed
  and the map. Thresholds:

  | Status  | Condition                                        |
  | ------- | ------------------------------------------------ |
  | alarm   | loading ≥ 100 %, or voltage outside 0.95–1.05 pu |
  | warning | loading ≥ 90 %                                   |
  | normal  | otherwise                                        |

- **Filter** by text (asset name or id), kind, weather zone and status.
  - Assets are matched first (about 1,869 checks), then their contiguous row slices are
    collected, because rows are stored asset by asset.
  - The status filter is checked per row.
- **Sort:** multi-column and stable, as an index sort over typed-array keys. Asset name, kind,
  zone and status map to small integers.
- **Group** by kind, zone, asset or status.
  - Each group header shows the row count, average and maximum MW, maximum loading and the worst
    status.
  - Groups start collapsed, and sorting applies within each group.

### 3. `VirtualGrid` (`@pgo/ui`)

A generic, accessible virtual grid, also used later by the alarm table.

- **Rows are virtualized by a small built-in windowing function** (`scaledWindow.ts`), not a
  library.
  - The browser caps an element at about 33.5M px in Chrome and 17.9M px in Firefox, but
    1,076,544 rows × 40 px need 43M px.
  - So the scroll area is capped at 15M px, and the scroll position maps proportionally onto
    the full row range: every row, including the last, stays reachable.
  - TanStack Virtual, the first choice, has no such scaling: the e2e test found the last rows
    unreachable.
- **Narrow screens:** the 8 columns scroll sideways inside the grid, with a sticky first column.
- **ARIA:**
  - `role="grid"`, or `treegrid` when grouped
  - `aria-rowcount` / `aria-colcount`, and `aria-rowindex` on each rendered row
  - `aria-sort` on sortable headers
  - `aria-expanded` and `aria-level` on group rows
- **Keyboard:** a single focusable cell (roving tabindex).

  | Key                                              | Action                           |
  | ------------------------------------------------ | -------------------------------- |
  | Arrows, Home/End, Ctrl+Home/End, PageUp/PageDown | move focus (scrolling as needed) |
  | Enter / Space on a header                        | sort (asc → desc → off)          |
  | Shift + Enter / Space on a header                | add a secondary sort             |
  | Enter / Space / ← / → on a group row             | collapse or expand               |

### 4. Page

- A `Panel` titled "Telemetry", with a `SyntheticBadge`.
- **Toolbar:**
  - an asset filter
  - kind, zone and status selects
  - a group-by select
  - Expand all / Collapse all
- **Readout:** row counts and per-operation timings, also announced politely to screen readers.
- **Cells:**
  - times in ERCOT Central Time
  - numbers formatted for the active language
  - status shown as a `StatusChip`
- **State:** the query state lives in a feature slice and is mirrored in the URL, so a view can
  be shared.
- **Wiring:** `PATHS.TELEMETRY` is `/telemetry`, with a sidebar item and an empty state.
  Translations cover all 5 languages.

## Tests

- **Engine:**
  - filters agree with a brute-force check
  - stable multi-column sort
  - group counts and aggregates
  - expanded and collapsed output
  - status thresholds
- **`VirtualGrid`:**
  - roles and ARIA counts
  - keyboard movement
  - the sort cycle
  - group toggling
  - axe
- **e2e:**
  - 1,076,544 rows load
  - sorting by MW descending puts the largest value first
  - filtering narrows the rows
  - grouping by zone gives 8 groups
  - keyboard navigation works
  - axe passes in light and dark mode
  - no horizontal page scroll on mobile

## Verification

```bash
yarn lint && yarn typecheck && yarn test && yarn e2e
```

Expected: all green.

```bash
yarn dev
```

Expected at http://localhost:3000/telemetry:

- the rows appear within about half a second
- scrolling stays smooth
- sorting, filtering and grouping update with their timings shown
- everything works from the keyboard

## Manual steps after development

None.

## Measured performance

Chromium, desktop, production build. Each figure is the time the worker spends on the step.

| Operation                         | Time         |
| --------------------------------- | ------------ |
| Generate 1,076,544 rows           | about 410 ms |
| Filter (text, kind, zone, status) | 3–15 ms      |
| Sort, 1 key                       | about 380 ms |
| Sort, 2 keys                      | about 440 ms |
| Group by zone (after sorting)     | about 55 ms  |

Sorting copies each sort column into a `Float64Array` (with descending columns negated) and
sorts positions with an unrolled comparator. That halved the two-key sort, from 944 ms to
436 ms.
