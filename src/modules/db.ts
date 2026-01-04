import Dexie, { type EntityTable } from 'dexie';
import type { Book, StorageData, BookList } from '../types';

// Define database schema
interface BookDB extends Book {
  id: string;
}

interface SettingsDB {
  key: string;
  value: unknown;
}

interface CacheDB {
  url: string;
  blob: Blob;
  timestamp: number;
}

interface BookListDB extends BookList {
  id: string;
}

// Create database
class BookScannerDB extends Dexie {
  books!: EntityTable<BookDB, 'id'>;
  settings!: EntityTable<SettingsDB, 'key'>;
  imageCache!: EntityTable<CacheDB, 'url'>;
  bookLists!: EntityTable<BookListDB, 'id'>;

  constructor() {
    super('BookScannerDB');

    this.version(1).stores({
      books: 'id, isbn, title, author, status, *categories, addedAt, updatedAt',
      settings: 'key',
      imageCache: 'url, timestamp',
    });

    // Version 2: Add bookLists table
    this.version(2).stores({
      books: 'id, isbn, title, author, status, *categories, addedAt, updatedAt',
      settings: 'key',
      imageCache: 'url, timestamp',
      bookLists: 'id, name, createdAt, updatedAt',
    });

    // Version 3: Migrate bookIds to books array with BookInList structure
    this.version(3)
      .stores({
        books: 'id, isbn, title, author, status, *categories, addedAt, updatedAt',
        settings: 'key',
        imageCache: 'url, timestamp',
        bookLists: 'id, name, createdAt, updatedAt',
      })
      .upgrade(async (trans) => {
        // Migrate all book lists from bookIds to books structure
        type BookListDBLegacy = BookListDB & { bookIds?: string[] };
        const bookLists = (await trans.table('bookLists').toArray()) as BookListDBLegacy[];

        for (const list of bookLists) {
          // Check if list has old bookIds format
          if (Array.isArray(list.bookIds)) {
            const bookIds = list.bookIds;
            const books = bookIds.map((bookId) => ({
              bookId,
              comment: undefined,
              addedAt: list.updatedAt || Date.now(),
            }));

            // Update the list with new structure
            await trans.table('bookLists').update(list.id, {
              books,
              bookIds: undefined, // Remove old field
            });
          }
        }

        console.log(`Migrated ${bookLists.length} book lists to v3 structure`);
      });
  }
}

export const db = new BookScannerDB();

/**
 * Migrate data from localStorage to IndexedDB
 */
export async function migrateFromLocalStorage(storageKey: string): Promise<void> {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;

    const data = JSON.parse(stored) as Partial<StorageData>;

    // Migrate books
    if (data.books && data.books.length > 0) {
      const existingBooks = await db.books.count();
      if (existingBooks === 0) {
        await db.books.bulkAdd(data.books);
        console.log(`Migrated ${data.books.length} books to IndexedDB`);
      }
    }

    // Migrate settings
    if (data.settings) {
      // Only migrate if settings don't exist yet
      const existingCategories = await db.settings.get('categories');
      if (!existingCategories) {
        await db.settings.put({
          key: 'categories',
          value: data.settings.categories || [],
        });
      }

      // Migrate API keys only if they don't exist
      if (data.settings.googleBooksApiKey) {
        const existing = await db.settings.get('googleBooksApiKey');
        if (!existing) {
          await db.settings.put({
            key: 'googleBooksApiKey',
            value: data.settings.googleBooksApiKey,
          });
        }
      }
      if (data.settings.isbndbApiKey) {
        const existing = await db.settings.get('isbndbApiKey');
        if (!existing) {
          await db.settings.put({
            key: 'isbndbApiKey',
            value: data.settings.isbndbApiKey,
          });
        }
      }
      if (data.settings.llmApiEndpoint) {
        const existing = await db.settings.get('llmApiEndpoint');
        if (!existing) {
          await db.settings.put({
            key: 'llmApiEndpoint',
            value: data.settings.llmApiEndpoint,
          });
        }
      }
      if (data.settings.llmApiKey) {
        const existing = await db.settings.get('llmApiKey');
        if (!existing) {
          await db.settings.put({
            key: 'llmApiKey',
            value: data.settings.llmApiKey,
          });
        }
      }
      if (data.settings.llmModel) {
        const existing = await db.settings.get('llmModel');
        if (!existing) {
          await db.settings.put({
            key: 'llmModel',
            value: data.settings.llmModel,
          });
        }
      }
      console.log('Migrated settings to IndexedDB');
    }

    // Mark migration as complete and remove original localStorage data
    localStorage.setItem(storageKey + '_migrated', 'true');
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error('Failed to migrate from localStorage:', error);
  }
}

/**
 * Cache an image
 */
export async function cacheImage(url: string, blob: Blob): Promise<void> {
  try {
    await db.imageCache.put({
      url,
      blob,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Failed to cache image:', error);
  }
}

/**
 * Get cached image
 */
export async function getCachedImage(url: string): Promise<Blob | undefined> {
  try {
    const cached = await db.imageCache.get(url);
    return cached?.blob;
  } catch (error) {
    console.error('Failed to get cached image:', error);
    return undefined;
  }
}

/**
 * Clean old cache (older than 30 days)
 */
export async function cleanOldCache(): Promise<void> {
  try {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    await db.imageCache.where('timestamp').below(thirtyDaysAgo).delete();
  } catch (error) {
    console.error('Failed to clean old cache:', error);
  }
}
