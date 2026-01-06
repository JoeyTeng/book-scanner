import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storageMock = vi.hoisted(() => ({
  getGoogleBooksApiKey: vi.fn(),
  getISBNdbApiKey: vi.fn(),
}));

vi.mock('../src/modules/storage', () => ({
  storage: storageMock,
}));

import { searchGoogleBooks, searchGoogleBooksByTitle } from '../src/modules/api/google-books';
import { searchOpenLibrary, searchOpenLibraryByTitle } from '../src/modules/api/open-library';
import { getCrossrefBookByISBN, searchCrossrefByTitle } from '../src/modules/api/crossref';
import { getISBNdbBookByISBN, searchISBNdbByTitle } from '../src/modules/api/isbndb';
import {
  getInternetArchiveBookByISBN,
  searchInternetArchiveByTitle,
} from '../src/modules/api/internet-archive';

const fetchMock = vi.fn();

function mockFetchJson(data: unknown, ok = true, status = 200): void {
  fetchMock.mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
  } as unknown as Response);
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('google books', () => {
  it('returns empty when api key is missing', async () => {
    storageMock.getGoogleBooksApiKey.mockResolvedValue(undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await searchGoogleBooks('rust');

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns empty on non-ok response', async () => {
    storageMock.getGoogleBooksApiKey.mockResolvedValue('key');
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await searchGoogleBooks('rust');

    expect(result).toEqual([]);
    errorSpy.mockRestore();
  });

  it('parses google books items', async () => {
    storageMock.getGoogleBooksApiKey.mockResolvedValue('key');
    mockFetchJson({
      items: [
        {
          volumeInfo: {
            title: 'Book',
            authors: ['Alice', 'Bob'],
            publisher: 'Pub',
            publishedDate: '2020',
            imageLinks: { thumbnail: 'http://example.com/cover.jpg' },
            industryIdentifiers: [
              { type: 'ISBN_10', identifier: '10' },
              { type: 'ISBN_13', identifier: '13' },
            ],
          },
        },
      ],
    });

    const result = await searchGoogleBooksByTitle('Book');

    expect(result).toEqual([
      {
        title: 'Book',
        author: 'Alice, Bob',
        publisher: 'Pub',
        publishDate: '2020',
        cover: 'https://example.com/cover.jpg',
        isbn: '13',
        source: 'Google Books',
      },
    ]);
  });
});

describe('open library', () => {
  it('returns empty when docs missing', async () => {
    mockFetchJson({ docs: [] });

    const result = await searchOpenLibrary('rust');

    expect(result).toEqual([]);
  });

  it('returns empty on fetch error', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await searchOpenLibrary('rust');

    expect(result).toEqual([]);
    errorSpy.mockRestore();
  });

  it('parses open library docs', async () => {
    mockFetchJson({
      docs: [
        {
          title: 'Open Book',
          author_name: ['Ada', 'Bob'],
          publisher: ['Pub1', 'Pub2'],
          first_publish_year: 1999,
          cover_i: 123,
          isbn: ['978', '111'],
        },
      ],
    });

    const result = await searchOpenLibraryByTitle('Open Book');

    expect(result).toEqual([
      {
        title: 'Open Book',
        author: 'Ada, Bob',
        publisher: 'Pub1',
        publishDate: '1999',
        cover: 'https://covers.openlibrary.org/b/id/123-M.jpg',
        isbn: '978',
        source: 'Open Library',
      },
    ]);
  });
});

describe('crossref', () => {
  it('returns null when lookup fails', async () => {
    fetchMock.mockResolvedValue({ ok: false } as Response);

    const result = await getCrossrefBookByISBN('978');

    expect(result).toBeNull();
  });

  it('returns empty on fetch error for title search', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await searchCrossrefByTitle('Crossref Book');

    expect(result).toEqual([]);
    errorSpy.mockRestore();
  });

  it('parses crossref items and filters missing titles', async () => {
    mockFetchJson({
      message: {
        items: [
          {
            title: ['Crossref Book'],
            ISBN: ['978'],
            author: [{ given: 'Ada', family: 'Lovelace' }],
            publisher: 'Pub',
            published: { 'date-parts': [[2022]] },
          },
          {
            ISBN: ['000'],
          },
        ],
      },
    });

    const result = await searchCrossrefByTitle('Crossref Book');

    expect(result).toEqual([
      {
        isbn: '978',
        title: 'Crossref Book',
        author: 'Ada Lovelace',
        publisher: 'Pub',
        publishDate: '2022',
        cover: '',
        source: 'Crossref',
      },
    ]);
  });
});

describe('isbndb', () => {
  it('returns null when api key is missing', async () => {
    storageMock.getISBNdbApiKey.mockResolvedValue(undefined);

    const result = await getISBNdbBookByISBN('978');

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns empty on non-ok response for title search', async () => {
    storageMock.getISBNdbApiKey.mockResolvedValue('key');
    fetchMock.mockResolvedValue({ ok: false } as Response);

    const result = await searchISBNdbByTitle('ISBNdb Book');

    expect(result).toEqual([]);
  });

  it('parses isbndb results', async () => {
    storageMock.getISBNdbApiKey.mockResolvedValue('key');
    mockFetchJson({
      books: [
        {
          title: 'ISBNdb Book',
          isbn13: '978',
          authors: ['A', 'B'],
          publisher: 'Pub',
          date_published: '2021',
          image: 'cover',
        },
      ],
    });

    const result = await searchISBNdbByTitle('ISBNdb Book');

    expect(result).toEqual([
      {
        isbn: '978',
        title: 'ISBNdb Book',
        author: 'A, B',
        publisher: 'Pub',
        publishDate: '2021',
        cover: 'cover',
        source: 'ISBNdb',
      },
    ]);
  });
});

describe('internet archive', () => {
  it('returns null when docs missing', async () => {
    mockFetchJson({ response: { docs: [] } });

    const result = await getInternetArchiveBookByISBN('978');

    expect(result).toBeNull();
  });

  it('returns empty on fetch error for title search', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await searchInternetArchiveByTitle('Archive Book');

    expect(result).toEqual([]);
    errorSpy.mockRestore();
  });

  it('parses internet archive docs', async () => {
    mockFetchJson({
      response: {
        docs: [
          {
            identifier: 'id',
            title: 'Archive Book',
            creator: ['Author'],
            publisher: 'Pub',
            date: '2000',
          },
        ],
      },
    });

    const result = await searchInternetArchiveByTitle('Archive Book');

    expect(result).toEqual([
      {
        isbn: '',
        title: 'Archive Book',
        author: 'Author',
        publisher: 'Pub',
        publishDate: '2000',
        cover: 'https://archive.org/services/img/id',
        source: 'Internet Archive',
      },
    ]);
  });
});
