// Every link target in the app. Next.js routes come from the folders in src/app;
// these literals must match them. Dynamic routes get a builder function, e.g.
// `incident: (id: string) => \`/incidents/${id}\``.
export const PATHS = {
  HOME: '/',
  TELEMETRY: '/telemetry',
  CHARTS: '/charts',
  ALARMS: '/alarms',
  MAP: '/map',
  NETWORK: '/network',
} as const;

export type Path = Extract<(typeof PATHS)[keyof typeof PATHS], string>;
