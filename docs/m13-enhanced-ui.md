# M13: Enhanced UI

**Branch:** `feature/m13-enhanced-ui`, created from `development` and merged back into it.

## Goal

Make each section understandable to people who don't work on power grids, such as a recruiter or a product manager, without getting in the way of people who do.

- **Section help:** a help button at the far right of every section title opens a plain-language explanation of the section, with four parts:
  - _What is this?_
  - _What am I looking at?_
  - _How do I use it?_
  - _Why does it matter?_
  - _Under the hood_: a list of the engineering behind the section, with real numbers from the milestone docs and `docs/measurements.json`
- **Read while you try:** on desktop, the help is a side panel that pushes the page instead of covering it. You can follow "click a line to select it" with the map still in view.
- **Room for the page:** the left sidebar folds down to an icon rail. It does this by itself while help is open, and on demand at any other time.

## Scope

| #   | Feature                                                                                  | Status |
| --- | ---------------------------------------------------------------------------------------- | ------ |
| A   | `PageHeader` in `@pgo/ui`: `h1`, badge, intro, and an action pinned to the far right     | done   |
| B   | `HelpPanel` in `@pgo/ui`: a docked side panel (desktop) or a modal bottom sheet (phones) | done   |
| C   | Help button on all 7 sections, with content in 5 languages                               | done   |
| D   | Collapsible sidebar: a 240 px list or an icon rail with tooltips                         | done   |
| E   | The help panel folds the sidebar, and closing it restores the user's choice              | done   |
| F   | The sidebar choice is kept in a cookie, so the server renders the right width            | done   |
| G   | "Under the hood" list in every help panel: tech details and measured numbers             | done   |

## How it works

### Help panel

- `HelpButton` (`src/shell/HelpButton.tsx`) sits in each page's `PageHeader` `action`.
  - It dispatches `openHelp` / `closeHelp`.
  - It sets `aria-expanded`, and `aria-controls` while the panel is open.
- `hoc/Layout.tsx` renders `SectionHelp` as a sibling of `<main>`.
  - It finds the current section from `NAV_ITEMS` and builds the panel from `common` keys: `help.headings.<block>` and `help.sections.<section>.<block>`.
  - The last block, `help.sections.<section>.tech`, is a string array, read with `returnObjects` and shown as a bulleted list (`HelpSection.items`). Every language has the same number of items, which `locales.test.ts` checks.
  - When you navigate with the panel open, it stays open and shows the new section's help.
- **Desktop (`md` and up):** a persistent right `Drawer`, 360 px wide. Its docked width animates from 0, so `<main>` shrinks to make room.
  - It is an `<aside>` landmark named by its heading.
  - On open, focus moves to the heading.
  - **Esc** or ✕ closes it, and focus goes back to the button that opened it.
  - When closed, its content is unmounted, so no hidden headings stay in the page outline.
- **Phones (below `md`):** a temporary bottom `Drawer` (a sheet), at most 80 % of the viewport height. It is modal and labelled by its heading, and MUI handles focus.
  - `useMediaQuery` picks the variant. That is safe for server rendering, because the panel is always closed in the server markup.
- **Where the text lives:** in the `common` namespace, not in each feature's own namespace.
  - The panel belongs to the app shell, next to the `nav.*` labels.
  - This way the shell never reads a feature's namespace, and features stay isolated.

### Sidebar

- `store/shellSlice.ts` keeps three values:
  - `helpOpen`
  - `sidebarCollapsed`, the user's own choice
  - `collapsedForHelp`, set when opening help folded a full sidebar
- `selectSidebarRail` = `sidebarCollapsed || collapsedForHelp`. Closing help clears `collapsedForHelp`, so the user's choice comes back.
- **Expanding while help is open** clears both values. The sidebar then stays expanded after help closes.
- **Rail mode:** the drawer is `theme.spacing(9)` wide. Each item keeps its icon, and gets an `aria-label` plus a right-side tooltip with the section name.
- **Persistence:** the `sidebar` cookie (`collapsed` / `expanded`) is written whenever the choice changes (`src/shell/sidebar.ts`).
  - `app/layout.tsx` reads it and passes it to `Providers`, which preloads the store.
  - So the first server render already has the right width, and nothing jumps.
