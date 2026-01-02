import { GOOGLE_BOOKS_API_URL } from '../../config';
import { storage } from '../storage';
import type { BookDataSource } from '../../types';

interface GoogleBooksIndustryIdentifier {
  type?: string;
  identifier?: string;
}

interface GoogleBooksImageLinks {
  thumbnail?: string;
}

interface GoogleBooksVolumeInfo {
  title?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  imageLinks?: GoogleBooksImageLinks;
  industryIdentifiers?: GoogleBooksIndustryIdentifier[];
}

interface GoogleBooksItem {
  volumeInfo?: GoogleBooksVolumeInfo;
}

interface GoogleBooksResponse {
  items?: GoogleBooksItem[];
}

export async function searchGoogleBooks(query: string): Promise<BookDataSource[]> {
  const apiKey = await storage.getGoogleBooksApiKey();

  if (!apiKey) {
    console.warn('Google Books API key not set');
    return [];
  }

  try {
    const url = `${GOOGLE_BOOKS_API_URL}?q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=5`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`);
    }

    const data = (await response.json()) as GoogleBooksResponse;

    if (!data.items || data.items.length === 0) {
      return [];
    }

    return parseGoogleBooksItems(data.items);
  } catch (error) {
    console.error('Google Books API error:', error);
    return [];
  }
}

export async function searchGoogleBooksByTitle(title: string): Promise<BookDataSource[]> {
  const apiKey = await storage.getGoogleBooksApiKey();

  if (!apiKey) {
    console.warn('Google Books API key not set');
    return [];
  }

  try {
    const url = `${GOOGLE_BOOKS_API_URL}?q=intitle:${encodeURIComponent(
      title
    )}&key=${apiKey}&maxResults=10`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`);
    }

    const data = (await response.json()) as GoogleBooksResponse;

    if (!data.items || data.items.length === 0) {
      return [];
    }

    return parseGoogleBooksItems(data.items);
  } catch (error) {
    console.error('Google Books API error:', error);
    return [];
  }
}

function parseGoogleBooksItems(items: GoogleBooksItem[]): BookDataSource[] {
  return items.map((item) => {
    const volumeInfo = item.volumeInfo;

    return {
      title: volumeInfo?.title,
      author: volumeInfo?.authors ? volumeInfo.authors.join(', ') : undefined,
      publisher: volumeInfo?.publisher,
      publishDate: volumeInfo?.publishedDate,
      cover: volumeInfo?.imageLinks?.thumbnail?.replace('http://', 'https://'),
      isbn: extractISBN(volumeInfo?.industryIdentifiers),
      source: 'Google Books',
    };
  });
}

function extractISBN(identifiers?: GoogleBooksIndustryIdentifier[]): string | undefined {
  if (!identifiers) return undefined;

  // Prefer ISBN_13 over ISBN_10
  const isbn13 = identifiers.find((id) => id.type === 'ISBN_13');
  if (isbn13?.identifier) return isbn13.identifier;

  const isbn10 = identifiers.find((id) => id.type === 'ISBN_10');
  if (isbn10?.identifier) return isbn10.identifier;

  return undefined;
}
