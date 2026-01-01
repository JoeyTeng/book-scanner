import { storage } from './storage';
import type { Book, BookList, BookInList } from '../types';
import type { BookListExportFormat, ExportedBook } from './book-list-export';

/**
 * Conflict detection and resolution for book list imports
 */

export interface ConflictInfo {
  listNameConflicts: ListNameConflict[];
  bookConflicts: BookConflict[];
}

export interface ListNameConflict {
  importedName: string;
  existingId: string;
  existingList: BookList;
  suggestedName: string;
}

export interface BookConflict {
  importedBook: ExportedBook;
  existingBook: Book;
  matchType: 'isbn' | 'title-author';
}

export interface ImportStrategy {
  listNameConflict: "rename" | "replace" | "skip";
  bookDuplicate: "merge" | "duplicate";

  // Per-conflict overrides
  listOverrides?: Map<string, "rename" | "replace" | "skip">;
  bookOverrides?: Map<string, "merge" | "duplicate">;
}

export interface ImportResult {
  success: boolean;
  imported: {
    lists: number;
    booksAdded: number;
    booksMerged: number;
  };
  errors: string[];
  snapshot: ImportSnapshot;
}

export interface ImportSnapshot {
  timestamp: number;
  addedListIds: string[]; // Lists created during import
  addedBookIds: string[]; // Books created during import
  modifiedLists: Array<{
    // Lists modified during import
    id: string;
    booksBefore: BookInList[]; // Books in list before import
  }>;
}

/**
 * Default import strategy
 */
export const DEFAULT_STRATEGY: ImportStrategy = {
  listNameConflict: "rename", // Safe default
  bookDuplicate: "merge", // Avoid data bloat
};

/**
 * Parse and validate import file
 */
export async function parseImportFile(
  file: File
): Promise<BookListExportFormat> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate structure
    if (!data.version || !data.exportedAt || !Array.isArray(data.lists)) {
      throw new Error("Invalid export format");
    }

    // Support version 2 and 3
    if (data.version < 2 || data.version > 3) {
      throw new Error(`Unsupported version: ${data.version}`);
    }

    return data as BookListExportFormat;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON file");
    }
    throw error;
  }
}

/**
 * Detect conflicts before import
 */
export async function detectConflicts(
  data: BookListExportFormat
): Promise<ConflictInfo> {
  const listNameConflicts: ListNameConflict[] = [];
  const bookConflicts: BookConflict[] = [];
  const processedBooks = new Set<string>(); // Track processed books to avoid duplicates

  // Get all existing lists and books
  const existingLists = await storage.getBookLists();
  const existingBooks = await storage.getBooks();

  // Check list name conflicts
  for (const importedList of data.lists) {
    const existingList = existingLists.find(
      (l) => l.name === importedList.name
    );
    if (existingList) {
      listNameConflicts.push({
        importedName: importedList.name,
        existingId: existingList.id,
        existingList,
        suggestedName: generateUniqueName(importedList.name, existingLists),
      });
    }
  }

  // Check book duplicates
  for (const importedList of data.lists) {
    for (const importedBook of importedList.books) {
      // Create a unique key for this book
      const bookKey =
        importedBook.isbn || `${importedBook.title}|${importedBook.author}`;
      if (processedBooks.has(bookKey)) {
        continue; // Already processed this book
      }

      // Match by ISBN first (most reliable)
      let existingBook: Book | undefined;
      if (importedBook.isbn) {
        existingBook = existingBooks.find(
          (b: Book) => b.isbn === importedBook.isbn
        );
        if (existingBook) {
          bookConflicts.push({
            importedBook,
            existingBook,
            matchType: "isbn",
          });
          processedBooks.add(bookKey);
          continue;
        }
      }

      // Fall back to title+author match
      existingBook = existingBooks.find(
        (b: Book) =>
          b.title === importedBook.title && b.author === importedBook.author
      );
      if (existingBook) {
        bookConflicts.push({
          importedBook,
          existingBook,
          matchType: "title-author",
        });
        processedBooks.add(bookKey);
      }
    }
  }

  return { listNameConflicts, bookConflicts };
}

/**
 * Create snapshot of current state BEFORE import
 * ⚠️ CRITICAL: Must be called before executeImport()
 */
export async function createSnapshot(
  data: BookListExportFormat,
  strategy: ImportStrategy
): Promise<ImportSnapshot> {
  const snapshot: ImportSnapshot = {
    timestamp: Date.now(),
    addedListIds: [],
    addedBookIds: [],
    modifiedLists: [],
  };

  // Track which lists will be created (for later undo)
  const existingLists = await storage.getBookLists();
  for (const importedList of data.lists) {
    const existing = existingLists.find((l) => l.name === importedList.name);
    const resolution =
      strategy.listOverrides?.get(importedList.name) ||
      strategy.listNameConflict;

    if (!existing || resolution === "rename") {
      // Will create new list - track for undo (but ID not yet assigned)
      // We'll fill this in during import
    } else if (resolution === "replace") {
      // Will delete and recreate - track for undo
      // We'll fill this in during import
    }
    // 'skip' means nothing will be created
  }

  // Track which books might be added to existing lists
  for (const list of existingLists) {
    snapshot.modifiedLists.push({
      id: list.id,
      booksBefore: [...list.books], // Deep copy current state
    });
  }

  return snapshot;
}

