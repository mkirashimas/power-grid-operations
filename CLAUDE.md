# Power Grid Operations: project rules

This app **overrides parts of the PHD workspace conventions** (`../CLAUDE.md`). Where this file
and the workspace file disagree, this file wins. Everything not mentioned here (Yarn only, MUI
only, RTK Query for server data, 5 languages in alphabetical order with all keys in every file,
desktop-first responsive styles, theme tokens instead of hardcoded values, named exports,
feature isolation) still applies.

The build plan, milestone by milestone, is in the user's plan file
`~/.claude/plans/this-is-what-i-wild-valley.md`. README.md describes the product and setup only,
not the roadmap.

## Workflow

- **Branches:** the user creates `feature/m<N>` from `development` and merges PRs into it.
  - Releases merge `development` into `main`, which deploys.
  - Claude works on the current feature branch and never creates branches, commits or pushes.
- **Milestone docs:** each milestone starts with its own doc in `docs/`, e.g.
  `docs/m1-data-and-shared-types.md`.
  - The doc covers goal, scope, files, tests, verification and the user's follow-up commands.
  - Link it from the README's "Milestone docs" list.

## Differences from the workspace conventions

| Workspace rule                              | This app                                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Vite SPA                                    | **Next.js App Router** in `apps/web`, Yarn workspaces monorepo                                                 |
| Firebase Hosting, Firestore, Google sign-in | **Cloud Run**, data from Next route handlers (`/api/*`) and a WebSocket service. **No auth**: the demo is open |
| `hoc/App.tsx`, `hoc/Routing.tsx`            | `src/app/layout.tsx` + `hoc/Providers.tsx`; routes are the `src/app` folders                                   |
| `store/themeSlice.ts`                       | MUI CSS-variable color schemes: `useColorScheme()` and `InitColorSchemeScript`                                 |
| `store/authSlice.ts`                        | none                                                                                                           |
| `src/firebase/*`                            | none; RTK Query uses `fetchBaseQuery({ baseUrl: '/api' })`, plus a WebSocket for live data                     |
| i18n detector (localStorage, navigator)     | `lang` cookie, then `Accept-Language` (`i18n/language.ts`)                                                     |
| Drawer variant via `useMediaQuery`          | two drawers switched with CSS media queries (correct server markup)                                            |

## Rules specific to this app

- **Server vs client components.** Pages are server components by default. Never pass functions
  (an `sx` callback, `component={NextLink}`, event handlers) from a server component to an MUI
  component. Use plain-object `sx`, or move that UI into a `'use client'` component inside the
  feature. Library components that pass a React element to an MUI prop (`icon`, `avatar`,
  `startIcon`, …) must be `'use client'`: across the RSC boundary the element can reach SSR as a
  lazy reference, MUI's `isValidElement` check drops it, and hydration fails.
- **Design system:** `packages/ui` (`@pgo/ui`) owns the MUI theme (`src/theme`) and the shared
  components. `apps/web/src/theme` only adds the MUI locales.
  - Check `@pgo/ui` before building UI in a feature. Add generic, reusable pieces there
    (with a story and tests), not in a feature.
  - Library components hold no translations: they take translated strings as props.
  - Every story must pass axe in light and dark mode (`e2e/storybook-a11y.spec.ts`).
  - Colours come from palette tokens. New tokens get a check in `src/theme/contrast.test.ts`.
  - The `index.ts` barrel uses named exports only, because Next.js cannot follow `export *` into
    `'use client'` modules.
- **MUI 9 icon names** end in `Outlined` (e.g. `ErrorOutlined`, not `ErrorOutline`).
- **Theme overrides** use `(theme.vars || theme).palette.*`, so one stylesheet serves both
  schemes. In `sx`, prefer token strings (`'text.secondary'`, `bgcolor: 'background.paper'`),
  and `theme.applyStyles('dark', {...})` for dark-only styles.
- **Translations.** Each feature has `i18n.ts`, which calls `registerNamespace` and exports
  `<FEATURE>_NAMESPACE`. Components import the namespace from there so the registration always
  runs. Server components use `await getServerTranslation(NS)` from `i18n/server.ts`; client
  components use `useTranslation(NS)`. `src/i18n/locales.test.ts` fails when a key is missing
  in any language.
- **Icons:** import one per file (`@mui/icons-material/HomeOutlined`), never from the package
  index.
- **Feature slices** inject themselves with `slice.injectInto(rootReducer)` and augment
  `LazyLoadedSlices` in `src/store` (see `features/telemetry/slice.ts`). The store never
  imports features.
- **Heavy data work** runs in a Web Worker inside the feature (`features/<f>/worker`).
  - The query logic stays in pure, Node-tested functions (`engine/`).
  - Results cross the boundary as transferable typed arrays.
- **Shareable view state** is mirrored to the URL with `window.history.replaceState` (no
  server round trip), not `router.replace`.
- **Charts** use `ChartWorkbench` + `TimeSeriesPane` from `@pgo/ui`.
  - Series colours come from `palette.chart.series1..6` (≥ 3:1, checked by the contrast test).
  - Canvas code resolves theme CSS variables to concrete colours (`charts/canvas.ts`) and redraws when
    the scheme changes.
  - Every pane needs a translated `summarize` for its `role="img"` label.
  - Long series are downsampled off the main thread: pass the pane a `downsample` function
    (`PaneDownsampler`) backed by a feature worker, as `features/charts` does.
