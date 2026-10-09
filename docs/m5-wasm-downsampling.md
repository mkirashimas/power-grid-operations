# M5: Rust/WASM downsampling

**Branch:** `feature/m5`, created from `development` and merged back into it.

## Goal

The 1-second synthetic load series on `/charts` (about 2.6M points) is downsampled by Rust
compiled to WebAssembly, in a Web Worker. A toggle switches between the JS and WASM versions
of two algorithms, and the page shows how long each takes:

- **Min/max:** keeps the first, min, max and last point per pixel column, so no peak is lost
- **LTTB** (Largest-Triangle-Three-Buckets): one point per bucket, chosen to keep the visual
  shape. It may drop a single-sample spike.

A benchmark button measures every engine × algorithm × range combination on the visitor's
machine.

## Scope

### 1. Package `@pgo/downsample` (`packages/downsample`)

| Path                  | Role                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `rust/`               | Rust crate: `SeriesStore` holds the series in WASM memory                                                                     |
| `pkg/`                | `wasm-pack` output, **committed**, so building the app needs no Rust                                                          |
| `rust-toolchain.toml` | stable Rust with the `wasm32-unknown-unknown` target                                                                          |
| `src/minmax.ts`       | `downsampleMinMax`, moved from `@pgo/ui` (which re-exports it)                                                                |
| `src/lttb.ts`         | `downsampleLttb`, the JS reference implementation                                                                             |
| `src/wasm.ts`         | entry `@pgo/downsample/wasm` (workers only): `loadWasm()` resolves to false if the module fails to load; `createWasmSeries()` |
| `src/parity.test.ts`  | JS and WASM return identical points for both algorithms                                                                       |

**Series in WASM memory.** The worker copies the series into a `SeriesStore` once. Each request
only passes `from`, `to` and the bucket count, so the timings compare the algorithms, not
copies.

### 2. `@pgo/ui`: async downsampling

- `TimeSeriesPane` takes an optional `downsample` function that returns a promise.
- With it, the pane asks for its lines, ignores stale answers and keeps drawing the previous
  result until the new one arrives, so pan and zoom stay smooth.
- `RenderStats.downsampleMs` reports the worker time separately from the draw time.

### 3. Page (`apps/web/src/features/charts`)

- `worker/downsample.worker.ts` generates the 1-second series, loads the WASM, and answers
  downsample and benchmark requests. The page no longer blocks while the series is generated.
- `engine/run.ts` is the pure, Node-tested function that runs one request.
- Pane 4 adds:
  - **Engine** (JS | WASM) and **Algorithm** (Min/max | LTTB) toggles, mirrored in the URL
    (`engine`, `algo`). Defaults: WASM, min/max.
  - a readout like "2,566,802 → 3,455 points · WASM Min/max in 5.8 ms in a worker · drawn in 0.5 ms"
  - **Run benchmark:** median of 7 runs per engine, algorithm and range (24 h / 7 d / 30 d)
- If the WASM cannot load, the WASM option is disabled with a note and JS is used.

## Tests

- **Rust:** `cargo test` (extremes kept, bucket bounds, range edges, LTTB endpoints).
- **Unit:**
  - LTTB: endpoints kept, output length, a known fixture
  - min/max (moved tests)
  - JS/WASM parity
  - `runDownsample`
  - URL state for `engine` and `algo`
  - the async pane path (draws results, ignores stale answers)
- **e2e:**
  - WASM is the default engine
  - switching engine and algorithm updates the readout and the URL
  - a shared URL restores the toggles
  - the benchmark fills its table
  - axe in light and dark mode
  - no horizontal page scroll on mobile
- **CI:** a `rust` job runs `cargo fmt --check`, `cargo clippy`, `cargo test`, rebuilds the WASM and
  runs the parity tests against the fresh build.

## Verification

```bash
yarn wasm:test && yarn lint && yarn typecheck && yarn test && yarn e2e
```

Expected: all green.

```bash
yarn dev
```

Expected at http://localhost:3000/charts:

- the page stays responsive while the 1-second series is generated
- switching JS / WASM and Min/max / LTTB changes the readout and the URL
- LTTB smooths the single-second spikes; min/max keeps them
- **Run benchmark** fills the table

## Manual steps

Once, before development (Windows, PowerShell):

```powershell
winget install Rustlang.Rustup
```

In a new terminal:

```powershell
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --locked
wasm-pack --version
```

Expected output:

```
wasm-pack 0.15.0
```

After any change under `packages/downsample/rust`:

```bash
yarn wasm:build
```

Then commit `packages/downsample/pkg` together with the Rust change.

## Measured performance

From the page's benchmark (median of 7 runs, 1,000 columns, Chromium desktop, production build):

| Range   | Points in range | Min/max JS | Min/max WASM | LTTB JS | LTTB WASM |
| ------- | --------------- | ---------- | ------------ | ------- | --------- |
| 24 h    | 86,402          | 1.2 ms     | 0.6 ms       | 0.7 ms  | 0.4 ms    |
| 7 days  | 604,802         | 1.7 ms     | 2.1 ms       | 2.7 ms  | 2.0 ms    |
| 30 days | 2,588,401       | 5.5 ms     | 5.8 ms       | 12.2 ms | 8.1 ms    |

**What the numbers show:**

- **Min/max is limited by memory bandwidth.**
  - At first, min/max read every timestamp to find each column's edge. JS took 7–11 ms and
    WASM 8–10 ms for 30 days.
  - Now each column's end is found by binary search, and the running min/max is kept in local
    variables. Only the values are scanned, and both engines take about 5.6 ms. The output
    is identical.
- **LTTB is arithmetic-heavy**, so WASM is consistently about 1.4× faster.
- **The main thread only draws** (under 1 ms). In M4, downsampling and drawing 30 days took
  19.7 ms on the main thread.
