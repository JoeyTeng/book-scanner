import type { BookDataSource } from '../../types';

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

    const data = await response.json();
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

    const data = await response.json();
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
function parseCrossrefItem(item: any): BookDataSource | null {
  if (!item.title || !item.title[0]) return null;

  return {
    isbn: item.ISBN ? item.ISBN[0] : '',
    title: item.title[0] || '',
    author: item.author
      ? item.author
          .map((a: any) => `${String(a.given || '')} ${String(a.family || '')}`.trim())
          .join(', ')
      : '',
    publisher: item.publisher || '',
    publishDate: item.published?.['date-parts']?.[0]?.[0]?.toString() || '',
    cover: '',
    source: 'Crossref',
  };
}
