import type { Book, StorageData } from '../types';
import { APP_VERSION, STORAGE_KEY, DEFAULT_CATEGORIES } from '../config';
import { db, migrateFromLocalStorage } from './db';

/**
 * Storage class backed by IndexedDB for better performance and larger capacity
 */
class Storage {
  private initPromise: Promise<void>;
  private initialized: boolean = false;

  constructor() {
    this.initPromise = this.init();
  }

  /**
   * Initialize IndexedDB and migrate from localStorage if needed
   */
  private async init(): Promise<void> {
    try {
      // Migrate from localStorage on first run
      await migrateFromLocalStorage(STORAGE_KEY);

      // Ensure default categories exist (directly access DB, don't use getCategories)
      const setting = await db.settings.get("categories");
      const categories = setting?.value || [];

      if (categories.length === 0) {
        await db.settings.put({
          key: "categories",
          value: [...DEFAULT_CATEGORIES],
        });
      }

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize storage:", error);
      this.initialized = true; // Continue anyway
    }
  }

  /**
   * Ensure storage is initialized
   */
  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.initPromise;
    }
  }

  /**
   * Get all books
   */
  async getBooks(): Promise<Book[]> {
    await this.ensureInit();
    try {
      return await db.books.toArray();
    } catch (error) {
      console.error('Failed to get books:', error);
      return [];
    }
  }

  /**
   * Get a book by ID
   */
  async getBook(id: string): Promise<Book | undefined> {
    await this.ensureInit();
    try {
      return await db.books.get(id);
    } catch (error) {
      console.error('Failed to get book:', error);
      return undefined;
    }
  }

  /**
   * Add a new book
   */
  async addBook(book: Book): Promise<void> {
    await this.ensureInit();
    try {
      await db.books.add(book);
    } catch (error) {
      console.error('Failed to add book:', error);
      throw new Error('Failed to add book');
    }
  }

  /**
   * Update an existing book
   */
  async updateBook(id: string, updates: Partial<Book>): Promise<void> {
    await this.ensureInit();
    try {
      const book = await db.books.get(id);
      if (book) {
        await db.books.put({
          ...book,
          ...updates,
          updatedAt: Date.now(),
        });
      }
    } catch (error) {
      console.error('Failed to update book:', error);
      throw new Error('Failed to update book');
    }
  }

  /**
   * Delete a book
   */
  async deleteBook(id: string): Promise<void> {
    await this.ensureInit();
    try {
      await db.books.delete(id);
    } catch (error) {
      console.error('Failed to delete book:', error);
      throw new Error('Failed to delete book');
    }
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<string[]> {
    await this.ensureInit();
    try {
      const setting = await db.settings.get('categories');
      return setting?.value || [...DEFAULT_CATEGORIES];
    } catch (error) {
      console.error('Failed to get categories:', error);
      return [...DEFAULT_CATEGORIES];
    }
  }

  /**
   * Add a custom category
   */
  async addCategory(category: string): Promise<void> {
    await this.ensureInit();
    try {
      const categories = await this.getCategories();
      if (!categories.includes(category)) {
        categories.push(category);
        await db.settings.put({ key: 'categories', value: categories });
      }
    } catch (error) {
      console.error('Failed to add category:', error);
      throw new Error('Failed to add category');
    }
  }

  /**
   * Get Google Books API key
   */
  async getGoogleBooksApiKey(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get('googleBooksApiKey');
    return setting?.value;
  }

  /**
   * Set Google Books API key
   */
  async setGoogleBooksApiKey(apiKey: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: 'googleBooksApiKey', value: apiKey });
  }

  /**
   * Get ISBNdb API key
   */
  async getISBNdbApiKey(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get('isbndbApiKey');
    return setting?.value;
  }

  /**
   * Set ISBNdb API key
   */
  async setISBNdbApiKey(apiKey: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: 'isbndbApiKey', value: apiKey });
  }

  /**
   * Get LLM API endpoint
   */
  async getLLMApiEndpoint(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get('llmApiEndpoint');
    return setting?.value;
  }

  /**
   * Set LLM API endpoint
   */
  async setLLMApiEndpoint(endpoint: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: 'llmApiEndpoint', value: endpoint });
  }

  /**
   * Get LLM API key
   */
  async getLLMApiKey(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get('llmApiKey');
    return setting?.value;
  }

  /**
   * Set LLM API key
   */
  async setLLMApiKey(apiKey: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: 'llmApiKey', value: apiKey });
  }

  /**
   * Get LLM model
   */
  async getLLMModel(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get('llmModel');
    return setting?.value;
  }

  /**
   * Set LLM model
   */
  async setLLMModel(model: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: 'llmModel', value: model });
  }

  /**
   * Get LLM Text API endpoint (for text parsing only)
   */
  async getLLMTextApiEndpoint(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get('llmTextApiEndpoint');
    return setting?.value;
  }

  /**
   * Set LLM Text API endpoint
   */
  async setLLMTextApiEndpoint(endpoint: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: 'llmTextApiEndpoint', value: endpoint });
  }

  /**
   * Get LLM Text API key (for text parsing only)
   */
  async getLLMTextApiKey(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get('llmTextApiKey');
    return setting?.value;
  }

  /**
   * Set LLM Text API key
   */
  async setLLMTextApiKey(apiKey: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: 'llmTextApiKey', value: apiKey });
  }

  /**
   * Get LLM Text model (for text parsing only)
   */
  async getLLMTextModel(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get('llmTextModel');
    return setting?.value;
  }

  /**
   * Set LLM Text model
   */
  async setLLMTextModel(model: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: 'llmTextModel', value: model });
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    await this.ensureInit();
    try {
      await db.books.clear();
      await db.settings.clear();
      await db.imageCache.clear();
      // Restore default categories
      await db.settings.put({ key: 'categories', value: [...DEFAULT_CATEGORIES] });
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw new Error('Failed to clear data');
    }
  }

  /**
   * Import data from JSON
   */
  async importData(imported: StorageData, mode: "merge" | "replace" = "merge"): Promise<void> {
    await this.ensureInit();
    try {
      if (mode === "replace") {
        // Clear existing data
        await db.books.clear();
        await db.settings.clear();

        // Import books
        await db.books.bulkAdd(imported.books);

        // Import settings
        if (imported.settings.categories) {
          await db.settings.put({ key: 'categories', value: imported.settings.categories });
        }
        if (imported.settings.googleBooksApiKey) {
          await db.settings.put({ key: 'googleBooksApiKey', value: imported.settings.googleBooksApiKey });
        }
        if (imported.settings.isbndbApiKey) {
          await db.settings.put({ key: 'isbndbApiKey', value: imported.settings.isbndbApiKey });
        }
        if (imported.settings.llmApiEndpoint) {
          await db.settings.put({ key: 'llmApiEndpoint', value: imported.settings.llmApiEndpoint });
        }
        if (imported.settings.llmApiKey) {
          await db.settings.put({ key: 'llmApiKey', value: imported.settings.llmApiKey });
        }
        if (imported.settings.llmModel) {
          await db.settings.put({ key: 'llmModel', value: imported.settings.llmModel });
        }
        if (imported.settings.llmTextApiEndpoint) {
          await db.settings.put({ key: 'llmTextApiEndpoint', value: imported.settings.llmTextApiEndpoint });
        }
        if (imported.settings.llmTextApiKey) {
          await db.settings.put({ key: 'llmTextApiKey', value: imported.settings.llmTextApiKey });
        }
        if (imported.settings.llmTextModel) {
          await db.settings.put({ key: 'llmTextModel', value: imported.settings.llmTextModel });
        }
      } else {
        // Merge mode: add books that don't exist by ID
        const existingBooks = await db.books.toArray();
        const existingIds = new Set(existingBooks.map((b) => b.id));
        const newBooks = imported.books.filter((b) => !existingIds.has(b.id));

        if (newBooks.length > 0) {
          await db.books.bulkAdd(newBooks);
        }

        // Merge categories
        const categories = await this.getCategories();
        let categoriesUpdated = false;

        imported.settings.categories.forEach((cat) => {
          if (!categories.includes(cat)) {
            categories.push(cat);
            categoriesUpdated = true;
          }
        });

        if (categoriesUpdated) {
          await db.settings.put({ key: 'categories', value: categories });
        }
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error('Failed to import data');
    }
  }

  /**
   * Export all data
   */
  async exportData(): Promise<StorageData> {
    await this.ensureInit();
    try {
      const books = await db.books.toArray();
      const categories = await this.getCategories();
      const googleBooksApiKey = await this.getGoogleBooksApiKey();
      const isbndbApiKey = await this.getISBNdbApiKey();
      const llmApiEndpoint = await this.getLLMApiEndpoint();
      const llmApiKey = await this.getLLMApiKey();
      const llmModel = await this.getLLMModel();
      const llmTextApiEndpoint = await this.getLLMTextApiEndpoint();
      const llmTextApiKey = await this.getLLMTextApiKey();
      const llmTextModel = await this.getLLMTextModel();

      return {
        version: APP_VERSION,
        books,
        settings: {
          categories,
          googleBooksApiKey,
          isbndbApiKey,
          llmApiEndpoint,
          llmApiKey,
          llmModel,
          llmTextApiEndpoint,
          llmTextApiKey,
          llmTextModel,
        },
      };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw new Error('Failed to export data');
    }
  }

  /**
   * Wait for storage to be initialized (public API)
   */
  async waitForInit(): Promise<void> {
    await this.ensureInit();
  }
}

export const storage = new Storage();
