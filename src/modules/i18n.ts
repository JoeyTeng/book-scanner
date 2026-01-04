/**
 * Lightweight i18n system for Book Scanner
 * Zero dependencies, TypeScript-safe translations
 */

export type Locale = 'en' | 'zh-CN';

export type Translations = Record<string, string>;

class I18n {
  private locale: Locale = 'en';
  private translations: Record<Locale, Translations> = {
    en: {},
    'zh-CN': {},
  };
  private listeners: Array<() => void> = [];

  /**
   * Initialize i18n system
   * Loads locale from localStorage or detects browser language
   */
  async init(): Promise<void> {
    // Load translations
    const [en, zhCN] = await Promise.all([
      import('../locales/en.js'),
      import('../locales/zh-CN.js'),
    ]);

    this.translations['en'] = en.en;
    this.translations['zh-CN'] = zhCN.zhCN;

    // Load saved locale or detect from browser
    const saved = localStorage.getItem('locale');
    if (saved === 'en' || saved === 'zh-CN') {
      this.locale = saved;
    } else {
      this.locale = this.detectBrowserLocale();
    }
  }

  /**
   * Detect browser language
   */
  private detectBrowserLocale(): Locale {
    type LocaleNavigator = Navigator & { userLanguage?: string };
    const browserLang = navigator.language || (navigator as LocaleNavigator).userLanguage || '';

    // Chinese variants
    if (browserLang.startsWith('zh')) {
      return 'zh-CN';
    }

    // Default to English
    return 'en';
  }

  /**
   * Translate a key with optional parameter interpolation
   * @param key Translation key (e.g., 'navbar.menu')
   * @param params Optional parameters for interpolation {name: 'value'}
   * @returns Translated string
   */
  t(key: string, params?: Record<string, string | number>): string {
    const translation = this.translations[this.locale][key];

    // Fallback to English if key not found in current locale
    const text = translation || this.translations['en'][key] || key;

    // Interpolate parameters if provided
    if (params) {
      return Object.keys(params).reduce((result, paramKey) => {
        return result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(params[paramKey]));
      }, text);
    }

    return text;
  }

  /**
   * Get current locale
   */
  getLocale(): Locale {
    return this.locale;
  }

  /**
   * Set locale and persist to localStorage
   * @param locale New locale
   */
  setLocale(locale: string): void {
    if (locale !== 'en' && locale !== 'zh-CN') {
      console.warn(`Invalid locale: ${String(locale)}, using 'en'`);
      locale = 'en';
    }

    this.locale = locale;
    localStorage.setItem('locale', locale);

    // Notify listeners (for UI updates)
    this.notifyListeners();
  }

  /**
   * Add a listener for locale changes
   */
  onLocaleChange(callback: () => void): void {
    this.listeners.push(callback);
  }

  /**
   * Notify all listeners of locale change
   */
  private notifyListeners(): void {
    this.listeners.forEach((cb) => cb());
  }
}

// Singleton instance
export const i18n = new I18n();
