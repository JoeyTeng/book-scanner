import type { BookDataSource } from '../../types';
import { searchGoogleBooks, searchGoogleBooksByTitle } from "./google-books";
import { searchOpenLibrary, searchOpenLibraryByTitle } from "./open-library";
import {
  getInternetArchiveBookByISBN,
  searchInternetArchiveByTitle,
} from "./internet-archive";
import { getISBNdbBookByISBN, searchISBNdbByTitle } from "./isbndb";
import { getCrossrefBookByISBN, searchCrossrefByTitle } from "./crossref";
import { normalizeISBN } from "../../utils/isbn";

/**
 * Aggregate book data from multiple sources by ISBN
 */
export async function aggregateBookData(
  query: string
): Promise<BookDataSource[]> {
  const normalizedQuery = normalizeISBN(query);

  try {
    // Fetch from all APIs in parallel
    const [
      googleResults,
      openLibraryResults,
      internetArchiveResult,
      isbndbResult,
      crossrefResult,
    ] = await Promise.all([
      searchGoogleBooks(normalizedQuery),
      searchOpenLibrary(normalizedQuery),
      getInternetArchiveBookByISBN(normalizedQuery),
      getISBNdbBookByISBN(normalizedQuery),
      getCrossrefBookByISBN(normalizedQuery),
    ]);

    // Combine all results
    const allResults = [
      ...googleResults,
      ...openLibraryResults,
      ...(internetArchiveResult ? [internetArchiveResult] : []),
      ...(isbndbResult ? [isbndbResult] : []),
      ...(crossrefResult ? [crossrefResult] : []),
    ];

    return deduplicateResults(allResults);
  } catch (error) {
    console.error("Error aggregating book data:", error);
    return [];
  }
}

/**
 * Search books by title from multiple sources
 */
export async function searchBookByTitle(
  title: string
): Promise<BookDataSource[]> {
  if (!title.trim()) {
    return [];
  }

  try {
    // Fetch from all APIs in parallel
    const [
      googleResults,
      openLibraryResults,
      internetArchiveResults,
      isbndbResults,
      crossrefResults,
    ] = await Promise.all([
      searchGoogleBooksByTitle(title),
      searchOpenLibraryByTitle(title),
      searchInternetArchiveByTitle(title),
      searchISBNdbByTitle(title),
      searchCrossrefByTitle(title),
    ]);

    // Combine all results
    const allResults = [
      ...googleResults,
      ...openLibraryResults,
      ...internetArchiveResults,
      ...isbndbResults,
      ...crossrefResults,
    ];

    return deduplicateResults(allResults);
  } catch (error) {
    console.error("Error searching book by title:", error);
    return [];
  }
}

/**
 * Deduplicate results by title similarity
 */
function deduplicateResults(results: BookDataSource[]): BookDataSource[] {
  const uniqueResults: BookDataSource[] = [];
  const seenTitles = new Set<string>();

  for (const result of results) {
    const normalizedTitle = result.title?.toLowerCase().trim();

    if (normalizedTitle && !seenTitles.has(normalizedTitle)) {
      seenTitles.add(normalizedTitle);
      uniqueResults.push(result);
    }
  }

  return uniqueResults;
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
