import { describe, expect, it } from 'vitest';
import { getPalette } from './palette.ts';
import { STATUSES, THEME_MODES } from './types.ts';

// WCAG 2.x relative luminance and contrast ratio.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

describe.each(THEME_MODES)('%s palette', (mode) => {
  const palette = getPalette(mode);
  const paper = palette.background!.paper!;
  const page = palette.background!.default!;

  it.each(STATUSES)('status.%s is readable as text on paper and page (AA)', (status) => {
    const color = palette.status![status]!;
    expect(contrast(color, paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color, page)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps body and secondary text readable (AA)', () => {
    for (const background of [paper, page]) {
      expect(contrast(palette.text!.primary!, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(palette.text!.secondary!, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  // Used as text (outlined/text buttons, alerts) and as fills (contained buttons, chips).
  it.each(['primary', 'error', 'warning', 'success', 'info'] as const)(
    '%s works as text on surfaces and as a fill behind its contrast text (AA)',
    (key) => {
      const { main, contrastText } = palette[key] as { main: string; contrastText: string };
      expect(contrast(main, paper)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(main, page)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(contrastText, main)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
