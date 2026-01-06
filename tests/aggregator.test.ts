import { beforeEach, describe, expect, it, vi } from 'vitest';

const googleMock = vi.hoisted(() => ({
  searchGoogleBooks: vi.fn(),
  searchGoogleBooksByTitle: vi.fn(),
}));

const openLibraryMock = vi.hoisted(() => ({
  searchOpenLibrary: vi.fn(),
  searchOpenLibraryByTitle: vi.fn(),
}));

const internetArchiveMock = vi.hoisted(() => ({
  getInternetArchiveBookByISBN: vi.fn(),
  searchInternetArchiveByTitle: vi.fn(),
}));

const isbndbMock = vi.hoisted(() => ({
  getISBNdbBookByISBN: vi.fn(),
  searchISBNdbByTitle: vi.fn(),
}));

const crossrefMock = vi.hoisted(() => ({
  getCrossrefBookByISBN: vi.fn(),
  searchCrossrefByTitle: vi.fn(),
}));

vi.mock('../src/modules/api/google-books', () => googleMock);
vi.mock('../src/modules/api/open-library', () => openLibraryMock);
vi.mock('../src/modules/api/internet-archive', () => internetArchiveMock);
vi.mock('../src/modules/api/isbndb', () => isbndbMock);
vi.mock('../src/modules/api/crossref', () => crossrefMock);

import { aggregateBookData, mergeSources, searchBookByTitle } from '../src/modules/api/aggregator';

beforeEach(() => {
  vi.clearAllMocks();
  googleMock.searchGoogleBooks.mockResolvedValue([]);
  googleMock.searchGoogleBooksByTitle.mockResolvedValue([]);
  openLibraryMock.searchOpenLibrary.mockResolvedValue([]);
  openLibraryMock.searchOpenLibraryByTitle.mockResolvedValue([]);
  internetArchiveMock.getInternetArchiveBookByISBN.mockResolvedValue(null);
  internetArchiveMock.searchInternetArchiveByTitle.mockResolvedValue([]);
  isbndbMock.getISBNdbBookByISBN.mockResolvedValue(null);
  isbndbMock.searchISBNdbByTitle.mockResolvedValue([]);
  crossrefMock.getCrossrefBookByISBN.mockResolvedValue(null);
  crossrefMock.searchCrossrefByTitle.mockResolvedValue([]);
});

describe('aggregateBookData', () => {
  it('aggregates and deduplicates results', async () => {
    googleMock.searchGoogleBooks.mockResolvedValue([{ title: 'Book', source: 'Google Books' }]);
    openLibraryMock.searchOpenLibrary.mockResolvedValue([
      { title: 'book', source: 'Open Library' },
    ]);
    internetArchiveMock.getInternetArchiveBookByISBN.mockResolvedValue({
      title: 'Other',
      source: 'Internet Archive',
    });

    const result = await aggregateBookData('0-306-40615-2');

    expect(googleMock.searchGoogleBooks).toHaveBeenCalledWith('9780306406157');
    expect(openLibraryMock.searchOpenLibrary).toHaveBeenCalledWith('9780306406157');
    expect(result.map((item) => item.title)).toEqual(['Book', 'Other']);
  });
});

describe('searchBookByTitle', () => {
  it('returns empty when title is blank', async () => {
    const result = await searchBookByTitle('   ');

    expect(result).toEqual([]);
    expect(googleMock.searchGoogleBooksByTitle).not.toHaveBeenCalled();
  });

  it('deduplicates results across providers', async () => {
    googleMock.searchGoogleBooksByTitle.mockResolvedValue([
      { title: 'Same', source: 'Google Books' },
    ]);
    openLibraryMock.searchOpenLibraryByTitle.mockResolvedValue([
      { title: 'same', source: 'Open Library' },
    ]);
    crossrefMock.searchCrossrefByTitle.mockResolvedValue([{ title: 'Other', source: 'Crossref' }]);

    const result = await searchBookByTitle('Same');

    expect(result.map((item) => item.title)).toEqual(['Same', 'Other']);
  });
});

describe('mergeSources', () => {
  it('prefers google books but fills missing fields', () => {
    const merged = mergeSources([
      { source: 'Open Library', title: 'Open', author: 'Ada' },
      { source: 'Google Books', title: 'Google', cover: 'cover', isbn: 'isbn' },
      { source: 'Crossref', publisher: 'Pub' },
    ]);

    expect(merged).toEqual({
      source: 'Open Library, Google Books, Crossref',
      title: 'Google',
      author: 'Ada',
      publisher: 'Pub',
      cover: 'cover',
      isbn: 'isbn',
    });
  });
});
