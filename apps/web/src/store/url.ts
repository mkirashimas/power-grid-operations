/**
 * Merges `params` into a query string, replacing only the `owned` keys: each part of the page
 * (a view's filters, the linked selection) owns its keys and keeps the others.
 */
export const mergeSearch = (
  current: string,
  owned: readonly string[],
  params: URLSearchParams,
): string => {
  const merged = new URLSearchParams(current);
  owned.forEach((key) => merged.delete(key));
  params.forEach((value, key) => merged.set(key, value));
  return merged.toString();
};

/**
 * Writes the merged query string to the address bar with history.replaceState, which
 * Next.js tracks without a server round trip. Does nothing if it is unchanged.
 */
export const replaceSearchParams = (owned: readonly string[], params: URLSearchParams) => {
  const current = window.location.search.replace(/^\?/, '');
  const search = mergeSearch(current, owned, params);
  if (search !== current) {
    window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname);
  }
};
