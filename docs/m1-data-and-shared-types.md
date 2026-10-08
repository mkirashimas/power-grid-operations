# M1: Data and shared types

**Branch:** `feature/m1`, created from `development` and merged back into it.

## Goal

Real ERCOT grid data from the U.S. Energy Information Administration (EIA), plus synthetic grid
data for scale, behind typed and tested modules. The overview page shows live ERCOT demand
against the day-ahead forecast and credits EIA as the source.

## Scope

### 1. `packages/grid-model` (new workspace `@pgo/grid-model`)

Shared types, the EIA client and the synthetic data generator. It is TypeScript source, and the
web app compiles it through `transpilePackages`.

| File                       | Contents                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/types.ts`             | `WeatherZone`, `Asset`, `HourlyPoint`, `EiaSeries`, `EiaSnapshot`, `TelemetryColumns`                 |
| `src/zones.ts`             | ERCOT's 8 weather zones: approximate bounding boxes and load shares                                   |
| `src/random.ts`            | seeded PRNG (mulberry32), so every build produces identical synthetic data                            |
| `src/assets.ts`            | `generateAssets(seed)`: about 2,000 substations, lines, generators and loads in one connected network |
| `src/telemetry.ts`         | `generateTelemetry(assets, demand, window)`: 1M+ rows as columnar typed arrays                        |
| `src/eia.ts`               | EIA v2 URL builder, paginated fetch, and pure parsers for region and fuel-type rows                   |
| `src/synthetic.ts`         | `SYNTHETIC_LABEL` and source metadata, so generated data is always labelled                           |
| `scripts/fetch-eia.ts`     | `yarn data:fetch`: downloads the last 30 days and writes the snapshot                                 |
| `data/ercot-snapshot.json` | committed EIA snapshot, used when there is no API key or EIA is unreachable                           |

**Telemetry layout:**

- Columns: `assetIndex` (Uint16), `timestamp` (Float64, epoch ms), `mw`, `loadingPct`,
  `voltagePu` (Float32).
- Rows are ordered by asset, then time, so one asset's series is a contiguous slice.
- About 1,850 assets × 15-minute steps × 6 days ≈ 1.07M rows (≈ 23 MB).

**How the synthetic values are shaped:**

- Load follows the real EIA hourly ERCOT demand, scaled by zone share, with noise.
- Generators follow their fuel:
  - solar follows daylight
  - wind follows a smooth random walk
  - gas follows load
  - nuclear and coal run flat
  - batteries charge midday and discharge in the evening
- Line loading follows the system load.

### 2. EIA data

- API: `https://api.eia.gov/v2/electricity/rto/`, hourly, respondent `ERCO`.
  - `region-data`: `D` demand, `DF` day-ahead demand forecast, `NG` net generation, `TI` total
    interchange.
  - `fuel-type-data`: net generation by fuel.
- Values are MWh per hour, which equals the hour's average MW. Periods are UTC hours.
- Pages hold up to 5,000 rows and are fetched with `offset`.
- **Terms:**
  - Credit "U.S. Energy Information Administration".
  - No EIA logo, and no implied endorsement.
  - Generated data is labelled **synthetic** and is never presented as EIA data.

### 3. Web app

- `src/server/eia.ts` (server-only): `getErcotData()`.
  - **With `EIA_API_KEY`:** fetches the last 30 days live, cached for one hour
    (`next.revalidate`).
  - **Without the key, or on error:** falls back to the committed snapshot.
  - Returns `{ live, snapshot }`.
- Route handlers:
  - `GET /api/eia/ercot` returns the EIA series.
  - `GET /api/assets` returns the synthetic assets, labelled synthetic.
- Overview page (server component):
  - KPI cards: latest demand, day-ahead forecast for the same hour, forecast error and net
    interchange.
  - The EIA credit, and live/snapshot status.
  - The grid model counts with a **Synthetic** chip.
- The telemetry endpoint (Arrow) arrives with the telemetry table in M3.

### 4. Production key

- **Production:** the key lives in Secret Manager as `eia-api-key`.
- **CI:** mounts the secret only when the repository variable `EIA_SECRET_NAME` is set, so
  deploys keep working before the secret exists.
- **Without the secret:** the live site serves the snapshot.

## Files changed outside the new package

- `package.json`: workspace-wide `lint`, `typecheck` and `test`, plus `data:fetch`.
- `apps/web/next.config.ts` (`transpilePackages`) and `apps/web/Dockerfile` (deps stage).
- `apps/web/tsconfig.json` (`allowImportingTsExtensions`, so `.ts` import paths work in the
  package).
