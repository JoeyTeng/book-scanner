// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Book, BookList } from '../src/types';

const storageMock = vi.hoisted(() => ({
  getBookList: vi.fn(),
  getBookLists: vi.fn(),
  getBook: vi.fn(),
}));

vi.mock('../src/modules/storage', () => ({
  storage: storageMock,
}));

import {
  exportAllBookLists,
  exportBookList,
  exportBookLists,
} from '../src/modules/book-list-export';

function makeBook(id: string, overrides: Partial<Book> = {}): Book {
  return {
    id,
    isbn: `isbn-${id}`,
    title: `Title ${id}`,
    author: `Author ${id}`,
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

function makeList(id: string, name: string, books: BookList['books'] = []): BookList {
  return {
    id,
    name,
    description: 'desc',
    books,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('book list export', () => {
  let lastBlob: Blob | null = null;
  let createdAnchors: HTMLAnchorElement[] = [];
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let createElementSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-02T00:00:00Z'));

    createdAnchors = [];
    lastBlob = null;

    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      lastBlob = blob as Blob;
      return 'blob:mock';
    });
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const originalCreateElement = document.createElement.bind(document);
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const element = originalCreateElement(tag);
      if (tag === 'a') {
        createdAnchors.push(element as HTMLAnchorElement);
        vi.spyOn(element, 'click').mockImplementation(() => {});
      }
      return element;
    });
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    createElementSpy.mockRestore();
  });

  it('exports a single list with sanitized filename and public fields', async () => {
    const list = makeList('list-1', 'My/Books:2024', [
      {
        bookId: 'book-1',
        comment: 'note',
        addedAt: Date.parse('2024-01-01T00:00:00Z'),
      },
    ]);
    const book = makeBook('book-1', {
      publisher: 'Pub',
      publishDate: '2020',
      cover: 'cover',
      notes: 'secret',
      recommendation: 'internal',
    });

    storageMock.getBookList.mockResolvedValue(list);
    storageMock.getBook.mockResolvedValue(book);

    await exportBookList('list-1');

    expect(createdAnchors[0]?.download).toBe('My_Books_2024_2024-01-02.json');
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(await (lastBlob as Blob).text()) as {
      lists: Array<{ books: Array<Record<string, unknown>> }>;
    };
    const exportedBook = payload.lists[0]?.books[0] ?? {};

    expect(exportedBook).not.toHaveProperty('notes');
    expect(exportedBook).not.toHaveProperty('recommendation');
    expect(exportedBook.comment).toBe('note');
  });

  it('exports multiple lists with combined filename', async () => {
    const listA = makeList('list-a', 'A');
    const listB = makeList('list-b', 'B');

    storageMock.getBookLists.mockResolvedValue([listA, listB]);

    await exportBookLists(['list-a', 'list-b']);

    expect(createdAnchors[0]?.download).toBe('book-lists_2024-01-02.json');
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
  });

  it('throws when exporting a single list that does not exist', async () => {
    storageMock.getBookList.mockResolvedValue(undefined);

    await expect(exportBookList('missing')).rejects.toThrow('Book list not found');
  });

  it('throws when exporting selected lists that do not match', async () => {
    storageMock.getBookLists.mockResolvedValue([makeList('list-a', 'A')]);

    await expect(exportBookLists(['list-x'])).rejects.toThrow('No book lists found');
  });

  it('throws when exporting all lists with no data', async () => {
    storageMock.getBookLists.mockResolvedValue([]);

    await expect(exportAllBookLists()).rejects.toThrow('No book lists to export');
  });
});
