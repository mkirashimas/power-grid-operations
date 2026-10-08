import { describe, expect, it } from 'vitest';
import { computeWindow, MAX_SCROLL_HEIGHT, scrollTopFor } from './scaledWindow.ts';

const base = { rowHeight: 40, viewport: 400, overscan: 0 };

describe('computeWindow', () => {
  it('does not scale content that fits', () => {
    const window = computeWindow({ ...base, rowCount: 1000, scrollTop: 800 });
    expect(window.scale).toBe(1);
    expect(window.scrollHeight).toBe(40_000);
    expect([window.start, window.end]).toEqual([20, 30]);
    expect(window.offsetOf(20)).toBe(800);
  });

  it('caps the scroll height for a million rows and still reaches the last row', () => {
    const rowCount = 1_076_544;
    const top = computeWindow({ ...base, rowCount, scrollTop: 0 });
    expect(top.scrollHeight).toBe(MAX_SCROLL_HEIGHT);
    expect(top.scale).toBeGreaterThan(2.8);
    expect(top.start).toBe(0);

    // Scrolled to the bottom: the last row ends exactly at the bottom of the viewport.
    const maxScrollTop = MAX_SCROLL_HEIGHT - base.viewport;
    const bottom = computeWindow({ ...base, rowCount, scrollTop: maxScrollTop });
    expect(bottom.end).toBe(rowCount);
    expect(bottom.offsetOf(rowCount - 1) + base.rowHeight).toBeCloseTo(
      maxScrollTop + base.viewport,
      3,
    );
  });

  it('renders overscan rows on both sides', () => {
    const window = computeWindow({ ...base, rowCount: 1000, scrollTop: 800, overscan: 5 });
    expect([window.start, window.end]).toEqual([15, 35]);
  });
});

describe('scrollTopFor', () => {
  it('returns undefined for a visible row and scrolls minimally otherwise', () => {
    const input = { ...base, rowCount: 1000, scrollTop: 800 };
    expect(scrollTopFor(25, input)).toBeUndefined();
    expect(scrollTopFor(10, input)).toBe(400);
    expect(scrollTopFor(40, input)).toBe(41 * 40 - 400);
  });

  it('maps through the scale for huge row counts', () => {
    const rowCount = 1_076_544;
    const scrollTop = scrollTopFor(rowCount - 1, { ...base, rowCount, scrollTop: 0 })!;
    const window = computeWindow({ ...base, rowCount, scrollTop });
    expect(window.end).toBe(rowCount);
    expect(scrollTop).toBeCloseTo(MAX_SCROLL_HEIGHT - base.viewport, 3);
  });
});
