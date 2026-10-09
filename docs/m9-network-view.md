# M9: Network view

**Branch:** `feature/m9`, created from `development` and merged back into it.

## Goal

A `/network` page shows the synthetic grid as a network, and lets an operator test a change
before it happens:

- **Asset tree:** Zone → Substation → its generators, load and lines, with live status and a
  filter. It follows the tree keyboard pattern and is the accessible way through the network.
- **Topology:** React Flow graph of the 400 substations, placed by geography, and the 769 lines
  between them, coloured by loading. It has zoom, pan, a minimap and a zone filter.
- **What-if editor:**
  - edits: trip a line, scale a substation's load, take a generator offline
  - a **DC power flow** compares the study with the base case
  - results: the lines that changed most, new overloads, and islands
  - edits are kept in the URL (`study=`), so a scenario can be shared
- **Linked selection** (M7): the tree, the graph and the rest of the app share one selected
  asset.

## The study model

A DC power flow is the standard quick approximation for contingency studies: it gives active
power on every line from bus injections and line reactances.

- **Buses:** the 400 substations. **Branches:** the 769 lines.
- **Reactance:** line length × 0.4 Ω/km at 138 kV or 0.3 Ω/km at 345 kV, in per unit on
  100 MVA (`x = Ω / (kV² / 100)`).
- **Injections:**
  - loads at a fixed share of their peak
  - generators dispatched in merit order: wind and solar at typical availability, nuclear near
    full, then coal and gas share the rest
  - the slack bus (largest generator) balances each island
- **Solve:**
  - build the bus susceptance matrix, drop the slack row and column
  - solve with dense LU (partial pivoting)
  - flow = (θi − θj) / x
- **Islands:** found with union-find after edits. Each island with generation is solved on its
  own. An island without generation is de-energised: its load is unserved and its lines carry
  nothing.

**Ratings (an N-0 secure base case):**

- The synthetic lines' nameplate ratings don't come from a planned grid, so a consistent power
  flow overloads about 200 of them before any edit.
- The study therefore rates each line at the larger of its nameplate and its base-case flow
  ÷ 0.8 (`prepareNetwork`). The base case then peaks at 80 %.
- About 290 of the 769 single-line trips create a new overload: the network is weak where it
  should look weak.

**Solve time:** about 3 ms warm and 15 ms cold for 400 buses (Node, dense LU). It runs on the
main thread, memoised on the edit list.

**Limits, by design:** no losses, no reactive power or voltage magnitudes (all at 1 pu), no
protection or dynamics. The study model is independent from the live simulator that colours
the graph in **Live** mode.

## Scope

| Path                                  | Role                                                 |
| ------------------------------------- | ---------------------------------------------------- |
| `features/network/engine/network.ts`  | buses, branches, base injections from the asset list |
| `features/network/engine/dcFlow.ts`   | islands, susceptance matrix, LU solve, flows         |
| `features/network/engine/study.ts`    | applies edits, compares study and base               |
| `features/network/tree.ts`            | tree items and the path to an asset                  |
| `features/network/components/*`       | tree, graph, editor, results                         |
| `features/network/slice.ts`, `url.ts` | mode, zone, edits; mirrored in the URL               |

The graph uses `@xyflow/react` and the tree `@mui/x-tree-view` (both MIT).

- **Keyboard:** graph nodes are not keyboard stops; the tree is the keyboard path to every asset
  (Space selects, Enter or → expands).
- **Accessibility tests:** the axe checks skip the graph's node-and-edge layer
  (`.react-flow__viewport`). The region, controls and minimap are still checked.
- **Fixed node size:** nodes get an explicit 10×10 size. The graph is read-only, so node
  measurements never flow back through `onNodesChange`, and the minimap only draws nodes with
  known dimensions.

## Tests

- **Unit:**
  - DC flow: a 3-bus textbook case, power balance, a trip moving flow to parallel paths, and
    islands
  - study comparison and new overloads
  - tree and path
  - URL state
- **e2e:**
  - the three panes render
  - tree selection drives the graph and the selection bar
  - tripping a line lists results and sets `study=`
  - Reset clears the study, and a shared study link restores it
  - keyboard navigation in the tree
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

Expected at http://localhost:3000/network:

- the tree, the graph and the editor show
- select a heavily loaded line, then **Trip**: neighbouring lines change colour and are listed
  in the results
- **Reset** clears the study
- **Open in Network** from the selection bar on another page expands the tree to the asset and
  centres the graph on it

## Manual steps

None.
