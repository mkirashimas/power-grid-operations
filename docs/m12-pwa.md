# M12: Progressive Web App

**Branch:** `feature/m12-PWA`, created from `development` and merged back into it, then released
to `main`.

## Goal

Make the console an installable Progressive Web App that stays useful without a connection:

- **Install:** Chrome, Edge and Android offer to install it; iOS adds it from Share → Add to Home
  Screen. It opens in its own window, with a localized name, shortcuts and screenshots.
- **Offline:** pages opened before still load, with their last data. Incident reports work fully,
  because they already live in IndexedDB. Pages never opened show an offline page, not a browser
  error.
- **Honest status:** a banner says when the app is offline, and the live feed says "Offline"
  instead of retrying in a loop.
- **Updates:** a new deploy never reloads an open page by itself. A prompt offers the reload.

## Scope

| #   | Feature                                                                                        | Status    |
| --- | ---------------------------------------------------------------------------------------------- | --------- |
| A   | Web app manifest (`src/app/manifest.ts`)                                                       | done      |
| B   | Manifest in the request language (name, description, shortcuts)                                | done      |
| C   | App shortcuts: Alarms, Map, New incident                                                       | done      |
| D   | Service worker (Serwist, Turbopack integration) with the build output precached                | done      |
| E   | Offline fallback page (`/offline`)                                                             | done      |
| F   | Runtime caching of pages, the asset list and EIA data                                          | done      |
| G   | Offline banner, and a live feed that pauses while offline                                      | done      |
| H   | "New version available – Reload" prompt                                                        | done      |
| I   | Install button in the top bar (Chromium prompt, iOS hint)                                      | done      |
| J   | Install-dialog screenshots, written by the demo tour                                           | done      |
| K   | Map tile caching (OpenFreeMap)                                                                 | follow-up |
| L   | Push notifications for critical alarms (Web Push, VAPID keys, a sender in `services/realtime`) | follow-up |
| M   | Background Sync: nothing to sync while incidents stay local                                    | follow-up |
| N   | Window Controls Overlay (`display_override`)                                                   | follow-up |

## How it works

### Manifest and icons

`src/app/manifest.ts` is served at `/manifest.webmanifest`, and Next.js links it from every page.

- **Language:** browsers fetch the manifest without cookies, so it follows `Accept-Language`, not
  the `lang` cookie.
- **Colours:** `theme_color` and `background_color` come from the `@pgo/ui` palette
  (`background.default`, through `src/pwa/colors.ts`). The page's `theme-color` meta has one
  entry per colour scheme.
- **iOS:** `metadata.appleWebApp` in `src/app/layout.tsx` sets the home-screen title and
  full-screen mode.

| File                                    | Size             | Use                                                         |
| --------------------------------------- | ---------------- | ----------------------------------------------------------- |
| `src/app/icon.svg`                      | vector (100×100) | Favicon in modern browsers                                  |
| `src/app/favicon.ico`                   | 16, 32, 48       | Older browsers, Windows                                     |
| `src/app/apple-icon.png`                | 180×180          | iOS home screen (opaque)                                    |
| `public/icons/icon-192.png`, `-512.png` | 192, 512         | Manifest, `purpose: any`. Also the shortcut icon            |
| `public/icons/icon-maskable-*.png`      | 192, 512         | Manifest, `purpose: maskable` (mark inside the 80 % circle) |
| `public/screenshots/wide.png`           | 1440×900         | Install dialog, desktop                                     |
| `public/screenshots/narrow.png`         | 390×844          | Install dialog, phone                                       |

The screenshots come from the `install screenshots` test in `e2e-demo/tour.spec.ts`. The
manifest states their sizes, so change both together.

### Service worker

`@serwist/turbopack` builds the worker during `next build`, because Next.js 16 builds with
Turbopack and Serwist's webpack plugin doesn't run there.

- **Source:** `src/pwa/sw.ts`, bundled by esbuild.
- **Route:** `src/app/serwist/[path]/route.ts` is static. It serves `/serwist/sw.js`
  (`PATHS.SERVICE_WORKER`) with the precache list injected.
- **Precache:** everything in `.next/static` and `public`, except Storybook, plus `/offline`.
  That is about 53 files and 3.7 MB. `/offline` gets a new revision on every build.
- **Headers:** `next.config.ts` sends `Cache-Control: no-cache` for the worker, so browsers pick
  up a new deploy at once. `withSerwist` keeps esbuild out of the server bundle.
- **Registration:** `useServiceWorker` (`src/pwa`) registers the worker in production builds
  only. In `next dev` it would cache stale code.

**Runtime caching.** `src/pwa/caching.ts` sorts each request into a cache. It is a pure function
with unit tests. `sw.ts` maps each kind to a strategy:

| Kind     | Requests                                                                                                 | Strategy                                  |
| -------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `static` | `/_next/static/*` (hashed build output)                                                                  | Cache first                               |
| `page`   | Full page loads                                                                                          | Network first (10 s), cached copy offline |
| `rsc`    | Client-side navigations (`RSC: 1`)                                                                       | Network first (10 s)                      |
| `assets` | `/api/assets`                                                                                            | Stale-while-revalidate                    |
| `eia`    | `/api/eia/*`                                                                                             | Network first (5 s), last copy offline    |
| `file`   | `/icons`, `/screenshots`, `/samples`                                                                     | Stale-while-revalidate                    |
| none     | Other origins (map tiles, the realtime WebSocket), Storybook, the worker, the manifest, other API routes | Not intercepted                           |

