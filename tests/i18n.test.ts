// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '../src/modules/i18n';

describe('i18n', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('falls back to key when translation is missing', () => {
    expect(i18n.t('missing.key')).toBe('missing.key');
  });

  it('interpolates parameters in fallback strings', () => {
    expect(i18n.t('Count: {count}', { count: 3 })).toBe('Count: 3');
  });

  it('normalizes invalid locale to en', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    i18n.setLocale('fr');
    expect(i18n.getLocale()).toBe('en');
    warnSpy.mockRestore();
  });
});
