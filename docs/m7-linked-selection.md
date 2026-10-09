# M7: Linked selection

**Branch:** `feature/m7`, created from `development` and merged back into it.

## Goal

Select an asset in one view and every view follows:

- Click a row (or press Space on it) in the **telemetry** or **alarm** table to select its
  asset.
- A **selection bar** under the top bar shows the asset on every page, with links to the other
  views and a **Clear** button.
- The selection is in the URL (`?asset=<id>`): reload or share the link and it comes back.
- **Telemetry** highlights the asset's rows and charts its 6 days of MW and loading %.
- **Alarms** highlights its alarms, can show only them, and shows its live loading and voltage
  from the WebSocket.

The map (M8) and the network view (M9) will use the same selection.

## Scope

### 1. Shared state (`apps/web/src/store`)

| File                | Role                                                                          |
| ------------------- | ----------------------------------------------------------------------------- |
| `selectionSlice.ts` | `{ assetId }`, `selectAsset`, `clearSelection`, `selectSelectedAssetId`       |
| `assets.ts`         | `findAsset(id)`: lazy index of the deterministic synthetic grid (no network)  |
| `url.ts`            | `replaceSearchParams(ownedKeys, params)`: merges a view's params into the URL |

**Why merge:** until now each page's URL hook replaced the whole query string. With `asset` in
the URL as well, each hook now replaces only the keys it owns (`SEARCH_KEYS` in each feature's
`url.ts`).

### 2. App shell (`apps/web/src/hoc`)

- `useSelectionUrlSync`: reads `asset` when a page opens, writes it on every selection and page
  change. Unknown ids are ignored.
- `SelectionBar`: name, kind and zone of the asset, links to **Telemetry** and **Alarms**,
  **Clear**.

### 3. `VirtualGrid` (`@pgo/ui`)

- New `isRowSelected(index)` and `onRowSelect(index)`.
- A click on a data row, or Space / Enter on a cell without a button, selects.
- Rows get `aria-selected`; the grid is `aria-multiselectable="false"`.
- The highlight uses the `action.selected` token in both colour schemes.

### 4. Features

- **Telemetry:** selects on row click, highlights every row of the asset, and adds a
  **Selected asset** chart panel (MW and loading %), sliced from the columns already on the
  page.
- **Alarms:** selects on row click, highlights the asset's alarms, adds **Only the selected
  asset**, and shows the asset's live loading and voltage.
  - Ticks carry only about 5 % of assets each, so the page sends `watch { index }` for the
    selected asset. The server then sends that asset's values to that connection every tick
    (`asset` message), and the page sends `watch` again after a reconnect.
- Charts and Overview show system-wide data and don't change.

## Tests

- **Unit:**
  - selection slice, `replaceSearchParams`, the asset lookup
  - `VirtualGrid` selection (click, Space, `aria-selected`, axe)
  - the alarm feed's asset values
  - one asset's series from the telemetry columns
- **e2e:**
  - select in telemetry → bar, URL, highlighted rows, chart
  - the bar's **Alarms** link keeps the selection and shows live values
  - **Only the selected asset** filters the rows
  - reload restores the selection; **Clear** removes it
  - Space on a grid row selects
  - other URL params survive next to `asset`
  - axe in light and dark mode; no horizontal page scroll on mobile

## Verification

```bash
yarn lint && yarn typecheck && yarn test && yarn e2e
```

Expected: all green.

```bash
yarn dev
```

Expected:

- http://localhost:3000/telemetry: click a row; the selection bar and the asset chart appear,
  and the URL has `asset=`
- **Alarms** in the bar: the selection is kept, and the live readout updates every second
- reload: the selection is still there; **Clear** removes it

## Manual steps

None.
