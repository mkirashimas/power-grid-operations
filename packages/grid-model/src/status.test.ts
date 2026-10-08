import { describe, expect, it } from 'vitest';
import { statusOf, statusSeverity } from './status.ts';

describe('statusOf', () => {
  it.each([
    [50, 1.0, 'normal'],
    [89.9, 1.0, 'normal'],
    [90, 1.0, 'warning'],
    [99.9, 1.0, 'warning'],
    [100, 1.0, 'alarm'],
    [120, 1.0, 'alarm'],
    [10, 0.949, 'alarm'],
    [10, 1.051, 'alarm'],
    [10, 0.95, 'normal'],
    [10, 1.05, 'normal'],
  ] as const)('loading %s %% at %s pu is %s', (loading, voltage, expected) => {
    expect(statusOf(loading, voltage)).toBe(expected);
  });

  it('orders severity normal < warning < alarm', () => {
    expect(statusSeverity('normal')).toBeLessThan(statusSeverity('warning'));
    expect(statusSeverity('warning')).toBeLessThan(statusSeverity('alarm'));
  });
});
