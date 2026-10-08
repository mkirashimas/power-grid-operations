# M2: Component library

**Branch:** `feature/m2`, created from `development` and merged back into it.

## Goal

`@pgo/ui`: an accessible, tested component library on Material UI that owns the app's theme. It
is documented in Storybook, which runs locally and is published with the live demo at
`/storybook`. The web app builds its UI from it.

## Scope

### 1. `packages/ui` (new workspace `@pgo/ui`)

- **Source:** TypeScript/TSX, compiled by Next.js through `transpilePackages`. Relative imports
  keep their extension, and the code uses erasable syntax only.
- **Theme:** moves here from `apps/web/src/theme` (`src/theme/`), because the design system
  owns it: palettes, typography, shape, component overrides, type augmentation and
  `createAppTheme(locale)`. The web app keeps only `MUI_LOCALES` and re-exports
  `createAppTheme`.
- **New palette tokens:** `status.normal`, `status.warning`, `status.alarm` and
  `status.offline`, in both colour schemes. They meet WCAG AA (4.5:1) against
  `background.paper`, and a unit test checks this.
- **Feedback colours:** `error`, `warning`, `success` and `info` are set to AA-safe
  values (MUI's defaults fail on these surfaces).

| Component                       | Purpose                                 | Accessibility                                                    |
| ------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| `IconButton`                    | icon button with a tooltip              | required `label`, used as both `aria-label` and the tooltip text |
| `Panel`                         | titled section with an actions slot     | `section` + `aria-labelledby`; configurable heading level        |
| `StatCard`                      | label, value, caption                   | the label is a heading                                           |
| `StatusChip`                    | normal / warning / alarm / offline      | icon and text, never colour alone                                |
| `SyntheticBadge`                | marks generated data                    | visible text label                                               |
| `SourceNote`                    | "Source: _name_ · _status_" with a link | a real link; external links get `rel="noopener noreferrer"`      |
| `Toolbar`                       | groups related controls                 | `role="toolbar"` with `aria-label`                               |
| `FilterField`                   | search input with a clear button        | labelled input and a labelled clear button                       |
| `SegmentedControl`              | exclusive choice, e.g. JS vs WASM       | `aria-label` on the group, `aria-pressed` on each option         |
| `ConfirmDialog`                 | confirm or cancel an action             | focus trap, Escape cancels, labelled by its title                |
| `EmptyState`                    | icon, title, body, optional action      | the title is a heading                                           |
| `LiveAnnouncer` / `useAnnounce` | announces messages to screen readers    | `aria-live` polite or assertive                                  |
| `VisuallyHidden`                | text for screen readers only            | n/a                                                              |

**Rules:**

- Components contain no translations. All text comes in through props, so the library stays
  language-agnostic.
- Colours, spacing and type come only from theme tokens.
- `'use client'` appears only in components that use hooks or event handlers, so server
  components can render the rest.

**Foundations stories:** the themed MUI components the app uses directly (Button, TextField,
Select, Tabs, Tooltip, Dialog) and the palette and typography, in light and dark.

### 2. Storybook 10

- `@storybook/react-vite` with `addon-docs` (auto-generated docs pages) and `addon-a11y`
  (axe in the browser).
- `.storybook/preview.tsx` applies the app theme, with a toolbar switch for light and dark.

| Command                | What it does                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `yarn storybook`       | local Storybook with hot reload at http://localhost:6006                                           |
| `yarn build:storybook` | static build into `apps/web/public/storybook` (git-ignored); the web app serves it at `/storybook` |

**Publishing:**

- CI and the Dockerfile run `build:storybook` before the web build.
- `/storybook` redirects to `/storybook/index.html`.

### 3. Web app

- **Overview:** uses `StatCard`, `SourceNote` and `SyntheticBadge` in place of its own markup.
- **Layout:** the menu button and the theme toggle use `IconButton`.
- **Config:**
  - `next.config.ts`: `transpilePackages` gains `@pgo/ui`, plus the `/storybook` redirect.
  - Dockerfile: the deps stage copies `packages/ui/package.json`, and the build stage builds
    Storybook.

## Tests

- **`packages/ui`** (Vitest, jsdom, Testing Library), per component:
  - roles and accessible names
  - keyboard behaviour
  - an axe-core scan (colour contrast is excluded, because jsdom does not render)
- **Palette:** a contrast test checks ≥ 4.5:1 in both schemes for text, status tokens, and the
  primary/error/warning/success/info colours, both as text and behind their contrast text.
- **e2e:** `/storybook` loads, and the overview still passes axe in light and dark mode.
- **Every story:** `e2e/storybook-a11y.spec.ts` runs axe (including colour contrast) on every
  Storybook story in light and dark mode.

**Findings from these tests, fixed in the theme:**

- MUI's default error red (`#d32f2f`, `#f44336`) fell below 4.5:1 as text on our backgrounds,
  and white text on the dark red reached only 3.68:1. The feedback colours now reuse the AA-safe
  status colours.
- Unselected toggle buttons used MUI's 54% black (4.34:1). They now use `text.secondary`.

## Verification

```bash
yarn lint && yarn typecheck && yarn test && yarn build:storybook && yarn e2e
```

Expected: all green.

```bash
yarn storybook
```

Expected: http://localhost:6006 lists every component. Each story renders in light and dark,
and the Accessibility panel shows no violations.

```bash
yarn dev
```

Expected: the overview looks as it did in M1. After `yarn build:storybook`,
http://localhost:3000/storybook serves Storybook.

## Manual steps after development

None. Once M2 is released to `main`, Storybook is live at `<live-url>/storybook`.
