# M11: Finish

**Branch:** `feature/m11`, created from `development` and merged back into it, then released to
`main`.

## Goal

The app is feature-complete after M10. M11 measures it, closes the gaps the measurements show,
and makes it easy to present:

- **Coverage:** every workspace reports coverage, and CI fails if it drops below the thresholds.
- **Accessibility sweep:** the checks that axe can't do on its own.
- **README numbers:**
  - load metrics per page, and route JavaScript size
  - Lighthouse scores
  - timings for the network study, the PDF viewer and the telemetry query
- **Demo:** a scripted Playwright tour records a video and the README screenshots.
- **Release:** a checklist to deploy `main` and add the live-demo link.

## Coverage

`yarn coverage` runs Vitest with V8 coverage in every workspace, and CI runs it instead of
`yarn test`. Each workspace fails below its thresholds. They are set about 2 points under the
measured values, in its `vitest.config.ts`.

| Workspace         | Lines (before → after) | Statements | Branches | Functions | Threshold (lines) |
| ----------------- | ---------------------- | ---------- | -------- | --------- | ----------------- |
| `@pgo/web`        | 40.5 % → 52.1 %        | 52.3 %     | 40.9 %   | 49.9 %    | 50 %              |
| `@pgo/ui`         | 70.8 % → 74.2 %        | 73.2 %     | 71.7 %   | 71.2 %    | 72 %              |
| `@pgo/grid-model` | 98.5 %                 | 97.9 %     | 91.1 %   | 97.6 %    | 96 %              |
| `@pgo/downsample` | 95.0 %                 | 95.4 %     | 93.1 %   | 93.3 %    | 93 %              |
| `@pgo/realtime`   | 82.0 % → 90.1 %        | 87.7 %     | 73.8 %   | 85.2 %    | 88 %              |

**Tests added,** for logic that had none:

- the six URL-sync hooks, in one parametrised test (`features/urlSync.test.tsx`)
- the map, network and telemetry slices, and `useMessageRate`
- the network what-if panel and study results
- the incident list, the report header and the attachments (upload checks, IndexedDB)
- the shared live-feed endpoint (`store/live/liveApi.test.ts`):
  - one socket per URL
  - messages folded into the cache
  - acknowledgements
  - the socket closes when unused
- `buildPaneView`, which decides what every chart pane draws
- `reuseUnchanged` (network graph) and the reduced-motion helpers

**What unit coverage leaves out, on purpose:**

- **Glue around canvas, MapLibre, React Flow, pdf.js and the workers.** Unit tests would only
  mock the library. The Playwright suite covers that code in a real browser, on every page,
  on desktop and mobile.
- **`services/realtime/src/main.ts`.** It only reads the environment and starts the server;
  e2e starts it on every run.

## Accessibility sweep

axe (WCAG 2.1 AA) already runs on every page and every Storybook story, in both colour schemes.
M11 adds the checks that axe can't do:

| Check                       | Test                                      | Found, and fixed                                                                                                                        |
| --------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Page outline                | `a11y-sweep.spec.ts`, every page          | `/alarms`: the KPI cards were `h3` directly under the `h1`. They are now `h2`.                                                          |
| Visible focus on every stop | `keyboard.spec.ts`, Tab through each page | Buttons, links and list items showed focus only as a ripple; the asset tree only as a tint. Both now have a 2 px outline.               |
| No keyboard trap            | `keyboard.spec.ts`                        | none                                                                                                                                    |
| Skip link                   | `keyboard.spec.ts`                        | none                                                                                                                                    |
| Reflow at 320 CSS px        | `a11y-sweep.spec.ts`, every page          | none                                                                                                                                    |
| Reduced motion              | theme test + `a11y-sweep.spec.ts`         | MUI transitions, the graph's centring and the map's `flyTo` ignored the setting. A theme CSS rule and `motionDuration()` now stop them. |
| Forced colors               | `a11y-sweep.spec.ts`                      | Focus came from the ripple and shadows, which forced colors removes; it is now an outline. Status keeps its icon and text.              |

The demo recording also showed two visual bugs, now fixed:

- the chart y-axis labels were clipped (a fixed 60 px gutter for "70,000 MW"), and so was the
  last x-axis label
- search fields showed a second, native clear button next to the design system's own

### Screen reader (manual, NVDA + Chrome)

Run this before the release:

1. **Overview:** the headings list (H) gives the page outline.
2. **Telemetry:**
   - in the grid, the arrows move by cell and NVDA reads the column header
   - after a filter, the readout announces the row count
3. **Charts:** each pane reads as an image with a summary, and **Show as table** gives the data.
4. **Alarms:** a new alarm is announced (assertive), and acknowledging one keeps focus in the
   grid.
5. **Map:** **Show as table** lists every asset with its live values.
6. **Network:**
   - the tree announces the level and the expanded state, and Space selects
   - the study results are announced (polite)
7. **Incidents:**
   - the editor is announced as "Report text, edit, multi-line"
   - typing **@** reads the highlighted asset as you press the arrows
   - "All changes saved" is announced
   - PDF search announces "1 of 2", and the page text can be read in browse mode

Note anything that sounds wrong, and I will fix it before the release.

## Measurements

`yarn measure` (`apps/web/measure/measure.spec.ts`) builds and starts the app with the realtime
service at its normal pace. It measures in desktop Chromium:

- every page, in a fresh browser context (a cold cache)
- the median of 5 runs
- interactions after a 2-second settle

It prints the tables below and writes `docs/measurements.json`. Lighthouse 12 (desktop preset)
was run with the same Chromium.

Desktop Chromium, production build, cold cache, median of 5 runs:

