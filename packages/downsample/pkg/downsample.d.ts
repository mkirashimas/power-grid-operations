/* tslint:disable */
/* eslint-disable */

/**
 * A series copied into WASM memory once, so each downsample call only passes the range.
 */
export class SeriesStore {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Points that `min_max` and `lttb` read for this range (one either side included).
     */
    countInRange(from: number, to: number): number;
    lttb(from: number, to: number, threshold: number): Float64Array;
    minMax(from: number, to: number, buckets: number): Float64Array;
    /**
     * `time` is ascending epoch ms; `value[i]` belongs to `time[i]`.
     */
    constructor(time: Float64Array, value: Float32Array);
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_seriesstore_free: (a: number, b: number) => void;
    readonly seriesstore_countInRange: (a: number, b: number, c: number) => number;
    readonly seriesstore_lttb: (a: number, b: number, c: number, d: number) => [number, number];
    readonly seriesstore_minMax: (a: number, b: number, c: number, d: number) => [number, number];
    readonly seriesstore_new: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
