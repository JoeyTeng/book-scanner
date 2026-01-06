import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Book, BookList } from '../src/types';
import type { BookListExportFormat, ExportedBook } from '../src/modules/book-list-export';
import type { ImportStrategy, ImportSnapshot } from '../src/modules/book-list-import';

let store: { books: Book[]; lists: BookList[] };
let listCounter = 0;
let uuidCounter = 0;

const storageMock = vi.hoisted(() => ({
  getBookLists: vi.fn(),
  getBooks: vi.fn(),
  getBook: vi.fn(),
  createBookList: vi.fn(),
  deleteBookList: vi.fn(),
  addBookToList: vi.fn(),
  updateBookComment: vi.fn(),
  updateBook: vi.fn(),
  addBook: vi.fn(),
  deleteBook: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  bookLists: {
    put: vi.fn(),
  },
}));

vi.mock('../src/modules/storage', () => ({
  storage: storageMock,
}));

vi.mock('../src/modules/db', () => ({
  db: dbMock,
}));

import {
  createSnapshot,
  detectConflicts,
  executeImport,
  parseImportFile,
  restoreSnapshot,
} from '../src/modules/book-list-import';

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

function makeExportedBook(overrides: Partial<ExportedBook> = {}): ExportedBook {
  return {
    title: 'Imported Title',
    author: 'Imported Author',
    isbn: '111',
    publisher: 'Imported Pub',
    publishDate: '2024',
    coverUrl: 'https://example.com/cover',
    comment: 'imported',
    addedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

function makeExportData(lists: BookListExportFormat['lists']): BookListExportFormat {
  return {
    version: 3,
    exportedAt: new Date(0).toISOString(),
    lists,
  };
}

describe('book list import', () => {
  let uuidSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = { books: [], lists: [] };
    listCounter = 0;
    uuidCounter = 0;

    storageMock.getBookLists.mockImplementation(async () => store.lists);
    storageMock.getBooks.mockImplementation(async () => store.books);
    storageMock.getBook.mockImplementation(async (id: string) =>
      store.books.find((book) => book.id === id)
    );
    storageMock.createBookList.mockImplementation(async (name: string, description?: string) => {
      const list: BookList = {
        id: `list-${++listCounter}`,
        name,
        description,
        books: [],
        createdAt: 0,
        updatedAt: 0,
      };
      store.lists.push(list);
      return list;
    });
    storageMock.deleteBookList.mockImplementation(async (id: string) => {
      store.lists = store.lists.filter((list) => list.id !== id);
    });
    storageMock.addBookToList.mockImplementation(
      async (listId: string, bookId: string, comment?: string) => {
        const list = store.lists.find((item) => item.id === listId);
        if (!list) return;
        if (!list.books.some((entry) => entry.bookId === bookId)) {
          list.books.push({
            bookId,
            comment,
            addedAt: 0,
          });
        }
      }
    );
    storageMock.updateBookComment.mockImplementation(
      async (listId: string, bookId: string, comment: string) => {
        const list = store.lists.find((item) => item.id === listId);
        const entry = list?.books.find((item) => item.bookId === bookId);
        if (entry) {
          entry.comment = comment;
        }
      }
    );
    storageMock.updateBook.mockImplementation(async (id: string, updates: Partial<Book>) => {
      const book = store.books.find((item) => item.id === id);
      if (book) {
        Object.assign(book, updates);
      }
    });
    storageMock.addBook.mockImplementation(async (book: Book) => {
      store.books.push(book);
    });
    storageMock.deleteBook.mockImplementation(async (id: string) => {
      store.books = store.books.filter((item) => item.id !== id);
    });

    uuidSpy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `uuid-${++uuidCounter}`);
  });

  it('parses import file formats and validates versions', async () => {
    const data = makeExportData([]);
    const validFile = new File([JSON.stringify(data)], 'import.json', {
      type: 'application/json',
    });
    await expect(parseImportFile(validFile)).resolves.toEqual(data);

    const invalidFile = new File(['{bad'], 'import.json', { type: 'application/json' });
    await expect(parseImportFile(invalidFile)).rejects.toThrow('Invalid JSON file');

    const unsupported = new File(
      [
        JSON.stringify({
          version: 1,
          exportedAt: new Date(0).toISOString(),
          lists: [],
        }),
      ],
      'import.json',
      { type: 'application/json' }
    );
    await expect(parseImportFile(unsupported)).rejects.toThrow('Unsupported version: 1');
  });

  it('detects list name and book conflicts without duplicates', async () => {
    store.lists = [makeList('list-1', 'Reading')];
    store.books = [
      makeBook('book-1', { isbn: '111', title: 'Alpha', author: 'Alice' }),
      makeBook('book-2', { isbn: '', title: 'Bravo', author: 'Bob' }),
    ];

    const imported = makeExportData([
      {
        id: 'i1',
        name: 'Reading',
        description: 'desc',
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        books: [
          makeExportedBook({ isbn: '111', title: 'Alpha', author: 'Alice' }),
          makeExportedBook({ isbn: '', title: 'Bravo', author: 'Bob' }),
        ],
      },
      {
        id: 'i2',
        name: 'Other',
        description: 'desc',
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        books: [
          makeExportedBook({ isbn: '111', title: 'Alpha', author: 'Alice' }),
          makeExportedBook({ isbn: '', title: 'Bravo', author: 'Bob' }),
        ],
      },
    ]);

    const conflicts = await detectConflicts(imported);

    expect(conflicts.listNameConflicts).toHaveLength(1);
    expect(conflicts.listNameConflicts[0]?.suggestedName).toBe('Reading (2)');
    expect(conflicts.bookConflicts).toHaveLength(2);
    expect(conflicts.bookConflicts.map((item) => item.matchType)).toEqual(
      expect.arrayContaining(['isbn', 'title-author'])
    );
  });

  it('renames imported list and creates new book entries', async () => {
    store.lists = [makeList('list-1', 'Favorites')];

    const imported = makeExportData([
      {
        id: 'i1',
        name: 'Favorites',
        description: 'desc',
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        books: [makeExportedBook({ comment: 'imported' })],
      },
    ]);

    const strategy: ImportStrategy = {
      defaultListAction: 'rename',
      defaultBookAction: 'merge',
      defaultCommentMerge: 'import',
      defaultFieldMerge: 'non-empty',
    };

    const snapshot = await createSnapshot(imported, strategy);
    const result = await executeImport(imported, strategy, snapshot);

    expect(result.success).toBe(true);
    expect(result.imported.lists).toBe(1);
    expect(result.imported.booksAdded).toBe(1);
    expect(store.lists.some((list) => list.name === 'Favorites (2)')).toBe(true);
    expect(snapshot.addedListIds).toHaveLength(1);
    expect(snapshot.addedBookIds).toEqual(['uuid-1']);
  });

  it('merges existing books and comments when lists are merged', async () => {
    store.books = [
      makeBook('book-1', {
        isbn: '111',
        publisher: 'Local Pub',
        publishDate: '2020',
        cover: 'local',
      }),
    ];
    store.lists = [
      makeList('list-1', 'Reading', [
        {
          bookId: 'book-1',
          comment: 'local',
          addedAt: 0,
        },
      ]),
    ];

    const imported = makeExportData([
      {
        id: 'i1',
        name: 'Reading',
        description: 'desc',
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        books: [
          makeExportedBook({
            isbn: '111',
            publisher: 'Imported Pub',
            publishDate: '2024',
            coverUrl: 'imported',
            comment: 'imported',
          }),
        ],
      },
    ]);

    const strategy: ImportStrategy = {
      defaultListAction: 'merge',
      defaultBookAction: 'merge',
      defaultCommentMerge: 'both',
      defaultFieldMerge: 'import',
    };

    const snapshot = await createSnapshot(imported, strategy);
    const result = await executeImport(imported, strategy, snapshot);

    expect(result.success).toBe(true);
    expect(result.imported.lists).toBe(0);
    expect(result.imported.booksMerged).toBe(1);
    expect(storageMock.createBookList).not.toHaveBeenCalled();
    expect(storageMock.updateBook).toHaveBeenCalledWith('book-1', {
      isbn: '111',
      publisher: 'Imported Pub',
      publishDate: '2024',
      cover: 'imported',
    });
    expect(storageMock.updateBookComment).toHaveBeenCalledWith(
      'list-1',
      'book-1',
      'local\n\nimported'
    );
  });

  it('restores snapshot state for undo', async () => {
    const snapshot: ImportSnapshot = {
      timestamp: Date.now(),
      addedBookIds: ['book-new'],
      addedListIds: ['list-new'],
      replacedLists: [
        {
          id: 'list-old',
          fullData: makeList('list-old', 'Old'),
        },
      ],
      modifiedBooks: [
        {
          id: 'book-1',
          metadataBefore: { publisher: 'before' },
        },
      ],
      modifiedLists: [
        {
          id: 'list-merge',
          fullDataBefore: makeList('list-merge', 'Merged'),
        },
      ],
    };

    await restoreSnapshot(snapshot);

    expect(storageMock.deleteBook).toHaveBeenCalledWith('book-new');
    expect(storageMock.deleteBookList).toHaveBeenCalledWith('list-new');
    expect(dbMock.bookLists.put).toHaveBeenCalledWith(expect.objectContaining({ id: 'list-old' }));
    expect(dbMock.bookLists.put).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'list-merge' })
    );
    expect(storageMock.updateBook).toHaveBeenCalledWith('book-1', {
      publisher: 'before',
    });
  });

  afterEach(() => {
    uuidSpy.mockRestore();
  });
});
