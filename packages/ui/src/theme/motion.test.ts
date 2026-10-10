import { afterEach, describe, expect, it, vi } from 'vitest';
import { components } from './components.ts';
import { motionDuration, prefersReducedMotion } from './motion.ts';

const setReducedMotion = (reduce: boolean) =>
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: reduce && query === '(prefers-reduced-motion: reduce)',
        media: query,
      }) as MediaQueryList,
  );

afterEach(() => vi.restoreAllMocks());

describe('motion', () => {
  it('keeps animations by default', () => {
    setReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
    expect(motionDuration(400)).toBe(400);
  });

  it('drops JavaScript animations when the user asks for less motion', () => {
    setReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(motionDuration(400)).toBe(0);
  });

  it('turns off CSS transitions and animations under prefers-reduced-motion', () => {
    const overrides = components.MuiCssBaseline?.styleOverrides as Record<string, unknown>;
    expect(overrides['@media (prefers-reduced-motion: reduce)']).toMatchObject({
      '*, *::before, *::after': { transitionDuration: '0.01ms !important' },
    });
  });
});
