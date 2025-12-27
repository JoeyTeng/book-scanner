import type { Book } from '../types';

/**
 * Parse pasted text and extract book information
 * Supports multiple formats:
 * 1. Key-value pairs (Title: xxx\nAuthor: xxx)
 * 2. JSON snippet
 * 3. Plain text (first line = title, second line = author)
 */
export function parseSmartPaste(text: string): Partial<Book> {
  const result: Partial<Book> = {};

  // Try JSON format first
  try {
    const json = JSON.parse(text);
    if (json.title) result.title = json.title;
    if (json.author) result.author = json.author;
    if (json.isbn) result.isbn = json.isbn;
    if (json.publisher) result.publisher = json.publisher;
    if (json.publishDate) result.publishDate = json.publishDate;
    return result;
  } catch {
    // Not JSON, continue with other formats
  }

  // Try key-value pairs format
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  const kvPattern = /^(title|author|isbn|publisher|publish date|date|year)[\s:：]+(.+)$/i;

  let foundKV = false;
  for (const line of lines) {
    const match = line.match(kvPattern);
    if (match) {
      foundKV = true;
      const key = match[1].toLowerCase().replace(/\s+/g, '');
      const value = match[2].trim();

      switch (key) {
        case 'title':
          result.title = value;
          break;
        case 'author':
          result.author = value;
          break;
        case 'isbn':
          result.isbn = value.replace(/[^0-9X]/gi, '');
          break;
        case 'publisher':
          result.publisher = value;
          break;
        case 'publishdate':
        case 'date':
        case 'year':
          result.publishDate = value;
          break;
      }
    }
  }

  if (foundKV) {
    return result;
  }

  // Fallback to plain text format
  if (lines.length >= 1) {
    result.title = lines[0];
  }
  if (lines.length >= 2) {
    result.author = lines[1];
  }
  if (lines.length >= 3) {
    // Check if third line looks like ISBN
    const possibleISBN = lines[2].replace(/[^0-9X]/gi, '');
    if (possibleISBN.length === 10 || possibleISBN.length === 13) {
      result.isbn = possibleISBN;
    }
  }

  return result;
}

/**
 * Clean and normalize text fields
 */
export function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}
