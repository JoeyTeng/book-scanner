import { OPEN_LIBRARY_API_URL } from '../../config';
import type { BookDataSource } from '../../types';

export async function searchOpenLibrary(query: string): Promise<BookDataSource[]> {
  try {
    const url = `${OPEN_LIBRARY_API_URL}/search.json?q=${encodeURIComponent(query)}&limit=5`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Open Library API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.docs || data.docs.length === 0) {
      return [];
    }

    return parseOpenLibraryDocs(data.docs);
  } catch (error) {
    console.error('Open Library API error:', error);
    return [];
  }
}

export async function searchOpenLibraryByTitle(title: string): Promise<BookDataSource[]> {
  try {
    const url = `${OPEN_LIBRARY_API_URL}/search.json?title=${encodeURIComponent(title)}&limit=10`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Open Library API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.docs || data.docs.length === 0) {
      return [];
    }

    return parseOpenLibraryDocs(data.docs);
  } catch (error) {
    console.error('Open Library API error:', error);
    return [];
  }
}

function parseOpenLibraryDocs(docs: any[]): BookDataSource[] {
  return docs.map((doc: any) => ({
    title: doc.title,
    author: doc.author_name ? doc.author_name.join(', ') : undefined,
    publisher: doc.publisher ? doc.publisher[0] : undefined,
    publishDate: doc.first_publish_year?.toString(),
    cover: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${String(doc.cover_i)}-M.jpg`
      : undefined,
    isbn: doc.isbn ? doc.isbn[0] : undefined,
    source: 'Open Library',
  }));
}
