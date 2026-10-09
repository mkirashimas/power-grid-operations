# M6: Real-time + alarm feed

**Branch:** `feature/m6`, created from `development` and merged back into it.

## Goal

A second Cloud Run service streams live, **synthetic** grid data over a WebSocket. A new
`/alarms` page shows it as it arrives:

- a connection chip: **Live**, **Reconnecting…** or **Offline**
- KPI tiles: active alarms, active warnings, unacknowledged, updates per second
- a live chart of system load over the last 10 minutes, one point per second
- an alarm table, newest first, with filters (severity, zone), **Pause** and **Acknowledge**

An acknowledgement goes to the server, which broadcasts it: every open tab sees it.

## Scope

### 1. Simulator and protocol (`@pgo/grid-model`)

| File               | Role                                                                         |
| ------------------ | ---------------------------------------------------------------------------- |
| `live.ts`          | `createLiveSimulator()`: seeded, pure; one `step(now)` per tick              |
| `live-protocol.ts` | message types shared by the service and the app, plus `parseClientMessage()` |

**Each tick:**

- **System load:** the EIA demand at the same hour of the week, interpolated, plus noise.
- **Per-zone load:** the system load split by zone share.
- **Asset updates:** about 5 % of the 1,869 assets, as `[index, loadingPct, voltagePu]`.

**Alarms:**

- Thresholds are the telemetry table's (`status.ts`):
  - overload: warning at 90 %, alarm at 100 %
  - voltage outside 0.95–1.05 pu
- **Hysteresis:** an alarm clears only 3 points (or 0.01 pu) inside its threshold, so alarms
  don't flicker on and off.
- **Events:** seeded disturbances (line overloads, voltage sags and swells) cause about 1–3
  alarms a minute.

**Messages:**

| Direction       | Message                                                                |
| --------------- | ---------------------------------------------------------------------- |
| server → client | `hello`: server time, the last 10 minutes of load, the last 200 alarms |
| server → client | `tick`: time, load, zones, asset updates                               |
| server → client | `alarm`: one alarm raised, escalated, cleared or acknowledged          |
| client → server | `ack`: acknowledge an alarm by id                                      |
| client → server | `watch`: follow one asset every tick (added in M7)                     |
| server → client | `asset`: the watched asset's loading and voltage (added in M7)         |

### 2. Service `services/realtime` (`@pgo/realtime`)

- Node 22 and `ws`. It runs its TypeScript directly (`--experimental-strip-types`), with no build
  step.
- `GET /healthz`. Every other path is a WebSocket upgrade.
- One simulator per instance. The tick timer runs only while clients are connected.
- Input limits: messages of at most 1 KB; malformed messages are ignored; at most 10 acks per
  second per connection.
- Env: `PORT` (8081 locally, 8080 on Cloud Run), `TICK_MS` (1000), `ALARM_RATE` (events per
  tick).

### 3. Page (`apps/web/src/features/alarms`)

- `api.ts`: RTK Query streaming endpoint. `onCacheEntryAdded` opens the WebSocket and folds
  each message into the cache with the pure `applyMessage()`. It reconnects with backoff
  (1 s → 30 s). `acknowledgeAlarm` sends an `ack` on the open socket.
- The server component reads `REALTIME_URL` at request time and passes it to the page.
- Filters (`severity`, `zone`) are mirrored in the URL. **Pause** freezes the table; data keeps
  arriving.

### 4. Changes to `@pgo/ui`

- `ChartWorkbench`: `controls={false}` hides the zoom toolbar, and `overview` is optional.
  The live chart uses both.
- `VirtualGrid`: Enter or Space on a cell activates the button inside it (ARIA grid pattern).

### 5. Deployment

- New Cloud Run service `pgo-realtime`. Its image goes into the existing `web` repository.
- Settings:
  - `--timeout 3600`: a WebSocket lasts at most an hour; the page then reconnects.
  - `--max-instances 1`: one shared alarm state for all visitors.
  - `--min-instances 0`
- The web service gets `REALTIME_URL=wss://<pgo-realtime URL>` at deploy time.

## Tests

- **Unit:**
  - the simulator is deterministic for a seed
  - hysteresis and escalation
  - the alarm rate
  - asset updates stay in range
  - `applyMessage`: caps, ack, clear
  - URL state
  - the `VirtualGrid` cell button
- **Service:** a real server on a random port with WebSocket clients:
  - `hello`, then ticks
  - an ack reaches a second client
  - bad input is ignored
- **e2e:** Playwright starts both servers (realtime with `TICK_MS=200` and a high alarm rate):
  - Live status, ticking KPIs and chart
  - alarms appear
  - acknowledging in one tab shows in another
  - filters and the URL
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

Expected at http://localhost:3000/alarms:

- the chip shows **Live**, and the chart scrolls
- alarms appear within a minute
- **Acknowledge** in one tab shows in another tab
- stopping `yarn dev` and starting it again shows **Reconnecting…**, then **Live**

## Manual steps

None before merging. After the release to `main`, the deploy log shows both services, and the
live `/alarms` page connects to `wss://pgo-realtime-…run.app`.

## Known limits

- Acknowledgements are shared by everyone (open demo) and reset when the instance restarts.
- When nobody is connected, the simulator pauses; it resumes at the current time.
