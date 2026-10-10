// Every link target in the app. Next.js routes come from the folders in src/app;
// these literals must match them. Dynamic routes get a builder function.
export const PATHS = {
  HOME: '/',
  TELEMETRY: '/telemetry',
  CHARTS: '/charts',
  ALARMS: '/alarms',
  MAP: '/map',
  NETWORK: '/network',
  INCIDENTS: '/incidents',
  /** Creates a report (optionally for an asset), then opens it. */
  NEW_INCIDENT: '/incidents/new',
  incident: (id: string) => `/incidents/${encodeURIComponent(id)}`,
  newIncident: (assetId?: string) =>
    assetId ? `/incidents/new?asset=${encodeURIComponent(assetId)}` : '/incidents/new',
} as const;

export type Path = Extract<(typeof PATHS)[keyof typeof PATHS], string>;
