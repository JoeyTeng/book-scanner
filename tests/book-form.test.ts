// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Book } from '../src/types';

const storageMock = vi.hoisted(() => ({
  updateBook: vi.fn().mockResolvedValue(undefined),
  getCategoriesSorted: vi.fn().mockResolvedValue([]),
  touchCategory: vi.fn().mockResolvedValue(undefined),
  getBookLists: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/modules/storage', () => ({
  storage: storageMock,
}));

vi.mock('../src/modules/i18n', () => ({
  i18n: {
    t: (key: string) => key,
  },
}));

vi.mock('../src/modules/llm', () => ({
  llmService: {
    isTextConfigured: vi.fn().mockResolvedValue(false),
  },
}));

import { BookForm } from '../src/components/book-form';

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    isbn: 'old-isbn',
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

describe('BookForm', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="modal-container"></div>';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates ISBN when editing a book', async () => {
    const book = makeBook();
    const form = new BookForm(() => {});
    await form.showForEdit(book);

    const isbnInput = document.querySelector<HTMLInputElement>('#input-isbn');
    const titleInput = document.querySelector<HTMLInputElement>('#input-title');
    const authorInput = document.querySelector<HTMLInputElement>('#input-author');
    const statusInput = document.querySelector<HTMLSelectElement>('#input-status');
    const formElement = document.querySelector<HTMLFormElement>('#book-form');

    if (!isbnInput || !titleInput || !authorInput || !statusInput || !formElement) {
      throw new Error('Form inputs not found');
    }

    isbnInput.value = 'new-isbn';
    titleInput.value = 'Title';
    authorInput.value = 'Author';
    statusInput.value = 'read';

    formElement.dispatchEvent(new Event('submit'));

    expect(storageMock.updateBook).toHaveBeenCalledWith('book-1', expect.any(Object));
    const updateCall = storageMock.updateBook.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(updateCall.isbn).toBe('new-isbn');
  });
});