- **Phones:** the temporary drawer opened from the menu button is unchanged.
- **Motion:** widths animate with `theme.transitions`. The global reduced-motion rule in `@pgo/ui` switches the animation off.
- **Resizing:** MapLibre, React Flow, `TimeSeriesPane` and `VirtualGrid` already follow their container with a ResizeObserver, so no feature needed changes.

### `src/shell`

`src/shell` is a new cross-cutting folder, like `src/pwa`.

- It holds shell controls that features may use: `HelpButton` and the sidebar cookie helpers.
- Features can't import `hoc/`, which is why these live here.
- `store/shellSlice.ts` is a static slice in `combineSlices`. That lets the server preload it; lazy injection wouldn't.

## Files

| Area    | Files                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------- |
| Library | `packages/ui/src/components/PageHeader/*`, `packages/ui/src/components/HelpPanel/*`, `packages/ui/src/index.ts` |
| Shell   | `src/hoc/Layout.tsx`, `src/hoc/Providers.tsx`, `src/app/layout.tsx`, `src/shell/*`                              |
| State   | `src/store/shellSlice.ts`, `src/store/index.ts` (`makeStore(preloadedState)`)                                   |
| Pages   | `src/features/*/components/*Page.tsx` (all 7 use `PageHeader` + `HelpButton`)                                   |
| Text    | `src/i18n/locales/{en,es,fr,it,ro}/common.json` (`help.*`, `sidebar.*`)                                         |

## Tests

**Unit (Vitest):**

- `packages/ui/src/components/display.test.tsx`, `PageHeader`: the `h1`, badge, action, intro, plus an axe scan.
- `packages/ui/src/components/interactive.test.tsx`, `HelpPanel`:
  - side: heading focus, **Esc** closes, focus returns to the opener
  - sheet: a named dialog that the close button dismisses
  - an axe scan for each variant
- `src/store/shell.test.ts`:
  - help folds the sidebar and restores it on close
  - a collapsed choice survives help
  - expanding during help sticks
  - toggling works
- `src/hoc/Layout.test.tsx`:
  - the rail and its cookie
  - a preloaded collapsed state
  - the help panel with `aria-controls`, Esc and focus return
- `src/i18n/locales.test.ts` fails if a `help.*` key is missing in any language.

**e2e (Playwright, `e2e/help.spec.ts`):**

- **Desktop, 1280 px:**
  - help on Map folds the sidebar, and the map canvas ends where the panel starts
  - no horizontal scroll, and an axe scan with the panel open
  - **Esc** closes the panel, returns focus to the button and restores the sidebar
- **Desktop:** the panel follows navigation from Map to Network.
- **Desktop:** a collapsed sidebar is already in the server HTML, and survives a reload.
- **Mobile:** the bottom sheet opens and closes, with no horizontal scroll.
- The Storybook axe sweep covers the new `PageHeader` and `HelpPanel` stories in both color schemes.

## Verification

```bash
yarn typecheck
yarn lint
yarn test
yarn e2e
```

Then check by hand with `yarn dev`:

1. On each of the 7 sections, click **About this section**. The text matches the page, in all 5 languages.
2. Collapse the sidebar, then reload. It stays collapsed, with no jump.
3. Open help with the sidebar expanded, then close it. The sidebar comes back. Do the same with it collapsed: it stays collapsed.
4. On a phone-sized window, help opens as a bottom sheet.
5. Check both themes.

## Demo tour

`e2e-demo/tour.spec.ts` opens the help panel on Network (sidebar folded, _Under the hood_
visible), takes `docs/screenshots/help.jpg`, and closes it with Escape. The tour was also
shortened to about 60 s (2 s caption holds, no benchmark run) so the MP4 fits GitHub's 10 MB
upload limit; see [M11](m11-finish.md).

## Follow-up commands

```bash
# Run the help e2e spec on its own
yarn workspace @pgo/web playwright test help.spec.ts
```