- `.github/workflows/ci.yml` (optional `--set-secrets`).
- README, `CLAUDE.md`, `docs/deploy.md`.

## Tests

- **grid-model:**
  - same seed gives identical output
  - asset counts per kind
  - every line connects existing substations, and the network is connected
  - telemetry row count and value ranges
  - total load follows the EIA demand shape (correlation > 0.95)
  - EIA parsers against a fixture
- **web:**
  - KPI selection picks the latest hour that has both demand and forecast
  - `getErcotData` falls back to the snapshot without a key or when the fetch fails
- **e2e:** the overview shows the KPI cards, the EIA credit and the Synthetic chip, with axe
  checks in light and dark mode.

## Verification

```bash
yarn data:fetch
```

Expected output: `Wrote packages/grid-model/data/ercot-snapshot.json`, followed by about 720
hourly points per series.

```bash
yarn lint && yarn typecheck && yarn test && yarn e2e
```

Expected: all green.

```bash
yarn dev
```

Expected: http://localhost:3000 shows real ERCOT numbers marked "Live". If you rename
`apps/web/.env.local`, it shows "Snapshot" with the snapshot date.

## Manual setup after development

Do these steps once, in this order, after `feature/m1` is merged into `development`.

### 1. Store the EIA key in Secret Manager

Open Cloud Shell (https://shell.cloud.google.com). The prompt should end in
`(power-grid-operations)$`.

```bash
read -rs -p "EIA API key: " EIA_KEY && echo
```

Paste the key when prompted. Nothing shows while you type, and it doesn't go into the shell
history.

```bash
printf '%s' "$EIA_KEY" | gcloud secrets create eia-api-key --data-file=- --replication-policy=automatic --project=power-grid-operations
unset EIA_KEY
```

Expected output:

```text
Created version [1] of the secret [eia-api-key].
```

### 2. Let Cloud Run read the secret

```bash
gcloud secrets add-iam-policy-binding eia-api-key --member=serviceAccount:142186164859-compute@developer.gserviceaccount.com --role=roles/secretmanager.secretAccessor --project=power-grid-operations
```

Expected output, beginning with:

```text
Updated IAM policy for secret [eia-api-key].
```

### 3. Tell CI to mount the secret

1. Open https://github.com/mkirashimas/power-grid-operations/settings/variables/actions.
2. Click **New repository variable**.
3. Name = `EIA_SECRET_NAME`, Value = `eia-api-key`.
4. Save. This must be a **variable**, not a secret.

### 4. Release to `main`

Pull request runs only do the checks. Only a push to `main` deploys. Merge the
`development` → `main` PR on GitHub, or run:

```bash
git checkout main
git pull
git merge development
git push origin main
git checkout development
```

Then go to Actions → CI → the new `main` run (event: **push**) and wait until **Deploy web to
Cloud Run** is green, which takes about 5 minutes.

### 5. Check it worked (Cloud Shell)

```bash
gcloud run services describe pgo-web --region=us-central1 --project=power-grid-operations --format='value(spec.template.spec.containers[0].env)'
```

Expected output: one line that contains `EIA_API_KEY` and `eia-api-key`.

```bash
gcloud run services describe pgo-web --region=us-central1 --project=power-grid-operations --format='value(status.url)'
```

Expected output: `https://pgo-web-…run.app`. Open it. The line under the ERCOT cards ends with
**"live, refreshed hourly"**.

### Troubleshooting

| Symptom                                           | Cause and fix                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 5 prints an empty line                       | The M1 deploy has not run. Check that `main` contains M1 and that the `main` **push** run finished. Re-running a PR run never deploys.                              |
| Step 5 is empty after a green deploy              | `EIA_SECRET_NAME` is missing or misspelled. Fix it, then re-run the latest `main` push run.                                                                         |
| `ALREADY_EXISTS` in step 1                        | The secret already exists. Add a version instead: `printf '%s' "$EIA_KEY" \| gcloud secrets versions add eia-api-key --data-file=- --project=power-grid-operations` |
| Deploy job: `Permission denied on secret`         | Step 2 is missing. Run it, then re-run the job.                                                                                                                     |
| Site still says "snapshot of …"                   | The deploy ran before step 3. Re-run the latest `main` push run.                                                                                                    |
| `gcloud secrets list` does not show `eia-api-key` | Step 1 did not complete. Run it again.                                                                                                                              |

These steps are also in `docs/deploy.md` under "EIA API key".