A page load that fails and has no cached copy gets the precached `/offline` page.

### Updates

- The worker uses `skipWaiting: false`, so a new version waits.
- `UpdatePrompt` (`hoc/Pwa.tsx`) shows a Snackbar. **Reload** sends `SKIP_WAITING`, and the
  page reloads once the new worker has taken over.
- The first install uses `clientsClaim`. It controls the open page at once, so the page works
  offline right away.

### Offline UI

- **Banner:** `OfflineBanner` reads `useOnlineStatus` and shows a status `Alert` above the
  content.
- **Live feed** (`store/live/socket.ts`):
  - While `navigator.onLine` is false, a dropped socket reports `offline` and stops retrying.
  - The `offline` event sets that status at once.
  - On `online`, the feed opens a fresh socket at once, which brings a new `hello` snapshot.
  - Alarms and map show this through their existing connection chip.
- **Install button:** `InstallButton` sits next to the theme toggle.
  - In Chromium it captures `beforeinstallprompt` and shows the browser's dialog.
  - In iOS Safari it shows a hint instead.
  - It is hidden when the app runs installed (`display-mode: standalone`).

All strings are in the `common` namespace (`pwa.*`, `offline.*`, `appShortName`) in all five
languages.

## Files

| Area           | Files                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------- |
| Manifest, meta | `src/app/manifest.ts`, `src/app/layout.tsx`, `src/pwa/colors.ts`                              |
| Service worker | `src/pwa/sw.ts`, `src/pwa/caching.ts`, `src/app/serwist/[path]/route.ts`, `next.config.ts`    |
| Offline page   | `src/app/offline/page.tsx`, `PATHS.OFFLINE`                                                   |
| Hooks          | `src/pwa/useServiceWorker.ts`, `src/pwa/useInstallPrompt.ts`, `src/pwa/useOnlineStatus.ts`    |
| UI             | `src/hoc/Pwa.tsx` (install button, offline banner, update prompt), `src/hoc/Layout.tsx`       |
| Live feed      | `src/store/live/socket.ts`                                                                    |
| Assets         | `src/app/icon.svg`, `favicon.ico`, `apple-icon.png`, `public/icons/*`, `public/screenshots/*` |
| Dependencies   | `@serwist/turbopack`, `@serwist/window`, `serwist`, `esbuild`                                 |

## Tests

**Unit (Vitest):**

- `src/pwa/caching.test.ts`: every cache kind, and the requests the worker must leave alone
- `src/pwa/useServiceWorker.test.ts`:
  - registration is skipped in development
  - a waiting update is offered
  - the page reloads only after **Reload**
- `src/pwa/useInstallPrompt.test.ts`: the deferred prompt, `appinstalled`, standalone mode, the
  iOS and iPadOS detection
- `src/pwa/useOnlineStatus.test.ts`
- `src/app/manifest.test.ts`: the manifest in the request language, the icons
- `src/store/live/socket.test.ts`: no retries while offline, a fresh socket on `online`

Coverage of `@pgo/web` went from 52.1 % to 53.4 % (lines). The thresholds in
`apps/web/vitest.config.ts` went up by one point to stay about 2 points below.

**e2e (Playwright, `e2e/pwa.spec.ts`, desktop and mobile).** The worker is on only in this spec.
`playwright.config.ts` blocks it everywhere else, so cached pages can't hide `page.route()`
mocks.

- The manifest in Romanian. Every icon and screenshot returns a PNG of the stated size.
- Every page links the manifest, the Apple touch icon and both theme colours.
- **Offline:**
  - the worker takes control
  - `/incidents` reloads offline with its reports and the banner
  - an unvisited page shows `/offline`
  - the banner goes away when the connection returns
- `/offline` is in `e2e/support/pages.ts`, so the axe, heading, reflow and keyboard sweeps cover
  it.

`yarn measure` and `yarn demo:record` block the worker too: precache downloads would skew the
load numbers.

## Verification

```bash
yarn typecheck
yarn lint
yarn coverage
yarn e2e
```

Then check these by hand on the deployed app:

1. **Chrome DevTools → Application → Manifest:** no installability errors. The icons and
   screenshots show.
2. **Application → Service workers:** `/serwist/sw.js` is activated. Tick **Offline** and reload
   a page you opened: it loads. Open one you didn't: the offline page shows.
3. **Install from the top-bar button** (desktop Chrome or Edge, Android Chrome). The app opens in
   its own window, and the button is gone.
4. **iPhone or iPad:** Safari → Share → Add to Home Screen. Check the "Grid Ops" title and the
   icon.
5. **Long-press the installed icon** (Android) or right-click it (desktop): the three shortcuts
   are there.
6. **Deploy twice:** the open app shows **A new version is available**, and **Reload** switches
   to it.
7. **Maskable icons:** check `public/icons/icon-maskable-512.png` at <https://maskable.app>.

Lighthouse 12 has no PWA category any more, so the DevTools Manifest panel is the check.

## Follow-up commands

```bash
# Re-create the install screenshots after a UI change (also part of yarn demo:record)
yarn workspace @pgo/web playwright test -c playwright.demo.config.ts -g "install screenshots"

# Run the PWA e2e spec on its own
yarn workspace @pgo/web playwright test pwa.spec.ts
```
