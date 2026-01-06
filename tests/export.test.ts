import { describe, expect, it, vi } from 'vitest';
import type { Book } from '../src/types';

const storageMock = vi.hoisted(() => ({
  getBooks: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/modules/storage', () => ({
  storage: storageMock,
}));

import { exportAsCSV, exportAsMarkdown } from '../src/modules/export';

function makeBook(overrides: Partial<Book>): Book {
  return {
    id: 'book-1',
    isbn: 'isbn-1',
    title: 'Title',
    author: 'Author',
    categories: [],
    tags: [],
    status: 'read',
    notes: '',
    addedAt: 0,
    updatedAt: 0,
    source: [],
    ...overrides,
  };
}

describe('exportAsCSV', () => {
  it('escapes csv fields with commas, quotes, and newlines', async () => {
    const book = makeBook({
      title: 'Title, "quoted"\nline',
      publisher: 'Pub',
      publishDate: '2020-01-01',
      categories: ['Cat1', 'Cat2'],
      tags: ['Tag1', 'Tag2'],
      notes: 'Note "x"',
      cover: 'https://example.com/cover.png',
    });

    storageMock.getBooks.mockResolvedValue([book]);

    const csv = await exportAsCSV();
    const header =
      'Title,Author,ISBN,Publisher,Publish Date,Categories,Tags,Status,Notes,Cover URL,Added At,Updated At';

    expect(csv.startsWith(`${header}\n`)).toBe(true);
    expect(csv).toContain('"Title, ""quoted""\nline"');
    expect(csv).toContain('Cat1; Cat2');
    expect(csv).toContain('Tag1; Tag2');
    expect(csv).toContain('"Note ""x"""');
    expect(csv).toContain('https://example.com/cover.png');
    expect(csv).toContain(new Date(0).toISOString());
  });
});

describe('exportAsMarkdown', () => {
  it('groups by status and escapes markdown table cells', async () => {
    const wantBook = makeBook({
      id: 'want',
      isbn: '111',
      title: 'A|B',
      author: 'Author\\Name',
      publisher: 'Pub|Name',
      publishDate: '2024|01',
      status: 'want',
    });
    const readBook = makeBook({
      id: 'read',
      isbn: '222',
      title: 'Plain',
      author: 'Reader',
      status: 'read',
    });

    storageMock.getBooks.mockResolvedValue([wantBook, readBook]);

    const markdown = await exportAsMarkdown();

    expect(markdown).toContain('# My Book Collection');
    expect(markdown).toContain('Exported on:');
    expect(markdown).toContain('Total books: 2');
    expect(markdown).toContain('## Want (1)');
    expect(markdown).toContain('## Read (1)');
    expect(markdown).not.toContain('## Reading');
    expect(markdown).toContain('| A\\|B | Author\\\\Name | 111 | Pub\\|Name | 2024\\|01 |');
  });
});
