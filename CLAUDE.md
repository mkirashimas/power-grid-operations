# Power Grid Operations: project rules

This app **overrides parts of the PHD workspace conventions** (`../CLAUDE.md`). Where this file
and the workspace file disagree, this file wins. Everything not mentioned here (Yarn only, MUI
only, RTK Query for server data, 5 languages in alphabetical order with all keys in every file,
desktop-first responsive styles, theme tokens instead of hardcoded values, named exports,
feature isolation) still applies.

The build plan, milestone by milestone, is in the user's plan file
`~/.claude/plans/this-is-what-i-wild-valley.md`. The current milestone is listed in README.md.

## Differences from the workspace conventions

| Workspace rule                              | This app                                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Vite SPA                                    | **Next.js App Router** in `apps/web`, Yarn workspaces monorepo                                                 |
| Firebase Hosting, Firestore, Google sign-in | **Cloud Run**, data from Next route handlers (`/api/*`) and a WebSocket service. **No auth**: the demo is open |
| `hoc/App.tsx`, `hoc/Routing.tsx`            | `src/app/layout.tsx` + `hoc/Providers.tsx`; routes are the `src/app` folders                                   |
| `store/themeSlice.ts`                       | MUI CSS-variable color schemes: `useColorScheme()` and `InitColorSchemeScript`                                 |
| `store/authSlice.ts`                        | none                                                                                                           |
| `src/firebase/*`                            | none; RTK Query uses `fetchBaseQuery({ baseUrl: '/api' })`                                                     |
| i18n detector (localStorage, navigator)     | `lang` cookie, then `Accept-Language` (`i18n/language.ts`)                                                     |
| Drawer variant via `useMediaQuery`          | two drawers switched with CSS media queries (correct server markup)                                            |

## Rules specific to this app

- **Server vs client components.** Pages are server components by default. Never pass functions
  (an `sx` callback, `component={NextLink}`, event handlers) from a server component to an MUI
  component. Use plain-object `sx`, or move that UI into a `'use client'` component inside the
  feature.
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
- **Cross-feature state** (e.g. linked selection) goes in a slice in `src/store`, never in a
  feature.
- **`PATHS`** in `src/types/paths.ts` holds every link target and must match the `src/app`
  folders. Dynamic routes get builder functions.
- **Tests.** Every page gets a Playwright test with axe checks in light and dark mode. Components
  with behavior get Vitest + Testing Library tests.
- **New workspaces** must be added to the `deps` stage of `apps/web/Dockerfile` when the web app
  depends on them.
- Local Node is 22.14, so dependencies must support it (e.g. jsdom is pinned to 29).
