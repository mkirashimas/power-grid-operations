const MINUTE_MS = 60_000;

/** Epoch ms → the local `YYYY-MM-DDTHH:mm` value of a datetime-local input. */
export const toLocalInput = (time: number) => {
  const date = new Date(time);
  return new Date(time - date.getTimezoneOffset() * MINUTE_MS).toISOString().slice(0, 16);
};

/** A datetime-local value (local time) → epoch ms, or null when it is empty or invalid. */
export const fromLocalInput = (value: string): number | null => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

/** Short date and time in the UI language, e.g. "Sep 14, 2026, 2:02 PM". */
export const formatDateTime = (time: number, language: string) =>
  new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(time);
