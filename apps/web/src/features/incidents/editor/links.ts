const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:'];

/** True for absolute http, https and mailto links: the only ones a report may contain. */
export const isSafeLink = (value: string) => {
  try {
    const url = new URL(value.trim());
    return SAFE_PROTOCOLS.includes(url.protocol) && (url.protocol === 'mailto:' || !!url.hostname);
  } catch {
    return false;
  }
};
