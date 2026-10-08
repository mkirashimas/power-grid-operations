/**
 * Row virtualization that works past the browser's maximum element height.
 *
 * Browsers cap an element's height (about 33.5M px in Chrome, 17.9M px in Firefox). A million
 * 40 px rows need 43M px, so the bottom rows would be unreachable. The scroll area is therefore
 * capped at MAX_SCROLL_HEIGHT, and the scroll position maps proportionally onto the full
 * ("virtual") content: one scrolled pixel moves `scale` virtual pixels. Rows are positioned
 * relative to the current scroll position, so within the viewport they still move smoothly.
 */
export const MAX_SCROLL_HEIGHT = 15_000_000;

export interface WindowInput {
  rowCount: number;
  rowHeight: number;
  /** Visible height of the rows area (excluding any sticky header). */
  viewport: number;
  /** Current scrollTop of the scroll container. */
  scrollTop: number;
  overscan: number;
  maxScrollHeight?: number;
}

export interface RowWindow {
  /** Height to give the scrollable body. */
  scrollHeight: number;
  /** Virtual pixels per scrolled pixel (1 when no scaling is needed). */
  scale: number;
  /** First rendered row (inclusive) and last (exclusive). */
  start: number;
  end: number;
  /** Top of a row within the scrollable body. */
  offsetOf: (index: number) => number;
}

const scaleOf = (content: number, scrollHeight: number, viewport: number) =>
  content > scrollHeight ? (content - viewport) / Math.max(1, scrollHeight - viewport) : 1;

export const computeWindow = ({
  rowCount,
  rowHeight,
  viewport,
  scrollTop,
  overscan,
  maxScrollHeight = MAX_SCROLL_HEIGHT,
}: WindowInput): RowWindow => {
  const content = rowCount * rowHeight;
  const scrollHeight = Math.min(content, maxScrollHeight);
  const scale = scaleOf(content, scrollHeight, viewport);
  const virtualTop = scrollTop * scale;
  return {
    scrollHeight,
    scale,
    start: Math.max(0, Math.floor(virtualTop / rowHeight) - overscan),
    end: Math.min(rowCount, Math.ceil((virtualTop + viewport) / rowHeight) + overscan),
    offsetOf: (index) => scrollTop + index * rowHeight - virtualTop,
  };
};

/**
 * The scrollTop that brings a row fully into view, scrolling as little as possible, or
 * undefined when it is already visible.
 */
export const scrollTopFor = (
  index: number,
  { rowCount, rowHeight, viewport, scrollTop, maxScrollHeight = MAX_SCROLL_HEIGHT }: WindowInput,
): number | undefined => {
  const content = rowCount * rowHeight;
  const scale = scaleOf(content, Math.min(content, maxScrollHeight), viewport);
  const virtualTop = scrollTop * scale;
  const top = index * rowHeight;
  if (top < virtualTop) return top / scale;
  if (top + rowHeight > virtualTop + viewport) return (top + rowHeight - viewport) / scale;
  return undefined;
};