| Page                       | Ready    | LCP    | CLS   | TBT    | JS (compressed) |
| -------------------------- | -------- | ------ | ----- | ------ | --------------- |
| `/`                        | 307 ms   | 172 ms | 0.000 | 5 ms   | 313 kB          |
| `/telemetry`               | 1,199 ms | 180 ms | 0.007 | 7 ms   | 323 kB          |
| `/charts`                  | 1,260 ms | 220 ms | 0.000 | 7 ms   | 324 kB          |
| `/alarms`                  | 484 ms   | 160 ms | 0.036 | 7 ms   | 323 kB          |
| `/map`                     | 1,245 ms | 180 ms | 0.000 | 84 ms  | 597 kB          |
| `/network`                 | 816 ms   | 232 ms | 0.000 | 375 ms | 404 kB          |
| `/incidents`               | 557 ms   | 128 ms | 0.000 | 27 ms  | 335 kB          |
| `/incidents/inc-sample-01` | 1,239 ms | 484 ms | 0.011 | 62 ms  | 609 kB          |

- **Ready:** the page's own data is loaded and drawn. Examples: the 1M-row grid, the 2.6M-point
  series, the live feed, the first PDF page.
- **TBT:** main-thread blocking time during the load.

| Interaction                              | Median |
| ---------------------------------------- | ------ |
| Network: trip a line → button responds   | 98 ms  |
| Network: trip a line → study results     | 324 ms |
| Incidents: open a PDF → first page drawn | 540 ms |
| Telemetry: filter 1,076,544 rows by zone | 443 ms |

Lighthouse 12, desktop preset:

| Page         | Performance | Accessibility | Best practices | SEO |
| ------------ | ----------- | ------------- | -------------- | --- |
| `/`          | 100         | 100           | 100            | 100 |
| `/telemetry` | 100         | 100           | 100            | 100 |
| `/incidents` | 99          | 100           | 100            | 100 |
| `/network`   | 88          | 100           | 100            | 100 |

**Found, and fixed:**

- **`/incidents` shipped Tiptap (494 kB) on the list page.** The report's editor and PDF viewer
  now load with `next/dynamic`. The list page went from 471 to 335 kB.
- **`/network` rebuilt all 1,169 graph elements** on every live tick and on every study. Two
  changes fixed this:
  - `reuseUnchanged` keeps the objects that didn't change, and React Flow skips them
  - the 400 nodes use one shared stylesheet instead of per-node styles
- **On `/network`, a trip blocked input until the whole view had re-rendered.** The study now
  renders from a deferred value (`useDeferredValue`), with the graph, the tree and the results
  memoised.

| `/network`                       | Before | After  |
| -------------------------------- | ------ | ------ |
| Lighthouse performance           | 75     | 88     |
| Total blocking time (Lighthouse) | 610 ms | 280 ms |
| Trip a line → button responds    | 668 ms | 98 ms  |

**What remains:** `/network` is still the heaviest page, at about 5,800 DOM elements. On first
render it mounts 400 nodes, 769 edges (each with a wider invisible path for clicking), the
minimap and the tree. The asset tree is the accessible and keyboard path, so the graph stays a
visual layer.

## Demo recording

`yarn demo:record` (`apps/web/e2e-demo/tour.spec.ts`, config `playwright.demo.config.ts`) builds
the app and starts it with the realtime service on their own ports. The simulator runs at 4×
speed with more disturbances, so the alarm feed has something to show within the tour. The tour
drives desktop Chromium at 1440×900 through every module, with captions:

overview → telemetry (sort, group) → charts (7 days, benchmark) → alarms (acknowledge) → map →
network (trip a line) → incidents (PDF search, an @-mention) → dark mode → Spanish.

**Output:**

- `demo/power-grid-operations.webm`: about 80 s and 12 MB, git-ignored. Upload it, for example
  to the GitHub README or YouTube.
- `docs/screenshots/*.jpg`: the README screenshots, committed.

The captions are a box the script adds to the page; they aren't part of the app. Re-run the
tour after UI changes to refresh both the video and the screenshots.

## Release checklist

1. **Merge the M11 PR** into `development` and wait for CI to pass.
2. **Release:** open a PR from `development` into `main` and merge it. The `main` run deploys
   `pgo-realtime`, then `pgo-web` (GitHub → Actions).
3. **Get the URL** in Cloud Shell:

   ```bash
   gcloud run services describe pgo-web --region=us-central1 --project=power-grid-operations --format='value(status.url)'
   ```

   Expected output:

   ```
   https://pgo-web-…-uc.a.run.app
   ```

4. **Smoke check** on the live URL:
   - every sidebar page opens
   - `/alarms` shows **Live** within a few seconds
   - `/storybook` opens
   - `/incidents` lists the three samples
5. **Live-demo link:** send me the URL. I add it to the top of the README, and it goes out in a
   small PR to `development` and then `main`.
6. **Optional, while applications are open:** keep one web instance warm, so a first visit has
   no cold start. It costs a few dollars a month.

   ```bash
   gcloud run services update pgo-web --region=us-central1 --project=power-grid-operations --min-instances=1
   ```

   Expected output:

   ```
   Service [pgo-web] revision [pgo-web-…] has been deployed and is serving 100 percent of traffic.
   ```

   Undo it later with `--min-instances=0`. The budget alert in `docs/deploy.md` stays as it is.

## Verification

```bash
yarn lint && yarn typecheck && yarn coverage && yarn e2e
```

Expected: all green, and coverage at or above each workspace's threshold.

```bash
yarn measure
yarn demo:record
```

Expected:

- `yarn measure`: the measurement tables, and `docs/measurements.json`
- `yarn demo:record`: `demo/power-grid-operations.webm` and `docs/screenshots/*.jpg`
