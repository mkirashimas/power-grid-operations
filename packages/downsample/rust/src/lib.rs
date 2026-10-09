//! Downsampling of long time series for drawing, compiled to WebAssembly.
//!
//! Both algorithms mirror the JS versions in `../src` operation for operation, so JS and WASM
//! return identical points (checked by `src/parity.test.ts`).

use wasm_bindgen::prelude::*;

/// Index of the first time >= t in an ascending slice (binary search).
fn lower_bound(time: &[f64], t: f64) -> usize {
    let (mut low, mut high) = (0, time.len());
    while low < high {
        let mid = (low + high) / 2;
        if time[mid] < t {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    low
}

/// Indices of the points inside [from, to], plus one either side so lines reach the edges.
fn visible_range(time: &[f64], from: f64, to: f64) -> (usize, usize) {
    let start = lower_bound(time, from).saturating_sub(1);
    let end = (lower_bound(time, to) + 1).min(time.len());
    (start, end.max(start))
}

fn copy_through(time: &[f64], value: &[f32], start: usize, end: usize) -> Vec<f64> {
    let mut out = Vec::with_capacity((end - start) * 2);
    for i in start..end {
        out.push(time[i]);
        out.push(f64::from(value[i]));
    }
    out
}

/// Min/max ("M4") downsampling: the first, min, max and last point of each of `buckets`
/// columns, in time order. Returns interleaved `[t0, v0, t1, v1, ...]`.
pub fn min_max(time: &[f64], value: &[f32], from: f64, to: f64, buckets: u32) -> Vec<f64> {
    let (start, end) = visible_range(time, from, to);
    let columns = buckets.max(1) as usize;
    if end - start <= columns * 4 {
        return copy_through(time, value, start, end);
    }

    let mut out: Vec<f64> = Vec::with_capacity((columns * 4 + 2) * 2);
    let mut push = |i: usize| {
        let (t, v) = (time[i], f64::from(value[i]));
        let n = out.len();
        if n > 0 && out[n - 2] == t && out[n - 1] == v {
            return;
        }
        out.push(t);
        out.push(v);
    };

    let width = (to - from) / columns as f64;
    let last_column = (columns - 1) as f64;
    let mut i = start;
    while i < end {
        let column = ((time[i] - from) / width).floor().max(0.0).min(last_column);
        let column_end = from + (column + 1.0) * width;
        let is_last = column == last_column;
        // Points before `from` and after `to` fall into the first and last columns. The end of
        // the column is found by binary search, so only the values are scanned. Every column
        // takes at least one point, even if rounding puts time[i] on its end.
        let group_end = if is_last {
            end
        } else {
            (i + lower_bound(&time[i..end], column_end)).max(i + 1)
        };
        let (first, last) = (i, group_end - 1);
        // The running extremes stay in locals: one load per point, no bounds checks.
        let (mut min, mut max) = (i, i);
        let (mut min_value, mut max_value) = (value[i], value[i]);
        for (j, &v) in value[i..group_end].iter().enumerate() {
            if v < min_value {
                min_value = v;
                min = i + j;
            }
            if v > max_value {
                max_value = v;
                max = i + j;
            }
        }
        i = group_end;
        push(first);
        if min < max {
            push(min);
            push(max);
        } else {
            push(max);
            push(min);
        }
        push(last);
    }
    out
}

/// Largest-Triangle-Three-Buckets: keeps the first and last point and, from each of
/// `threshold - 2` buckets, the point forming the largest triangle with the previously kept
/// point and the average of the next bucket. Returns interleaved `[t0, v0, t1, v1, ...]`.
pub fn lttb(time: &[f64], value: &[f32], from: f64, to: f64, threshold: u32) -> Vec<f64> {
    let (start, end) = visible_range(time, from, to);
    let n = end - start;
    let threshold = threshold as usize;
    if threshold < 3 || n <= threshold {
        return copy_through(time, value, start, end);
    }

    let x = |i: usize| time[start + i];
    let y = |i: usize| f64::from(value[start + i]);
    let mut out: Vec<f64> = Vec::with_capacity(threshold * 2);
    out.push(x(0));
    out.push(y(0));

    let every = (n - 2) as f64 / (threshold - 2) as f64;
    let mut a = 0;
    for bucket in 0..threshold - 2 {
        // Average of the next bucket.
        let avg_start = (((bucket + 1) as f64) * every).floor() as usize + 1;
        let avg_end = ((((bucket + 2) as f64) * every).floor() as usize + 1).min(n);
        let (mut avg_x, mut avg_y) = (0.0, 0.0);
        for j in avg_start..avg_end {
            avg_x += x(j);
            avg_y += y(j);
        }
        let count = (avg_end - avg_start) as f64;
        avg_x /= count;
        avg_y /= count;

        // The point of this bucket with the largest triangle.
        let range_start = ((bucket as f64) * every).floor() as usize + 1;
        let range_end = (((bucket + 1) as f64) * every).floor() as usize + 1;
        let (ax, ay) = (x(a), y(a));
        let mut max_area = -1.0;
        let mut chosen = range_start;
        for j in range_start..range_end {
            let area = ((ax - avg_x) * (y(j) - ay) - (ax - x(j)) * (avg_y - ay)).abs();
            if area > max_area {
                max_area = area;
                chosen = j;
            }
        }
        out.push(x(chosen));
        out.push(y(chosen));
        a = chosen;
    }

    out.push(x(n - 1));
    out.push(y(n - 1));
    out
}

/// A series copied into WASM memory once, so each downsample call only passes the range.
#[wasm_bindgen]
pub struct SeriesStore {
    time: Vec<f64>,
    value: Vec<f32>,
}

#[wasm_bindgen]
impl SeriesStore {
    /// `time` is ascending epoch ms; `value[i]` belongs to `time[i]`.
    #[wasm_bindgen(constructor)]
    pub fn new(time: &[f64], value: &[f32]) -> SeriesStore {
        SeriesStore {
            time: time.to_vec(),
            value: value.to_vec(),
        }
    }

    /// Points that `min_max` and `lttb` read for this range (one either side included).
    #[wasm_bindgen(js_name = countInRange)]
    pub fn count_in_range(&self, from: f64, to: f64) -> u32 {
        let (start, end) = visible_range(&self.time, from, to);
        (end - start) as u32
    }

    #[wasm_bindgen(js_name = minMax)]
    pub fn min_max(&self, from: f64, to: f64, buckets: u32) -> Vec<f64> {
        min_max(&self.time, &self.value, from, to, buckets)
    }

    pub fn lttb(&self, from: f64, to: f64, threshold: u32) -> Vec<f64> {
        lttb(&self.time, &self.value, from, to, threshold)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn series(n: usize) -> (Vec<f64>, Vec<f32>) {
        let time = (0..n).map(|i| i as f64 * 1000.0).collect();
        let value = (0..n)
            .map(|i| {
                ((i as f64 / 5000.0).sin() * 100.0) as f32 + if i == 54_321 { 900.0 } else { 0.0 }
            })
            .collect();
        (time, value)
    }

    fn values(points: &[f64]) -> Vec<f64> {
        points.iter().skip(1).step_by(2).copied().collect()
    }

    fn times(points: &[f64]) -> Vec<f64> {
        points.iter().step_by(2).copied().collect()
    }

    #[test]
    fn lower_bound_finds_the_first_time_at_or_after_t() {
        let time = [0.0, 10.0, 20.0, 30.0];
        assert_eq!(lower_bound(&time, 15.0), 2);
        assert_eq!(lower_bound(&time, 20.0), 2);
        assert_eq!(lower_bound(&time, 40.0), 4);
        assert_eq!(lower_bound(&time, -1.0), 0);
    }

    #[test]
    fn min_max_keeps_the_extremes_with_at_most_four_points_per_bucket() {
        let (time, value) = series(100_000);
        let out = min_max(&time, &value, 0.0, time[time.len() - 1], 500);
        let v = values(&out);
        assert!(v.len() <= 500 * 4 + 2);
        let max = v.iter().cloned().fold(f64::MIN, f64::max);
        assert_eq!(max, f64::from(value[54_321]));
        assert!(times(&out).windows(2).all(|w| w[0] <= w[1]));
    }

    #[test]
    fn min_max_reads_only_the_range_plus_one_point_either_side() {
        let (time, value) = series(100_000);
        let store = SeriesStore::new(&time, &value);
        assert_eq!(store.count_in_range(time[1000], time[2000]), 1002);
        let out = min_max(&time, &value, time[1000], time[2000], 100);
        let t = times(&out);
        assert_eq!(t[0], time[999]);
        assert_eq!(t[t.len() - 1], time[2000]);
    }

    #[test]
    fn small_inputs_are_copied_through() {
        let time = [0.0, 1.0, 2.0];
        let value = [5.0, 6.0, 7.0];
        assert_eq!(
            min_max(&time, &value, 0.0, 2.0, 100),
            vec![0.0, 5.0, 1.0, 6.0, 2.0, 7.0]
        );
        assert_eq!(
            lttb(&time, &value, 0.0, 2.0, 100),
            vec![0.0, 5.0, 1.0, 6.0, 2.0, 7.0]
        );
    }

    #[test]
    fn lttb_returns_threshold_points_including_both_ends() {
        let (time, value) = series(100_000);
        let out = lttb(&time, &value, 0.0, time[time.len() - 1], 300);
        let t = times(&out);
        assert_eq!(t.len(), 300);
        assert_eq!(t[0], time[0]);
        assert_eq!(t[t.len() - 1], time[time.len() - 1]);
        assert!(t.windows(2).all(|w| w[0] < w[1]));
    }

    #[test]
    fn lttb_keeps_a_lone_peak_that_dominates_its_bucket() {
        let time: Vec<f64> = (0..1000).map(|i| i as f64).collect();
        let value: Vec<f32> = (0..1000)
            .map(|i| if i == 500 { 100.0 } else { 0.0 })
            .collect();
        let out = lttb(&time, &value, 0.0, 999.0, 50);
        assert!(values(&out).contains(&100.0));
    }

    #[test]
    fn empty_series_return_nothing() {
        assert!(min_max(&[], &[], 0.0, 1.0, 10).is_empty());
        assert!(lttb(&[], &[], 0.0, 1.0, 10).is_empty());
    }
}
