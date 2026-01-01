import type { Book, StorageData, CategoryMetadata, BookList } from '../types';
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

      // Ensure default categories exist and migrate old format
      const setting = await db.settings.get("categories");
      const categories = setting?.value || [];

      if (categories.length === 0) {
        // Initialize with default categories
        const defaultCategoryMetadata: CategoryMetadata[] =
          DEFAULT_CATEGORIES.map((name) => ({
            name,
            lastUsedAt: Date.now(),
          }));
        await db.settings.put({
          key: "categories",
          value: defaultCategoryMetadata,
        });
      } else if (categories.length > 0 && typeof categories[0] === "string") {
        // Migrate old format (string[]) to new format (CategoryMetadata[])
        const migratedCategories: CategoryMetadata[] = (
          categories as unknown as string[]
        ).map((name) => ({
          name,
          lastUsedAt: Date.now(),
        }));
        await db.settings.put({
          key: "categories",
          value: migratedCategories,
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
      console.error("Failed to get books:", error);
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
      console.error("Failed to get book:", error);
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
      console.error("Failed to add book:", error);
      throw new Error("Failed to add book");
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
      console.error("Failed to update book:", error);
      throw new Error("Failed to update book");
    }
  }

  /**
   * Delete a book
   */
  async deleteBook(id: string): Promise<void> {
    await this.ensureInit();
    try {
      await db.books.delete(id);

      // Clean up references in book lists
      const bookLists = await db.bookLists.toArray();
      const listsToUpdate = bookLists.filter((list) =>
        list.books.some((item) => item.bookId === id)
      );
      await Promise.all(
        listsToUpdate.map((list) => {
          list.books = list.books.filter((item) => item.bookId !== id);
          list.updatedAt = Date.now();
          return db.bookLists.put(list);
        })
      );
    } catch (error) {
      console.error("Failed to delete book:", error);
      throw new Error("Failed to delete book");
    }
  }

  /**
   * Get all categories (returns names only for backward compatibility)
   */
  async getCategories(): Promise<string[]> {
    await this.ensureInit();
    try {
      const setting = await db.settings.get("categories");
      const categoryMetadata: CategoryMetadata[] = setting?.value || [];
      const categoryNames = categoryMetadata.map((c) => c.name);
      return categoryNames;
    } catch (error) {
      console.error("Failed to get categories:", error);
      return [...DEFAULT_CATEGORIES];
    }
  }

  /**
   * Get all categories with metadata (sorted)
   */
  async getCategoriesSorted(): Promise<CategoryMetadata[]> {
    await this.ensureInit();
    try {
      const setting = await db.settings.get("categories");
      const categories: CategoryMetadata[] = setting?.value || [];

      // Get book count for each category
      const books = await this.getBooks();
      const categoriesWithCount = categories.map((cat) => {
        const bookCount = books.filter((b) =>
          b.categories.includes(cat.name)
        ).length;
        return { ...cat, bookCount };
      });

      // Three-level sorting: lastUsedAt DESC -> bookCount DESC -> alphabetical
      return categoriesWithCount.sort((a, b) => {
        // 1. lastUsedAt descending
        if (a.lastUsedAt !== b.lastUsedAt) {
          return b.lastUsedAt - a.lastUsedAt;
        }

        // 2. bookCount descending
        if (a.bookCount !== b.bookCount) {
          return b.bookCount - a.bookCount;
        }

        // 3. alphabetical (case-insensitive, Chinese by pinyin)
        return a.name.localeCompare(b.name, "zh-CN", {
          sensitivity: "base",
        });
      });
    } catch (error) {
      console.error("Failed to get sorted categories:", error);
      return [];
    }
  }

  /**
   * Add a custom category
   */
  async addCategory(category: string): Promise<void> {
    await this.ensureInit();
    try {
      const setting = await db.settings.get("categories");
      const categories: CategoryMetadata[] = setting?.value || [];

      if (!categories.find((c) => c.name === category)) {
        categories.push({
          name: category,
          lastUsedAt: Date.now(),
        });
        await db.settings.put({ key: "categories", value: categories });
      }
    } catch (error) {
      console.error("Failed to add category:", error);
      throw new Error("Failed to add category");
    }
  }

  /**
   * Update category usage timestamp
   * Called when a book with this category is added or updated
   */
  async touchCategory(name: string): Promise<void> {
    await this.ensureInit();
    try {
      const setting = await db.settings.get("categories");
      const categories: CategoryMetadata[] = setting?.value || [];

      const category = categories.find((c) => c.name === name);
      if (category) {
        category.lastUsedAt = Date.now();
        await db.settings.put({ key: "categories", value: categories });
      }
    } catch (error) {
      console.error("Failed to touch category:", error);
    }
  }

  /**
   * Get book count for a specific category
   */
  async getBookCountForCategory(name: string): Promise<number> {
    await this.ensureInit();
    try {
      const books = await this.getBooks();
      return books.filter((b) => b.categories.includes(name)).length;
    } catch (error) {
      console.error("Failed to get book count:", error);
      return 0;
    }
  }

  /**
   * Rename a category and update all books using it
   */
  async updateCategoryName(oldName: string, newName: string): Promise<void> {
    await this.ensureInit();
    try {
      // 1. Update category metadata
      const setting = await db.settings.get("categories");
      const categories: CategoryMetadata[] = setting?.value || [];

      const category = categories.find((c) => c.name === oldName);
      if (category) {
        category.name = newName;
        await db.settings.put({ key: "categories", value: categories });
      }

      // 2. Update all books using this category
      const books = await this.getBooks();
      for (const book of books) {
        if (book.categories.includes(oldName)) {
          book.categories = book.categories.map((c) =>
            c === oldName ? newName : c
          );
          await this.updateBook(book.id, { categories: book.categories });
        }
      }
    } catch (error) {
      console.error("Failed to update category name:", error);
      throw new Error("Failed to update category name");
    }
  }

  /**
   * Delete a category and remove it from all books
   */
  async deleteCategory(name: string): Promise<void> {
    await this.ensureInit();
    try {
      // 1. Remove from category metadata
      const setting = await db.settings.get("categories");
      const categories: CategoryMetadata[] = setting?.value || [];

      const filtered = categories.filter((c) => c.name !== name);
      await db.settings.put({ key: "categories", value: filtered });

      // 2. Remove from all books (bulk update for performance)
      const books = await this.getBooks();
      const booksToUpdate = books.filter((book) =>
        book.categories.includes(name)
      );

      if (booksToUpdate.length > 0) {
        // Update all affected books in parallel
        await Promise.all(
          booksToUpdate.map((book) => {
            book.categories = book.categories.filter((c) => c !== name);
            return db.books.put(book);
          })
        );
      }
    } catch (error) {
      console.error("Failed to delete category:", error);
      throw new Error("Failed to delete category");
    }
  }

  /**
   * Delete multiple categories at once (avoids race conditions)
   */
  async deleteCategoriesBatch(names: string[]): Promise<void> {
    await this.ensureInit();
    try {
      if (names.length === 0) return;

      const namesToDelete = new Set(names);

      // 1. Remove from all books first (so if metadata deletion fails, we can retry)
      const books = await this.getBooks();
      const booksToUpdate = books.filter((book) =>
        book.categories.some((cat) => namesToDelete.has(cat))
      );

      if (booksToUpdate.length > 0) {
        // Update all affected books in parallel
        await Promise.all(
          booksToUpdate.map((book) => {
            book.categories = book.categories.filter(
              (c) => !namesToDelete.has(c)
            );
            return db.books.put(book);
          })
        );
      }

      // 2. Remove from category metadata (after books are updated successfully)
      const setting = await db.settings.get("categories");
      const categories: CategoryMetadata[] = setting?.value || [];
      const filtered = categories.filter((c) => !namesToDelete.has(c.name));
      await db.settings.put({ key: "categories", value: filtered });
    } catch (error) {
      console.error("Failed to delete categories:", error);
      throw new Error("Failed to delete categories");
    }
  }

  /**
   * Get Google Books API key
   */
  async getGoogleBooksApiKey(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get("googleBooksApiKey");
    return setting?.value;
  }

  /**
   * Set Google Books API key
   */
  async setGoogleBooksApiKey(apiKey: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: "googleBooksApiKey", value: apiKey });
  }

  /**
   * Get ISBNdb API key
   */
  async getISBNdbApiKey(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get("isbndbApiKey");
    return setting?.value;
  }

  /**
   * Set ISBNdb API key
   */
  async setISBNdbApiKey(apiKey: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: "isbndbApiKey", value: apiKey });
  }

  /**
   * Get LLM API endpoint
   */
  async getLLMApiEndpoint(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get("llmApiEndpoint");
    return setting?.value;
  }

  /**
   * Set LLM API endpoint
   */
  async setLLMApiEndpoint(endpoint: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: "llmApiEndpoint", value: endpoint });
  }

  /**
   * Get LLM API key
   */
  async getLLMApiKey(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get("llmApiKey");
    return setting?.value;
  }

  /**
   * Set LLM API key
   */
  async setLLMApiKey(apiKey: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: "llmApiKey", value: apiKey });
  }

  /**
   * Get LLM model
   */
  async getLLMModel(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get("llmModel");
    return setting?.value;
  }

  /**
   * Set LLM model
   */
  async setLLMModel(model: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: "llmModel", value: model });
  }

  /**
   * Get LLM Text API endpoint (for text parsing only)
   */
  async getLLMTextApiEndpoint(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get("llmTextApiEndpoint");
    return setting?.value;
  }

  /**
   * Set LLM Text API endpoint
   */
  async setLLMTextApiEndpoint(endpoint: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: "llmTextApiEndpoint", value: endpoint });
  }

  /**
   * Get LLM Text API key (for text parsing only)
   */
  async getLLMTextApiKey(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get("llmTextApiKey");
    return setting?.value;
  }

  /**
   * Set LLM Text API key
   */
  async setLLMTextApiKey(apiKey: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: "llmTextApiKey", value: apiKey });
  }

  /**
   * Get LLM Text model (for text parsing only)
   */
  async getLLMTextModel(): Promise<string | undefined> {
    await this.ensureInit();
    const setting = await db.settings.get("llmTextModel");
    return setting?.value;
  }

  /**
   * Set LLM Text model
   */
  async setLLMTextModel(model: string): Promise<void> {
    await this.ensureInit();
    await db.settings.put({ key: "llmTextModel", value: model });
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
      await db.settings.put({
        key: "categories",
        value: [...DEFAULT_CATEGORIES],
      });
    } catch (error) {
      console.error("Failed to clear data:", error);
      throw new Error("Failed to clear data");
    }
  }

  /**
   * Import data from JSON
   */
  async importData(
    imported: StorageData,
    mode: "merge" | "replace" = "merge"
  ): Promise<void> {
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
          await db.settings.put({
            key: "categories",
            value: imported.settings.categories,
          });
        }
        if (imported.settings.googleBooksApiKey) {
          await db.settings.put({
            key: "googleBooksApiKey",
            value: imported.settings.googleBooksApiKey,
          });
        }
        if (imported.settings.isbndbApiKey) {
          await db.settings.put({
            key: "isbndbApiKey",
            value: imported.settings.isbndbApiKey,
          });
        }
        if (imported.settings.llmApiEndpoint) {
          await db.settings.put({
            key: "llmApiEndpoint",
            value: imported.settings.llmApiEndpoint,
          });
        }
        if (imported.settings.llmApiKey) {
          await db.settings.put({
            key: "llmApiKey",
            value: imported.settings.llmApiKey,
          });
        }
        if (imported.settings.llmModel) {
          await db.settings.put({
            key: "llmModel",
            value: imported.settings.llmModel,
          });
        }
        if (imported.settings.llmTextApiEndpoint) {
          await db.settings.put({
            key: "llmTextApiEndpoint",
            value: imported.settings.llmTextApiEndpoint,
          });
        }
        if (imported.settings.llmTextApiKey) {
          await db.settings.put({
            key: "llmTextApiKey",
            value: imported.settings.llmTextApiKey,
          });
        }
        if (imported.settings.llmTextModel) {
          await db.settings.put({
            key: "llmTextModel",
            value: imported.settings.llmTextModel,
          });
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
        const setting = await db.settings.get("categories");
        const categories: CategoryMetadata[] = setting?.value || [];
        let categoriesUpdated = false;

        imported.settings.categories.forEach((cat) => {
          if (!categories.find((c) => c.name === cat.name)) {
            categories.push(cat);
            categoriesUpdated = true;
          }
        });

        if (categoriesUpdated) {
          await db.settings.put({ key: "categories", value: categories });
        }
      }
    } catch (error) {
      console.error("Failed to import data:", error);
      throw new Error("Failed to import data");
    }
  }

  /**
   * Export all data
   */
  async exportData(): Promise<StorageData> {
    await this.ensureInit();
    try {
      const books = await db.books.toArray();
      const setting = await db.settings.get("categories");
      const categories: CategoryMetadata[] = setting?.value || [];
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
      console.error("Failed to export data:", error);
      throw new Error("Failed to export data");
    }
  }

  /**
   * Wait for storage to be initialized (public API)
   */
  async waitForInit(): Promise<void> {
    await this.ensureInit();
  }

  // ============ Book List Management ============

  /**
   * Get all book lists
   */
  async getBookLists(): Promise<BookList[]> {
    await this.ensureInit();
    try {
      const lists = await db.bookLists.toArray();
      return lists.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error("Failed to get book lists:", error);
      return [];
    }
  }

  /**
   * Get a book list by ID
   */
  async getBookList(id: string): Promise<BookList | undefined> {
    await this.ensureInit();
    try {
      return await db.bookLists.get(id);
    } catch (error) {
      console.error("Failed to get book list:", error);
      return undefined;
    }
  }

  /**
   * Create a new book list
   */
  async createBookList(
    name: string,
    description?: string
  ): Promise<BookList> {
    await this.ensureInit();
    try {
      const now = Date.now();
      const bookList: BookList = {
        id: crypto.randomUUID(),
        name,
        description,
        books: [],
        createdAt: now,
        updatedAt: now,
      };
      await db.bookLists.add(bookList);
      return bookList;
    } catch (error) {
      console.error("Failed to create book list:", error);
      throw new Error("Failed to create book list");
    }
  }

  /**
   * Update a book list
   */
  async updateBookList(
    id: string,
    updates: Partial<Omit<BookList, "id" | "createdAt">>
  ): Promise<void> {
    await this.ensureInit();
    try {
      const bookList = await db.bookLists.get(id);
      if (!bookList) {
        throw new Error("Book list not found");
      }
      await db.bookLists.update(id, {
        ...updates,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error("Failed to update book list:", error);
      throw new Error("Failed to update book list");
    }
  }

  /**
   * Delete a book list
   */
  async deleteBookList(id: string): Promise<void> {
    await this.ensureInit();
    try {
      await db.bookLists.delete(id);
    } catch (error) {
      console.error("Failed to delete book list:", error);
      throw new Error("Failed to delete book list");
    }
  }

  /**
   * Add a book to a book list
   */
  async addBookToList(
    bookListId: string,
    bookId: string,
    comment?: string
  ): Promise<void> {
    await this.ensureInit();
    try {
      const bookList = await db.bookLists.get(bookListId);
      if (!bookList) {
        throw new Error("Book list not found");
      }
      if (!bookList.books.some((item) => item.bookId === bookId)) {
        bookList.books.push({
          bookId,
          comment,
          addedAt: Date.now(),
        });
        bookList.updatedAt = Date.now();
        await db.bookLists.put(bookList);
      }
    } catch (error) {
      console.error("Failed to add book to list:", error);
      throw new Error("Failed to add book to list");
    }
  }

  /**
   * Remove a book from a book list
   */
  async removeBookFromList(bookListId: string, bookId: string): Promise<void> {
    await this.ensureInit();
    try {
      const bookList = await db.bookLists.get(bookListId);
      if (!bookList) {
        throw new Error("Book list not found");
      }
      bookList.books = bookList.books.filter((item) => item.bookId !== bookId);
      bookList.updatedAt = Date.now();
      await db.bookLists.put(bookList);
    } catch (error) {
      console.error("Failed to remove book from list:", error);
      throw new Error("Failed to remove book from list");
    }
  }

  /**
   * Get books in a book list with their comments and addedAt
   */
  async getBooksInList(
    bookListId: string
  ): Promise<Array<Book & { comment?: string; addedAt?: number }>> {
    await this.ensureInit();
    try {
      const bookList = await db.bookLists.get(bookListId);
      if (!bookList) {
        return [];
      }
      const booksWithMeta: Array<
        Book & { comment?: string; addedAt?: number }
      > = [];

      for (const item of bookList.books) {
        const book = await this.getBook(item.bookId);
        if (book) {
          booksWithMeta.push({
            ...book,
            comment: item.comment,
            addedAt: item.addedAt,
          });
        }
      }

      return booksWithMeta;
    } catch (error) {
      console.error("Failed to get books in list:", error);
      return [];
    }
  }

  /**
   * Check if a book is in a book list
   */
  async isBookInList(bookListId: string, bookId: string): Promise<boolean> {
    await this.ensureInit();
    try {
      const bookList = await db.bookLists.get(bookListId);
      return bookList
        ? bookList.books.some((item) => item.bookId === bookId)
        : false;
    } catch (error) {
      console.error("Failed to check book in list:", error);
      return false;
    }
  }

  /**
   * Update comment for a book in a book list
   */
  async updateBookComment(
    bookListId: string,
    bookId: string,
    comment: string | undefined
  ): Promise<void> {
    await this.ensureInit();
    try {
      const bookList = await db.bookLists.get(bookListId);
      if (!bookList) {
        throw new Error("Book list not found");
      }

      const bookItem = bookList.books.find((item) => item.bookId === bookId);
      if (bookItem) {
        bookItem.comment = comment;
        bookList.updatedAt = Date.now();
        await db.bookLists.put(bookList);
      }
    } catch (error) {
      console.error("Failed to update book comment:", error);
      throw new Error("Failed to update book comment");
    }
  }

  /**
   * Get comment for a book in a book list
   */
  async getBookComment(
    bookListId: string,
    bookId: string
  ): Promise<string | undefined> {
    await this.ensureInit();
    try {
      const bookList = await db.bookLists.get(bookListId);
      if (!bookList) return undefined;

      const bookItem = bookList.books.find((item) => item.bookId === bookId);
      return bookItem?.comment;
    } catch (error) {
      console.error("Failed to get book comment:", error);
      return undefined;
    }
  }
}

export const storage = new Storage();