/**
 * Execute import with given strategy
 * ⚠️ CRITICAL: createSnapshot() must be called before this
 */
export async function executeImport(
  data: BookListExportFormat,
  strategy: ImportStrategy,
  snapshot: ImportSnapshot
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    imported: {
      lists: 0,
      booksAdded: 0,
      booksMerged: 0,
    },
    errors: [],
    snapshot,
  };

  const existingLists = await storage.getBookLists();
  const existingBooks = await storage.getBooks();

  // Map of imported book key -> actual Book ID in database
  const bookIdMap = new Map<string, string>();

  try {
    for (const importedList of data.lists) {

      // Determine list resolution
      const existing = existingLists.find((l) => l.name === importedList.name);
      const resolution =
        strategy.listOverrides?.get(importedList.name) ||
        strategy.listNameConflict;

      if (resolution === "skip") {
        continue;
      }

      let listId: string;
      let listName = importedList.name;

      if (resolution === "replace" && existing) {
        // Delete existing and create new
        await storage.deleteBookList(existing.id);
        listId = (
          await storage.createBookList(listName, importedList.description)
        ).id;
        snapshot.addedListIds.push(listId);
      } else if (resolution === "rename" || !existing) {
        // Create new with possibly renamed name
        if (existing) {
          listName = generateUniqueName(importedList.name, existingLists);
        }
        listId = (
          await storage.createBookList(listName, importedList.description)
        ).id;
        snapshot.addedListIds.push(listId);
      } else {
        // Should not reach here
        listId = existing.id;
      }

      result.imported.lists++;

      // Import books into this list
      for (const importedBook of importedList.books) {
        const bookKey =
          importedBook.isbn || `${importedBook.title}|${importedBook.author}`;

        // Check if we already processed this book
        if (bookIdMap.has(bookKey)) {
          const bookId = bookIdMap.get(bookKey)!;
          await storage.addBookToList(listId, bookId);
          if (importedBook.comment) {
            await storage.updateBookComment(
              listId,
              bookId,
              importedBook.comment
            );
          }
          continue;
        }

        // Find existing book
        let existingBook: Book | undefined;
        if (importedBook.isbn) {
          existingBook = existingBooks.find(
            (b: Book) => b.isbn === importedBook.isbn
          );
        }
        if (!existingBook) {
          existingBook = existingBooks.find(
            (b: Book) =>
              b.title === importedBook.title && b.author === importedBook.author
          );
        }

        const bookResolution =
          strategy.bookOverrides?.get(bookKey) || strategy.bookDuplicate;

        let bookId: string;
        if (existingBook && bookResolution === "merge") {
          // Merge: reuse existing book
          bookId = existingBook.id;
          result.imported.booksMerged++;
        } else {
          // Create new book
          bookId = crypto.randomUUID();
          const newBook: Book = {
            id: bookId,
            title: importedBook.title,
            author: importedBook.author,
            isbn: importedBook.isbn || "",
            publisher: importedBook.publisher || "",
            publishDate: importedBook.publishDate || "",
            cover: importedBook.coverUrl || "",
            status: "want", // Default status
            source: ["manual"], // Default source
            categories: [],
            tags: [],
            notes: "",
            recommendation: "",
            addedAt: Date.now(),
            updatedAt: Date.now(),
          };
          await storage.addBook(newBook);
          snapshot.addedBookIds.push(bookId);
          result.imported.booksAdded++;
        }

        bookIdMap.set(bookKey, bookId);

        // Add book to list
        await storage.addBookToList(listId, bookId);
        if (importedBook.comment) {
          await storage.updateBookComment(listId, bookId, importedBook.comment);
        }
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  return result;
}

/**
 * Restore previous state from snapshot
 */
export async function restoreSnapshot(snapshot: ImportSnapshot): Promise<void> {
  // Delete all added books
  for (const bookId of snapshot.addedBookIds) {
    await storage.deleteBook(bookId);
  }

  // Delete all added lists
  for (const listId of snapshot.addedListIds) {
    await storage.deleteBookList(listId);
  }

  // Restore modified lists to previous state
  for (const modified of snapshot.modifiedLists) {
    const list = await storage.getBookList(modified.id);
    if (!list) continue;

    // Remove all books and restore original books
    const currentBooks = list.books.map((b) => b.bookId);
    for (const bookId of currentBooks) {
      await storage.removeBookFromList(modified.id, bookId);
    }

    for (const bookInList of modified.booksBefore) {
      await storage.addBookToList(modified.id, bookInList.bookId);
      if (bookInList.comment) {
        await storage.updateBookComment(
          modified.id,
          bookInList.bookId,
          bookInList.comment
        );
      }
    }
  }
}

/**
 * Generate a unique name by appending (2), (3), etc.
 */
function generateUniqueName(
  baseName: string,
  existingLists: BookList[]
): string {
  const existingNames = new Set(existingLists.map((l) => l.name));
  let counter = 2;
  let newName = `${baseName} (${counter})`;

  while (existingNames.has(newName)) {
    counter++;
    newName = `${baseName} (${counter})`;
  }

  return newName;
}
