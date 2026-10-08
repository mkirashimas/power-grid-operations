# Power Grid Operations

An operations console for the Texas (ERCOT) power grid. It shows how a data-heavy, real-time
frontend for the energy industry can be built: large data grids, advanced charts, graph views,
maps, a document viewer with rich text, live updates, Rust/WASM number crunching, and an
accessible, tested component library.

## Product scope

One app, a grid operations console:

| Module            | What it does                                                                |
| ----------------- | --------------------------------------------------------------------------- |
| Telemetry table   | 1M+ rows with virtual scrolling, sort, filter and grouping                  |
| Chart workbench   | Forecast vs actual, with zoom, brush and synced crosshairs                  |
| WASM downsampling | Rust compiled to WASM, run in a Web Worker, with a JS vs WASM timing toggle |
| Alarm feed        | Live stream that updates the map, table and charts                          |
| Live map          | Assets coloured by load, updated in real time                               |
| Network view      | Asset tree, topology canvas and a "what if" node editor                     |
| Incident reports  | PDF viewer with rich-text notes that link to assets                         |

Across every module:

- **Linked selection:** click an asset anywhere and every view follows.
- **Shared component library:** accessible and tested.

## Stack

| Concern        | Choice                                                                         |
| -------------- | ------------------------------------------------------------------------------ |
| Framework      | Next.js (App Router, server and client components), React, TypeScript (strict) |
| UI             | Material UI with a CSS-variable theme (light and dark)                         |
| State and data | Redux Toolkit + RTK Query                                                      |
| i18n           | i18next, in English, Spanish, French, Italian and Romanian                     |
| Compute        | Rust compiled to WebAssembly                                                   |
| Map            | MapLibre GL with OpenFreeMap tiles (no API key)                                |
| Tests          | Vitest + Testing Library, Playwright + axe                                     |
| Hosting        | Google Cloud Run: the web app and a small real-time service                    |
| Tooling        | Yarn workspaces, ESLint, Prettier, GitHub Actions                              |

All other UI libraries are open source and need no API keys.

## Data

**Source:** the [U.S. Energy Information Administration (EIA)](https://www.eia.gov/opendata/)
API, for the ERCOT balancing authority. It provides hourly demand, demand forecast, generation
by fuel, and interchange.

**Synthetic data:** generated data is added on top for scale, e.g. grid assets and
high-frequency telemetry. It is always labelled **synthetic** and is never presented as EIA
data.

**EIA terms:**

- Source credited as "U.S. Energy Information Administration".
- No EIA logo.
- No implied endorsement by EIA.

**API key:** the EIA API is called server-side only. The key never reaches the browser.

## Repository layout

```
apps/web/          Next.js app
  src/app/         routes (layouts, pages, route handlers)
  src/hoc/         app shell: Providers (Redux, theme, i18n) and Layout
  src/features/    self-contained feature modules
  src/i18n/        i18next setup, server and client
  src/store/       Redux store and the base RTK Query api
  src/theme/       MUI theme: palettes, typography, component overrides
  src/types/       app-wide types and PATHS
  e2e/             Playwright tests
docs/              deployment guide
```

## Getting started

Requires Node 22+ and Yarn 1.

```bash
yarn install
yarn dev          # http://localhost:3000
```

| Command                        | What it does                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| `yarn build` / `yarn start`    | production build and server                                                        |
| `yarn lint` / `yarn typecheck` | ESLint / TypeScript                                                                |
| `yarn test`                    | unit and component tests (Vitest)                                                  |
| `yarn e2e`                     | builds, starts and runs the Playwright tests (desktop and mobile, with axe checks) |
| `yarn format`                  | Prettier                                                                           |

Run `yarn workspace @pgo/web playwright install chromium` once before the first `yarn e2e`.

## Secrets

| Where          | What                                                     |
| -------------- | -------------------------------------------------------- |
| `.env.local`   | local secrets such as `EIA_API_KEY` (git-ignored)        |
| `.env.example` | committed template listing the variable names, no values |
| Secret Manager | production values, mounted into Cloud Run                |

The GCP identifiers below are not secrets. GitHub signs in to Google Cloud with Workload
Identity Federation, so no service-account key exists anywhere.

## Branches and CI/CD

| Branch        | Role                | On push                                   |
| ------------- | ------------------- | ----------------------------------------- |
| `development` | default, daily work | lint, typecheck, unit tests, build, e2e   |
| `main`        | release             | the same checks, then deploy to Cloud Run |

Pull requests run the checks only. The workflow is `.github/workflows/ci.yml`. Cloud Run
scales to zero (minimum instances = 0), so the first visit after an idle period can take a few
seconds.

## Infrastructure

| Item                         | Value                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| GCP / Firebase project ID    | `power-grid-operations`                                                                     |
| GCP project number           | `142186164859`                                                                              |
| Cloud Run region             | `us-central1`                                                                               |
| Cloud Run service (web)      | `pgo-web`                                                                                   |
| Artifact Registry repository | `web` (Docker, `us-central1`)                                                               |
| Deploy service account       | `deployer@power-grid-operations.iam.gserviceaccount.com`                                    |
| Deploy account roles         | `run.admin`, `artifactregistry.writer`, `iam.serviceAccountUser`                            |
| Workload identity provider   | `projects/142186164859/locations/global/workloadIdentityPools/github/providers/github-repo` |
| Provider limited to          | `mkirashimas/power-grid-operations`                                                         |

GitHub repository **variables**, read as `vars.*` in the workflow. They are variables, not
secrets.

| Variable                         | Value                                                    |
| -------------------------------- | -------------------------------------------------------- |
| `GCP_PROJECT_ID`                 | `power-grid-operations`                                  |
| `GCP_REGION`                     | `us-central1`                                            |
| `GCP_SERVICE_ACCOUNT`            | `deployer@power-grid-operations.iam.gserviceaccount.com` |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | the provider path above                                  |

A Firestore database `(default)` (location `eur3`) exists in the project but the app does not
use it. See [docs/deploy.md](docs/deploy.md) for the deployment setup.

## Design decisions

- **Language without flicker.** The chosen language is stored in a cookie, so the server
  renders the right language on the first request. On a first visit it falls back to the
  browser's `Accept-Language`. Server components translate with a per-request i18next instance;
  client components share one instance in the browser.
- **Light and dark without flicker.** Both color schemes are compiled into one CSS-variable
  theme, and MUI's `InitColorSchemeScript` applies the stored or system scheme before the first
  paint.
- **Responsive markup decided by CSS.** The sidebar switches between permanent (desktop) and
  temporary (mobile) with media queries rather than `useMediaQuery`, so the server-rendered
  HTML is already right for the viewport.
- **Accessibility checked in CI.** Every Playwright page test runs axe (WCAG 2.1 AA) in both
  color schemes. The shell has a skip link, labelled landmarks and `aria-current` navigation.
- **Open demo.** There is no sign-in. All data is public or synthetic.
