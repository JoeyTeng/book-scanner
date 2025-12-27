import type { Book, StorageData } from '../types';
import { APP_VERSION, STORAGE_KEY, DEFAULT_CATEGORIES } from '../config';
import { migrateData, needsMigration } from '../utils/migration';

class Storage {
  private data: StorageData;

  constructor() {
    this.data = this.load();
  }

  /**
   * Load data from localStorage
   */
  private load(): StorageData {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        return this.getDefaultData();
      }

      const parsed = JSON.parse(stored);

      // Migrate if needed
      if (needsMigration(parsed)) {
        console.log("Migrating data to latest version...");
        const migrated = migrateData(parsed);
        this.save(migrated);
        return migrated;
      }

      return parsed;
    } catch (error) {
      console.error("Failed to load data from localStorage:", error);
      return this.getDefaultData();
    }
  }

  /**
   * Save data to localStorage
   */
  private save(data?: StorageData): void {
    try {
      const toSave = data || this.data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error("Failed to save data to localStorage:", error);
      throw new Error("Failed to save data. Storage may be full.");
    }
  }

  /**
   * Get default data structure
   */
  private getDefaultData(): StorageData {
    return {
      version: APP_VERSION,
      books: [],
      settings: {
        categories: [...DEFAULT_CATEGORIES],
      },
    };
  }

  /**
   * Get all books
   */
  getBooks(): Book[] {
    return this.data.books;
  }

  /**
   * Get a book by ID
   */
  getBook(id: string): Book | undefined {
    return this.data.books.find((book) => book.id === id);
  }

  /**
   * Add a new book
   */
  addBook(book: Book): void {
    this.data.books.push(book);
    this.save();
  }

  /**
   * Update an existing book
   */
  updateBook(id: string, updates: Partial<Book>): void {
    const index = this.data.books.findIndex((book) => book.id === id);

    if (index !== -1) {
      this.data.books[index] = {
        ...this.data.books[index],
        ...updates,
        updatedAt: Date.now(),
      };
      this.save();
    }
  }

  /**
   * Delete a book
   */
  deleteBook(id: string): void {
    this.data.books = this.data.books.filter((book) => book.id !== id);
    this.save();
  }

  /**
   * Get all categories
   */
  getCategories(): string[] {
    return this.data.settings.categories;
  }

  /**
   * Add a custom category
   */
  addCategory(category: string): void {
    if (!this.data.settings.categories.includes(category)) {
      this.data.settings.categories.push(category);
      this.save();
    }
  }

  /**
   * Get Google Books API key
   */
  getGoogleBooksApiKey(): string | undefined {
    return this.data.settings.googleBooksApiKey;
  }

  /**
   * Set Google Books API key
   */
  setGoogleBooksApiKey(apiKey: string): void {
    this.data.settings.googleBooksApiKey = apiKey;
    this.save();
  }

  /**
   * Get ISBNdb API key
   */
  getISBNdbApiKey(): string | undefined {
    return this.data.settings.isbndbApiKey;
  }

  /**
   * Set ISBNdb API key
   */
  setISBNdbApiKey(apiKey: string): void {
    this.data.settings.isbndbApiKey = apiKey;
    this.save();
  }

  /**
   * Get LLM API endpoint
   */
  getLLMApiEndpoint(): string | undefined {
    return this.data.settings.llmApiEndpoint;
  }

  /**
   * Set LLM API endpoint
   */
  setLLMApiEndpoint(endpoint: string): void {
    this.data.settings.llmApiEndpoint = endpoint;
    this.save();
  }

  /**
   * Get LLM API key
   */
  getLLMApiKey(): string | undefined {
    return this.data.settings.llmApiKey;
  }

  /**
   * Set LLM API key
   */
  setLLMApiKey(apiKey: string): void {
    this.data.settings.llmApiKey = apiKey;
    this.save();
  }

  /**
   * Get LLM model
   */
  getLLMModel(): string | undefined {
    return this.data.settings.llmModel;
  }

  /**
   * Set LLM model
   */
  setLLMModel(model: string): void {
    this.data.settings.llmModel = model;
    this.save();
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.data = this.getDefaultData();
    this.save();
  }

  /**
   * Import data from JSON
   */
  importData(imported: StorageData, mode: "merge" | "replace" = "merge"): void {
    if (mode === "replace") {
      this.data = imported;
    } else {
      // Merge mode: add books that don't exist by ID
      const existingIds = new Set(this.data.books.map((b) => b.id));
      const newBooks = imported.books.filter((b) => !existingIds.has(b.id));
      this.data.books.push(...newBooks);

      // Merge categories
      imported.settings.categories.forEach((cat) => {
        if (!this.data.settings.categories.includes(cat)) {
          this.data.settings.categories.push(cat);
        }
      });
    }

    this.save();
  }

  /**
   * Export all data
   */
  exportData(): StorageData {
    return JSON.parse(JSON.stringify(this.data));
  }
}

export const storage = new Storage();
