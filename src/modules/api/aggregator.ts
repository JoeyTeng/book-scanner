import type { BookDataSource } from '../../types';
import { searchGoogleBooks } from './google-books';
import { searchOpenLibrary } from './open-library';
import { normalizeISBN } from '../../utils/isbn';

/**
 * Aggregate book data from multiple sources
 */
export async function aggregateBookData(query: string): Promise<BookDataSource[]> {
  const normalizedQuery = normalizeISBN(query);

  try {
    // Fetch from both APIs in parallel
    const [googleResults, openLibraryResults] = await Promise.all([
      searchGoogleBooks(normalizedQuery),
      searchOpenLibrary(normalizedQuery)
    ]);

    // Combine and deduplicate results
    const allResults = [...googleResults, ...openLibraryResults];

    // Simple deduplication by title similarity
    const uniqueResults: BookDataSource[] = [];
    const seenTitles = new Set<string>();

    for (const result of allResults) {
      const normalizedTitle = result.title?.toLowerCase().trim();

      if (normalizedTitle && !seenTitles.has(normalizedTitle)) {
        seenTitles.add(normalizedTitle);
        uniqueResults.push(result);
      }
    }

    return uniqueResults;
  } catch (error) {
    console.error('Error aggregating book data:', error);
    return [];
  }
}

/**
 * Merge multiple data sources into a single best result
 * Prefers Google Books for most fields, but fills in gaps from other sources
 */
export function mergeSources(sources: BookDataSource[]): BookDataSource {
  const merged: BookDataSource = {
    source: sources.map(s => s.source).join(', ')
  };

  // Priority order: Google Books > Open Library
  const sortedSources = [...sources].sort((a, b) => {
    if (a.source === 'Google Books') return -1;
    if (b.source === 'Google Books') return 1;
    return 0;
  });

  // Merge fields, preferring non-empty values from higher priority sources
  for (const source of sortedSources) {
    if (!merged.title && source.title) merged.title = source.title;
    if (!merged.author && source.author) merged.author = source.author;
    if (!merged.publisher && source.publisher) merged.publisher = source.publisher;
    if (!merged.publishDate && source.publishDate) merged.publishDate = source.publishDate;
    if (!merged.cover && source.cover) merged.cover = source.cover;
    if (!merged.isbn && source.isbn) merged.isbn = source.isbn;
  }

  return merged;
}
