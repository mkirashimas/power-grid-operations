export const THEME_MODES = ['light', 'dark'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export const STATUSES = ['normal', 'warning', 'alarm', 'offline'] as const;

/** Operational state of an asset or reading. */
export type Status = (typeof STATUSES)[number];
