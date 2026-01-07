import { describe, expect, it, vi } from 'vitest';
import { APP_VERSION } from '../src/config';
import {
  convertISBN10to13,
  formatISBN,
  isValidISBN10,
  isValidISBN13,
  normalizeISBN,
} from '../src/utils/isbn';
import { migrateData, needsMigration } from '../src/utils/migration';
import { cleanText, parseSmartPaste } from '../src/utils/text-parser';

describe('isbn utils', () => {
  it('validates and converts ISBN formats', () => {
    const isbn10 = '0306406152';
    const isbn13 = '9780306406157';

    expect(isValidISBN10(isbn10)).toBe(true);
    expect(isValidISBN10('0306406153')).toBe(false);
    expect(isValidISBN13(isbn13)).toBe(true);
    expect(isValidISBN13('9780306406158')).toBe(false);
    expect(convertISBN10to13(isbn10)).toBe(isbn13);
    expect(normalizeISBN('0-306-40615-2')).toBe(isbn13);
    expect(normalizeISBN('invalid')).toBe('invalid');
  });

  it('formats ISBN strings with hyphens', () => {
    expect(formatISBN('9780306406157')).toBe('978-0-30640-615-7');
    expect(formatISBN('0306406152')).toBe('0-3064-0615-2');
  });
});

describe('parseSmartPaste', () => {
  it('parses json input', () => {
    const text = JSON.stringify({
      title: 'Json Title',
      author: 'Json Author',
      isbn: '123',
      publisher: 'Pub',
      publishDate: '2020',
    });

    expect(parseSmartPaste(text)).toEqual({
      title: 'Json Title',
      author: 'Json Author',
      isbn: '123',
      publisher: 'Pub',
      publishDate: '2020',
    });
  });

  it('parses key-value input', () => {
    const text = ['Title: The Book', 'Author: Bob', 'ISBN: 0-306-40615-2', 'Year: 2021'].join('\n');

    expect(parseSmartPaste(text)).toEqual({
      title: 'The Book',
      author: 'Bob',
      isbn: '0306406152',
      publishDate: '2021',
    });
  });

  it('parses plain text input', () => {
    const text = ['Plain Title', 'Plain Author', '9780306406157'].join('\n');

    expect(parseSmartPaste(text)).toEqual({
      title: 'Plain Title',
      author: 'Plain Author',
      isbn: '9780306406157',
    });
  });
});

describe('cleanText', () => {
  it('normalizes whitespace', () => {
    expect(cleanText('  Hello   world \n  ok ')).toBe('Hello world ok');
  });
});

describe('migration', () => {
  it('identifies when migration is needed', () => {
    expect(needsMigration({})).toBe(true);
    expect(needsMigration({ version: APP_VERSION })).toBe(false);
  });

  it('applies migrations in order', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const input = {
      version: '1.0.0',
      settings: {
        categories: ['Other'],
      },
    };
    const migrated = migrateData(input) as unknown as {
      version?: string;
      settings?: { categories?: string[] };
    };

    expect(migrated.version).toBe('1.1.0');
    expect(migrated.settings?.categories).toContain('Wishlist');
    warnSpy.mockRestore();
  });
});