- **Rust/WASM** lives in `packages/downsample` (`@pgo/downsample`).
  - `rust/` is the crate. `pkg/` is its `wasm-pack` output and is **committed**, so `yarn dev`,
    the Docker build and the main CI job need no Rust.
  - After changing Rust code, run `yarn wasm:build` and commit `pkg/` with the change.
    `yarn wasm:test` runs `cargo fmt --check`, `clippy -D warnings` and `cargo test`. CI's
    `rust` job rebuilds the module and runs the parity test against the fresh build.
  - Each algorithm exists in TypeScript and in Rust, with the same operations in the same order.
    `src/parity.test.ts` checks that both return identical points.
  - Import the loader (`@pgo/downsample/wasm`) only in workers. The main entry stays WASM-free,
    because `@pgo/ui` imports it.
  - WASM loading can fail: fall back to JS and say so in the UI.
  - Toolchain: rustup stable with `wasm32-unknown-unknown` (`rust-toolchain.toml`), wasm-pack 0.15.
- **Large tables** use `VirtualGrid` from `@pgo/ui`. It handles millions of rows (scaled
  scrolling) and the ARIA grid keyboard pattern.
- **Real-time data** comes from `services/realtime` (`@pgo/realtime`, Cloud Run `pgo-realtime`).
  - The simulator (`live.ts`) and the message types (`live-protocol.ts`) live in
    `@pgo/grid-model`, shared by the service and the app. Change the protocol there, never in
    one side only.
  - The app reads it through an RTK Query streaming endpoint: `queryFn` returns an empty state,
    `onCacheEntryAdded` opens the socket, and a pure `applyMessage` folds messages into the
    cache (see `features/alarms`). Components use the query hook, not the socket.
  - The page gets the URL from `getRealtimeUrl()` (`src/server/realtime.ts`, env `REALTIME_URL`,
    read per request), never from a `NEXT_PUBLIC_` variable.
  - The service validates every client message (`parseClientMessage`), keeps `maxPayload` small
    and rate-limits acks. It holds no secrets.
  - The service runs its TypeScript with `node --experimental-strip-types` (no build). Its image
    is `services/realtime/Dockerfile`; e2e starts it from `playwright.config.ts`.
- **Cross-feature state** (e.g. linked selection) goes in a slice in `src/store`, never in a
  feature.
- **`PATHS`** in `src/types/paths.ts` holds every link target and must match the `src/app`
  folders. Dynamic routes get builder functions.
- **Tests.** Every page gets a Playwright test with axe checks in light and dark mode. Components
  with behavior get Vitest + Testing Library tests.
- **Server-only code** (data access, secrets) lives in `apps/web/src/server` and imports
  `server-only`. It is infrastructure, like `store/`; features call it from server
  components and route handlers.
- **Workspace packages** (`packages/*`) ship TypeScript source, compiled by Next.js through
  `transpilePackages`.
  - Relative imports inside them keep the `.ts` extension, so Node can run their scripts with
    `--experimental-strip-types`.
  - The packages use erasable syntax only: no enums, no namespaces.
- **New workspaces** must be added to the `deps` stage of `apps/web/Dockerfile` when the web app
  depends on them.
- Local Node is 22.14, so dependencies must support it (e.g. jsdom is pinned to 29).
- Unused variables are an ESLint error, not a tsc option, so the generated `.next/dev/types`
  files type-check.

## Infrastructure

- GCP project `power-grid-operations` (number `142186164859`), region **`us-central1`**.
- The workflow deploys `main` to two Cloud Run services:
  - `pgo-realtime`, first: image `.../web/pgo-realtime:<sha>`, `--max-instances 1`,
    `--timeout 3600`
  - `pgo-web`: image `us-central1-docker.pkg.dev/power-grid-operations/web/pgo-web:<sha>`,
    with `REALTIME_URL` set to the realtime service's `wss://` URL
- The workflow reads the GitHub repository variables `GCP_PROJECT_ID`, `GCP_REGION`,
  `GCP_SERVICE_ACCOUNT` and `GCP_WORKLOAD_IDENTITY_PROVIDER` as `vars.*`. They are variables, not
  secrets.
- `docs/deploy.md` is the setup record. Keep it, README.md and `ci.yml` in sync.
- A Firestore database exists in the project but is **not used**.

## Secrets and data terms

- **Secrets:**
  - Local secrets go in `apps/web/.env.local`, which is git-ignored. Next.js reads env files only
    from `apps/web`.
  - Every new variable name goes in the committed `apps/web/.env.example`.
  - Production values go in Secret Manager, mounted with `--set-secrets`.
  - Never commit keys, and never expose them to the browser (no `NEXT_PUBLIC_` secrets).
- **EIA API:** call it server-side only (route handlers, scripts, server components).
- **EIA terms:**
  - Credit "U.S. Energy Information Administration" wherever EIA data is shown.
  - Never use the EIA logo, and never imply endorsement.
  - Label generated data **synthetic** in the UI and docs, and never present it as EIA data.
- **Map:** OpenFreeMap tiles need no key, but the attribution must stay visible.
