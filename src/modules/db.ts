import Dexie, { type EntityTable } from 'dexie';
import type { Book, StorageData } from '../types';

// Define database schema
interface BookDB extends Book {
  id: string;
}

interface SettingsDB {
  key: string;
  value: any;
}

interface CacheDB {
  url: string;
  blob: Blob;
  timestamp: number;
}

// Create database
class BookScannerDB extends Dexie {
  books!: EntityTable<BookDB, "id">;
  settings!: EntityTable<SettingsDB, "key">;
  imageCache!: EntityTable<CacheDB, "url">;

  constructor() {
    super("BookScannerDB");

    this.version(1).stores({
      books: "id, isbn, title, author, status, *categories, addedAt, updatedAt",
      settings: "key",
      imageCache: "url, timestamp",
    });
  }
}

export const db = new BookScannerDB();

/**
 * Migrate data from localStorage to IndexedDB
 */
export async function migrateFromLocalStorage(
  storageKey: string
): Promise<void> {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;

    const data: StorageData = JSON.parse(stored);

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
          key: "categories",
          value: data.settings.categories || [],
        });
      }

      // Migrate API keys only if they don't exist
      if (data.settings.googleBooksApiKey) {
        const existing = await db.settings.get('googleBooksApiKey');
        if (!existing) {
          await db.settings.put({
            key: "googleBooksApiKey",
            value: data.settings.googleBooksApiKey,
          });
        }
      }
      if (data.settings.isbndbApiKey) {
        const existing = await db.settings.get('isbndbApiKey');
        if (!existing) {
          await db.settings.put({
            key: "isbndbApiKey",
            value: data.settings.isbndbApiKey,
          });
        }
      }
      if (data.settings.llmApiEndpoint) {
        const existing = await db.settings.get('llmApiEndpoint');
        if (!existing) {
          await db.settings.put({
            key: "llmApiEndpoint",
            value: data.settings.llmApiEndpoint,
          });
        }
      }
      if (data.settings.llmApiKey) {
        const existing = await db.settings.get('llmApiKey');
        if (!existing) {
          await db.settings.put({
            key: "llmApiKey",
            value: data.settings.llmApiKey,
          });
        }
      }
      if (data.settings.llmModel) {
        const existing = await db.settings.get('llmModel');
        if (!existing) {
          await db.settings.put({
            key: "llmModel",
            value: data.settings.llmModel,
          });
        }
      }
      console.log("Migrated settings to IndexedDB");
    }

    // Mark migration as complete and remove original localStorage data
    localStorage.setItem(storageKey + "_migrated", "true");
    localStorage.removeItem(storageKey);
  } catch (error) {
    console.error("Failed to migrate from localStorage:", error);
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
      timestamp: Date.now()
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
