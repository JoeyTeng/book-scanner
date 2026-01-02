import type { BookDataSource } from '../../types';

/**
 * Search Internet Archive by ISBN
 */
export async function getInternetArchiveBookByISBN(isbn: string): Promise<BookDataSource | null> {
  try {
    const url = `https://archive.org/advancedsearch.php?q=isbn:${isbn}&fl[]=identifier,title,creator,publisher,date,language&output=json&rows=1`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json();
    const docs = data.response?.docs;

    if (!docs || docs.length === 0) return null;

    return parseInternetArchiveDoc(docs[0]);
  } catch (error) {
    console.error('Internet Archive ISBN lookup failed:', error);
    return null;
  }
}

/**
 * Search Internet Archive by title
 */
export async function searchInternetArchiveByTitle(title: string): Promise<BookDataSource[]> {
  try {
    const url = `https://archive.org/advancedsearch.php?q=title:(${encodeURIComponent(title)})&fl[]=identifier,title,creator,publisher,date,language&output=json&rows=10`;
    const response = await fetch(url);

    if (!response.ok) return [];

    const data = await response.json();
    const docs = data.response?.docs || [];

    return docs
      .map(parseInternetArchiveDoc)
      .filter((book: BookDataSource | null): book is BookDataSource => book !== null);
  } catch (error) {
    console.error('Internet Archive title search failed:', error);
    return [];
  }
}

/**
 * Parse Internet Archive document to BookDataSource
 */
function parseInternetArchiveDoc(doc: any): BookDataSource | null {
  if (!doc.title) return null;

  return {
    isbn: '',
    title: doc.title || '',
    author: Array.isArray(doc.creator) ? doc.creator[0] : doc.creator || '',
    publisher: doc.publisher || '',
    publishDate: doc.date || '',
    cover: doc.identifier ? `https://archive.org/services/img/${String(doc.identifier)}` : '',
    source: 'Internet Archive',
  };
}
