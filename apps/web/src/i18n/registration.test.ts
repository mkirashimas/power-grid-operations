// @vitest-environment node
// The server path of getI18n (no window): one instance per request.
import { describe, expect, it } from 'vitest';
import { getI18n, registerNamespace } from './index';

const resources = (text: string) => ({
  en: { heading: text },
  es: { heading: text },
  fr: { heading: text },
  it: { heading: text },
  ro: { heading: text },
});

describe('registerNamespace on the server', () => {
  it('reaches request instances created before the namespace was registered', () => {
    // As on the first request after a server start: the instance exists before the feature's
    // module (which registers its namespace) has loaded.
    const early = getI18n('en');
    registerNamespace('late-feature', resources('ERCOT, last 30 days'));

    expect(early.t('heading', { ns: 'late-feature' })).toBe('ERCOT, last 30 days');
    expect(getI18n('en').t('heading', { ns: 'late-feature' })).toBe('ERCOT, last 30 days');
  });
});
