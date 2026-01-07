import { describe, expect, it } from 'vitest';
import { searchBooks, sortBooks } from '../src/modules/search';
import type { Book, SearchFilters } from '../src/types';

function makeBook(id: string, overrides: Partial<Book>): Book {
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

describe('searchBooks', () => {
  it('filters by query, category, and status', () => {
    const books = [
      makeBook('1', {
        title: 'Rust Book',
        author: 'Alice',
        tags: ['Systems'],
        categories: ['tech'],
        status: 'read',
      }),
      makeBook('2', {
        title: 'Gardening',
        author: 'Bob',
        tags: ['Outdoor'],
        categories: ['home'],
        status: 'reading',
      }),
      makeBook('3', {
        title: 'Cooking',
        author: 'Cara',
        tags: ['Food'],
        categories: ['home'],
        status: 'want',
      }),
    ];

    const queryOnly: SearchFilters = { query: 'rust', category: 'all', status: 'all' };
    expect(searchBooks(books, queryOnly).map((book) => book.id)).toEqual(['1']);

    const combined: SearchFilters = { query: 'out', category: 'home', status: 'reading' };
    expect(searchBooks(books, combined).map((book) => book.id)).toEqual(['2']);
  });
});

describe('sortBooks', () => {
  it('sorts by title, addedAt, and publishDate', () => {
    const books = [
      makeBook('a', {
        title: 'b',
        author: 'Charlie',
        addedAt: 100,
        publishDate: '2020-01-02',
      }),
      makeBook('b', {
        title: 'A',
        author: 'alice',
        addedAt: 200,
      }),
      makeBook('c', {
        title: 'c',
        author: 'Bob',
        addedAt: 150,
        publishDate: '2019-01-01',
      }),
    ];

    expect(sortBooks(books, 'title', 'asc').map((book) => book.id)).toEqual(['b', 'a', 'c']);
    expect(sortBooks(books, 'addedAt', 'desc').map((book) => book.id)).toEqual(['b', 'c', 'a']);
    expect(sortBooks(books, 'publishDate', 'asc').map((book) => book.id)).toEqual(['b', 'c', 'a']);
  });
});
