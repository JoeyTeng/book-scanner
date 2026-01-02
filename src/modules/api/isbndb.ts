import { storage } from '../storage';
import type { BookDataSource } from '../../types';

interface ISBNdbResponse {
  book?: ISBNdbBook;
}

interface ISBNdbListResponse {
  books?: ISBNdbBook[];
}

interface ISBNdbBook {
  title?: string;
  isbn13?: string;
  isbn?: string;
  authors?: string[] | string;
  publisher?: string;
  date_published?: string;
  image?: string;
}

/**
 * Search ISBNdb by ISBN
 * Requires API key from https://isbndb.com
 */
export async function getISBNdbBookByISBN(isbn: string): Promise<BookDataSource | null> {
  const apiKey = await storage.getISBNdbApiKey();
  if (!apiKey) return null;

  try {
    const url = `https://api2.isbndb.com/book/${isbn}`;
    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as ISBNdbResponse;
    const book = data.book;

    if (!book) return null;

    return parseISBNdbBook(book);
  } catch (error) {
    console.error('ISBNdb ISBN lookup failed:', error);
    return null;
  }
}

/**
 * Search ISBNdb by title
 */
export async function searchISBNdbByTitle(title: string): Promise<BookDataSource[]> {
  const apiKey = await storage.getISBNdbApiKey();
  if (!apiKey) return [];

  try {
    const url = `https://api2.isbndb.com/books/${encodeURIComponent(title)}?page=1&pageSize=10`;
    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
      },
    });

    if (!response.ok) return [];

    const data = (await response.json()) as ISBNdbListResponse;
    const books = data.books || [];

    return books
      .map(parseISBNdbBook)
      .filter((book: BookDataSource | null): book is BookDataSource => book !== null);
  } catch (error) {
    console.error('ISBNdb title search failed:', error);
    return [];
  }
}

/**
 * Parse ISBNdb book to BookDataSource
 */
function parseISBNdbBook(book: ISBNdbBook): BookDataSource | null {
  if (!book.title) return null;

  return {
    isbn: book.isbn13 || book.isbn || '',
    title: book.title || '',
    author: Array.isArray(book.authors) ? book.authors.join(', ') : book.authors || '',
    publisher: book.publisher || '',
    publishDate: book.date_published || '',
    cover: book.image || '',
    source: 'ISBNdb',
  };
}
