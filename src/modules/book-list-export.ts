import { storage } from './storage';
import type { BookList } from '../types';

/**
 * Export format for book lists
 */
export interface BookListExportFormat {
  version: number;
  exportedAt: string;
  lists: BookListExportData[];
}

export interface BookListExportData {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  books: ExportedBook[];
}

export interface ExportedBook {
  // Basic book info (copied from Book)
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publishDate?: string;
  coverUrl?: string;
  rating?: number;
  // Note: recommendation and notes are NOT included (private fields)

  // Book list specific info
  comment?: string;
  addedAt: string;
}

/**
 * Export a single book list to JSON file
 */
export async function exportBookList(listId: string): Promise<void> {
  const list = await storage.getBookList(listId);
  if (!list) {
    throw new Error('Book list not found');
  }

  const exportData = await buildExportData([list]);
  downloadJson(exportData, sanitizeFilename(`${list.name}_${getDateString()}.json`));
}

/**
 * Export multiple book lists to a single JSON file
 */
export async function exportBookLists(listIds: string[]): Promise<void> {
  const allLists = await storage.getBookLists();
  const lists = allLists.filter((list) => listIds.includes(list.id));

  if (lists.length === 0) {
    throw new Error('No book lists found');
  }

  const exportData = await buildExportData(lists);
  const filename =
    lists.length === 1
      ? sanitizeFilename(`${lists[0].name}_${getDateString()}.json`)
      : `book-lists_${getDateString()}.json`;

  downloadJson(exportData, filename);
}

/**
 * Export all book lists to JSON file
 */
export async function exportAllBookLists(): Promise<void> {
  const lists = await storage.getBookLists();

  if (lists.length === 0) {
    throw new Error('No book lists to export');
  }

  const exportData = await buildExportData(lists);
  downloadJson(exportData, `all-book-lists_${getDateString()}.json`);
}

/**
 * Build export data from book lists
 */
async function buildExportData(lists: BookList[]): Promise<BookListExportFormat> {
  const exportLists: BookListExportData[] = [];

  for (const list of lists) {
    const books: ExportedBook[] = [];

    for (const bookInList of list.books) {
      const book = await storage.getBook(bookInList.bookId);
      if (!book) {
        // Book has been deleted, skip it
        continue;
      }

      books.push({
        // Copy public fields only (exclude recommendation and notes)
        title: book.title,
        author: book.author,
        isbn: book.isbn,
        publisher: book.publisher,
        publishDate: book.publishDate,
        coverUrl: book.cover,
        // rating field doesn't exist in Book type, skip it
        // Book list specific
        comment: bookInList.comment,
        addedAt: new Date(bookInList.addedAt).toISOString(),
      });
    }

    exportLists.push({
      id: list.id,
      name: list.name,
      description: list.description,
      createdAt: new Date(list.createdAt).toISOString(),
      updatedAt: new Date(list.updatedAt).toISOString(),
      books,
    });
  }

  return {
    version: 3, // Current DB version
    exportedAt: new Date().toISOString(),
    lists: exportLists,
  };
}

/**
 * Trigger browser download of JSON data
 */
function downloadJson(data: BookListExportFormat, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Sanitize filename by replacing invalid characters
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[/\\:*?"<>|]/g, '_');
}

/**
 * Get current date as YYYY-MM-DD string
 */
function getDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
