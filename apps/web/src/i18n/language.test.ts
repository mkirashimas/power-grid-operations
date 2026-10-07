import { describe, expect, it } from 'vitest';
import { resolveLanguage, toLanguage } from './language';

describe('resolveLanguage', () => {
  it('prefers a supported cookie value', () => {
    expect(resolveLanguage('ro', 'fr-FR,fr;q=0.9')).toBe('ro');
  });

  it('ignores an unsupported cookie value', () => {
    expect(resolveLanguage('de', 'it-IT,it;q=0.9')).toBe('it');
  });

  it('picks the highest-weighted supported language from Accept-Language', () => {
    expect(resolveLanguage(undefined, 'de;q=1, es;q=0.4, fr;q=0.8')).toBe('fr');
  });

  it('skips languages with q=0', () => {
    expect(resolveLanguage(undefined, 'es;q=0, ro;q=0.5')).toBe('ro');
  });

  it('falls back to English', () => {
    expect(resolveLanguage(undefined, 'de-DE,ja;q=0.5')).toBe('en');
    expect(resolveLanguage(null, null)).toBe('en');
  });
});

describe('toLanguage', () => {
  it('keeps supported languages and defaults the rest', () => {
    expect(toLanguage('es')).toBe('es');
    expect(toLanguage('pt')).toBe('en');
    expect(toLanguage(undefined)).toBe('en');
  });
});
