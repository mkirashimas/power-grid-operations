/** A series as parallel arrays: point i is (time[i], value[i]), times ascending. */
export interface Points {
  time: ArrayLike<number>;
  value: ArrayLike<number>;
}

export interface DownsampleResult {
  time: Float64Array;
  value: Float64Array;
  /** Points of the input inside the range (plus one either side). */
  inputCount: number;
}

export const ALGORITHMS = ['minmax', 'lttb'] as const;
export type Algorithm = (typeof ALGORITHMS)[number];

export const ENGINES = ['js', 'wasm'] as const;
export type Engine = (typeof ENGINES)[number];
