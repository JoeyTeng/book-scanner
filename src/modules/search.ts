import type { Book, SearchFilters, SortField, SortOrder } from '../types';

/**
 * Search and filter books
 */
export function searchBooks(
  books: Book[],
  filters: SearchFilters
): Book[] {
  let results = [...books];

  // Text search
  if (filters.query) {
    const query = filters.query.toLowerCase();
    results = results.filter(book => {
      return (
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        book.isbn.includes(query) ||
        book.tags.some(tag => tag.toLowerCase().includes(query))
      );
    });
  }

  // Category filter
  if (filters.category && filters.category !== 'all') {
    results = results.filter(book =>
      book.categories.includes(filters.category!)
    );
  }

  // Status filter
  if (filters.status && filters.status !== 'all') {
    results = results.filter(book => book.status === filters.status);
  }

  return results;
}

/**
 * Sort books
 */
export function sortBooks(
  books: Book[],
  field: SortField,
  order: SortOrder
): Book[] {
  const sorted = [...books].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (field) {
      case 'addedAt':
        aValue = a.addedAt;
        bValue = b.addedAt;
        break;
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'author':
        aValue = a.author.toLowerCase();
        bValue = b.author.toLowerCase();
        break;
      case 'publishDate':
        aValue = a.publishDate || '';
        bValue = b.publishDate || '';
        break;
    }

    if (aValue < bValue) return order === 'asc' ? -1 : 1;
    if (aValue > bValue) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}
