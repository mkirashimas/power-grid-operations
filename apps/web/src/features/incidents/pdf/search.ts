/** A hit: the 1-based page and the index of the text item that contains it. */
export interface TextMatch {
  page: number;
  item: number;
}

export const MIN_QUERY_LENGTH = 2;

/**
 * Finds `query` in each page's text items (pdf.js `getTextContent()` strings), ignoring case.
 * One match per item, in reading order.
 */
export const findMatches = (pages: readonly (readonly string[])[], query: string): TextMatch[] => {
  const needle = query.trim().toLowerCase();
  if (needle.length < MIN_QUERY_LENGTH) return [];
  return pages.flatMap((items, pageIndex) =>
    items.flatMap((text, item) =>
      text.toLowerCase().includes(needle) ? [{ page: pageIndex + 1, item }] : [],
    ),
  );
};

/** The match to move to: the next (or previous) one, wrapping around; -1 when there is none. */
export const stepMatch = (count: number, current: number, direction: 1 | -1) => {
  if (count === 0) return -1;
  if (current < 0) return direction === 1 ? 0 : count - 1;
  return (current + direction + count) % count;
};
