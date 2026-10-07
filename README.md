# Power Grid Operations

An operations console for the Texas (ERCOT) power grid. It is built to show how a data-heavy,
real-time frontend can be put together: large virtualized tables, synced charts, Rust/WASM
number crunching, live updates and accessible components.

> **Status:** foundation (M0). The app shell, theming, i18n, tests and CI are in place. Feature
> modules arrive one milestone at a time.

## Stack

| Concern        | Choice                                                                         |
| -------------- | ------------------------------------------------------------------------------ |
| Framework      | Next.js (App Router, server and client components), React, TypeScript (strict) |
| UI             | Material UI with a CSS-variable theme (light and dark)                         |
| State and data | Redux Toolkit + RTK Query                                                      |
| i18n           | i18next, in English, Spanish, French, Italian and Romanian                     |
| Tests          | Vitest + Testing Library, Playwright + axe                                     |
| Hosting        | Google Cloud Run (standalone Next.js container)                                |
| Tooling        | Yarn workspaces, ESLint, Prettier, GitHub Actions                              |

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

Planned workspaces: `packages/ui` (component library), `packages/grid-model` (shared types and
data generator), `services/realtime` (WebSocket service) and `crates/downsample` (Rust → WASM).

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

## Deployment

See [docs/deploy.md](docs/deploy.md). CI deploys `main` to Cloud Run once the GCP variables are
configured.
