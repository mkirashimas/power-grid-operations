# M10: Incident reports

**Branch:** `feature/m10`, created from `development` and merged back into it.

## Goal

After an event on the grid, an operator writes it up. `/incidents` lists the reports, and
`/incidents/<id>` is one report:

- **Header:** title, severity, status (open, investigating, resolved), start and resolve times,
  and the affected assets. Clicking an asset selects it app-wide (M7).
- **Rich-text editor (Tiptap):**
  - headings, bold, italic, lists, a task list for action items, links, undo and redo
  - type **@** to mention a grid asset. A mention links the asset to the report and selects
    it when clicked.
  - autosaves while you type
- **Attachments (pdf.js):**
  - synthetic sample PDFs ship with the sample reports
  - **Attach PDF** adds your own file
  - the viewer has page navigation, zoom, fit to width and search with highlighted hits, plus
    a selectable text layer
  - the open document and page are in the URL (`doc`, `page`)
- **Report incident** in the selection bar starts a report for the selected asset.

## Storage: in the browser only

The demo is open and has no sign-in, so reports never leave the browser.

- **IndexedDB** (`pgo-incidents`, through `idb`) has two stores:
  - `incidents`: the reports
  - `files`: uploaded PDFs, as blobs
- **Sample reports:** the database is seeded when it is created. **Reset demo data** clears
  both stores and seeds again.
  - Sample reports are labelled **Sample**, and their PDFs are labelled **SYNTHETIC** on every
    page.
  - Sample text is English sample data, like the asset names. The UI around it is translated.
- **Data layer:** RTK Query endpoints use a `queryFn` that calls the IndexedDB functions, with
  no fetch. Saving the editor updates the cached report optimistically, and it invalidates only
  the list. So autosave never resets the editor.
- **Uploads:**
  - PDF only: the MIME type and the `%PDF-` signature are both checked
  - at most 10 MB per file
  - never sent anywhere
- **pdf.js 6** never evaluates code from a file. Scripting and XFA forms are off. Its worker
  is bundled (`new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`).
  - Fonts a PDF doesn't embed fall back to system fonts (no `standardFontDataUrl`). The sample
    PDFs use the standard Helvetica.
- **Links in reports** are restricted to `http`, `https` and `mailto`.

## Scope

| Path                                      | Role                                                    |
| ----------------------------------------- | ------------------------------------------------------- |
| `features/incidents/model.ts`             | types, create, filter, mentions in a body, `isPdf`      |
| `features/incidents/seed.ts`              | the sample reports                                      |
| `features/incidents/storage/db.ts`        | IndexedDB: open and seed, CRUD, files, reset            |
| `features/incidents/api.ts`               | RTK Query endpoints (`Incident` tag)                    |
| `features/incidents/slice.ts`, `url.ts`   | list filters; `status`, `q`, `doc`, `page` in the URL   |
| `features/incidents/editor/*`             | asset mention extension and suggestions                 |
| `features/incidents/pdf/*`                | pdf.js loader and text search                           |
| `features/incidents/components/*`         | list, report, header, editor, toolbar, attachments, PDF |
| `apps/web/scripts/sample-pdfs.ts`         | writes the sample PDFs (`pdf-lib`)                      |
| `apps/web/public/samples/incidents/*.pdf` | the sample PDFs, committed                              |

- **Libraries:** Tiptap 3 (`@tiptap/react`, `starter-kit`, `extensions`, `extension-list`,
  `extension-mention`, MIT), `pdfjs-dist` 6 (Apache-2.0) and `idb` (ISC).
- **Loading:** the editor and the PDF viewer stay in the feature, like React Flow and MapLibre.
  The report page loads them, but the list page does not.

## Tests

- **Unit:**
  - the model: create, filter, mentions, `isPdf`
  - IndexedDB (`fake-indexeddb`): seeding happens once, CRUD, file round-trip, reset
  - mention suggestions
  - PDF text search
  - URL state
  - the editor toolbar: buttons toggle formatting and expose `aria-pressed`
- **e2e** (`e2e/incidents.spec.ts`):
  - the samples are listed, and the filter and search update the URL
  - new report: type, make text bold, mention an asset, reload, and the content is still there
  - a sample PDF renders, search finds a term, and `page=` follows
  - upload: a PDF is attached and shown, and a text file is rejected
  - Report incident from the selection bar prefills the asset
  - Reset demo data restores the samples
  - axe in light and dark mode
  - no horizontal page scroll on mobile

## Verification

```bash
yarn lint && yarn typecheck && yarn test && yarn e2e
```

Expected: all green.

```bash
yarn dev
```

Expected at http://localhost:3000/incidents:

- the seven sample reports are listed
- in a report, edits survive a reload
- typing **@** suggests assets
- the sample PDFs render, and search and zoom work
- your own PDF can be attached

## Manual steps

None. The sample PDFs are committed. To change them, edit `apps/web/scripts/sample-pdfs.ts`
and run:

```bash
yarn workspace @pgo/web samples:pdf
```
