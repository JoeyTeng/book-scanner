import type { BookDataSource } from '../../types';

interface CrossrefAuthor {
  given?: string;
  family?: string;
}

interface CrossrefPublished {
  'date-parts'?: number[][];
}

interface CrossrefItem {
  title?: string[];
  ISBN?: string[];
  author?: CrossrefAuthor[];
  publisher?: string;
  published?: CrossrefPublished;
}

interface CrossrefMessage {
  items?: CrossrefItem[];
}

interface CrossrefResponse {
  message?: CrossrefMessage;
}

/**
 * Search Crossref by ISBN (DOI-based academic publications)
 * Completely free, no API key required
 */
export async function getCrossrefBookByISBN(isbn: string): Promise<BookDataSource | null> {
  try {
    const url = `https://api.crossref.org/works?filter=isbn:${isbn}&rows=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BookScanner/1.0 (mailto:example@example.com)',
      },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as CrossrefResponse;
    const items = data.message?.items;

    if (!items || items.length === 0) return null;

    return parseCrossrefItem(items[0]);
  } catch (error) {
    console.error('Crossref ISBN lookup failed:', error);
    return null;
  }
}

/**
 * Search Crossref by title
 */
export async function searchCrossrefByTitle(title: string): Promise<BookDataSource[]> {
  try {
    const url = `https://api.crossref.org/works?query.title=${encodeURIComponent(title)}&rows=10&filter=type:book`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'BookScanner/1.0 (mailto:example@example.com)',
      },
    });

    if (!response.ok) return [];

    const data = (await response.json()) as CrossrefResponse;
    const items = data.message?.items || [];

    return items
      .map(parseCrossrefItem)
      .filter((book: BookDataSource | null): book is BookDataSource => book !== null);
  } catch (error) {
    console.error('Crossref title search failed:', error);
    return [];
  }
}

/**
 * Parse Crossref item to BookDataSource
 */
function parseCrossrefItem(item: CrossrefItem): BookDataSource | null {
  const title = item.title?.[0];
  if (!title) return null;

  return {
    isbn: item.ISBN ? item.ISBN[0] : '',
    title,
    author: item.author
      ? item.author
          .map((author) => `${String(author.given || '')} ${String(author.family || '')}`.trim())
          .join(', ')
      : '',
    publisher: item.publisher || '',
    publishDate: item.published?.['date-parts']?.[0]?.[0]?.toString() || '',
    cover: '',
    source: 'Crossref',
  };
}
