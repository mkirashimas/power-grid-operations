const QUERY = '(prefers-reduced-motion: reduce)';

/** True when the user asked the system for less motion. False on the server. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.(QUERY).matches);

/** An animation length for JavaScript animations (map, graph): 0 when motion is reduced. */
export const motionDuration = (ms: number) => (prefersReducedMotion() ? 0 : ms);
