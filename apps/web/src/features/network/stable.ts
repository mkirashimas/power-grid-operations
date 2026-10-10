/**
 * Returns `items`, but keeps the object from the previous call (in `cache`) for every item that
 * `same` says is unchanged. React Flow skips nodes and edges whose object it has seen before,
 * so a live tick or a study only redraws what actually changed instead of all 1,169 elements.
 */
export const reuseUnchanged = <T extends { id: string }>(
  cache: Map<string, T>,
  items: readonly T[],
  same: (previous: T, next: T) => boolean,
): T[] => {
  const result = items.map((item) => {
    const previous = cache.get(item.id);
    return previous && same(previous, item) ? previous : item;
  });
  cache.clear();
  result.forEach((item) => cache.set(item.id, item));
  return result;
};
