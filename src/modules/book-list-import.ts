import { storage } from './storage';
import { db } from "./db";
import type { Book, BookList } from "../types";
import type { BookListExportFormat, ExportedBook } from "./book-list-export";

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
  matchType: "isbn" | "title-author";
}

/**
 * List-level conflict resolution
 */
export interface ListConflictResolution {
  action: "rename" | "merge" | "replace" | "skip";
  // Comment merge strategy (only applies when action="merge")
  commentMergeStrategy?: "local" | "import" | "both";
}

/**
 * Book-level conflict resolution
 */
export interface BookConflictResolution {
  action: "merge" | "skip" | "duplicate";
  // Global field merge strategy (applies to all fields when no per-field strategy specified)
  fieldMergeStrategy?: "detailed" | "non-empty" | "local" | "import";
  // Per-field merge strategies (only applies when action="merge")
  // If specified, overrides fieldMergeStrategy for that field
  fieldStrategies?: {
    isbn?: "unresolved" | "local" | "import" | "non-empty";
    publisher?: "unresolved" | "local" | "import" | "non-empty";
    publishDate?: "unresolved" | "local" | "import" | "non-empty";
    cover?: "unresolved" | "local" | "import" | "non-empty";
  };
}

export interface ImportStrategy {
  // Global defaults
  defaultListAction: "rename" | "merge" | "replace" | "skip";
  defaultBookAction: "merge" | "skip" | "duplicate";
  defaultCommentMerge: "local" | "import" | "both";
  defaultFieldMerge: "detailed" | "non-empty" | "local" | "import";

  // Per-conflict overrides (key: list name for lists, bookKey for books)
  listResolutions?: Map<string, ListConflictResolution>;
  bookResolutions?: Map<string, BookConflictResolution>;
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
    fullDataBefore: BookList; // Complete list data before modification
  }>;
  replacedLists: Array<{
    // Lists that were replaced (deleted then recreated)
    id: string;
    fullData: BookList; // Complete list data before deletion
  }>;
  modifiedBooks: Array<{
    // Books whose metadata was updated
    id: string;
    metadataBefore: Partial<Book>; // Original metadata fields
  }>;
}

/**
 * Default import strategy (backward compatible with Phase 3.2)
 */
export const DEFAULT_STRATEGY: ImportStrategy = {
  defaultListAction: "rename",
  defaultBookAction: "merge",
  defaultCommentMerge: "both", // Preserve both comments
  defaultFieldMerge: "non-empty", // Prefer non-empty values
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
    replacedLists: [],
    modifiedBooks: [],
  };

  // Track which lists will be created (for later undo)
  const existingLists = await storage.getBookLists();
  for (const importedList of data.lists) {
    const existing = existingLists.find((l) => l.name === importedList.name);
    const listResolution = strategy.listResolutions?.get(importedList.name);
    const action = listResolution?.action || strategy.defaultListAction;

    if (!existing || action === "rename") {
      // Will create new list - track for undo (but ID not yet assigned)
      // We'll fill this in during import
    } else if (action === "replace") {
      // Will delete and recreate - track for undo
      // We'll fill this in during import
    }
    // 'skip' and 'merge' means nothing new will be created
  }

  // Track which books might be added to existing lists
  for (const list of existingLists) {
    snapshot.modifiedLists.push({
      id: list.id,
      fullDataBefore: { ...list, books: [...list.books] }, // Deep copy complete list
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
      const listResolution = strategy.listResolutions?.get(importedList.name);
      const action = listResolution?.action || strategy.defaultListAction;

      if (action === "skip") {
        continue;
      }

      let listId: string;
      let listName = importedList.name;

      if (action === "replace" && existing) {
        // Save original list data before deletion
        snapshot.replacedLists.push({
          id: existing.id,
          fullData: { ...existing }, // Deep copy
        });

        // Delete existing and create new
        await storage.deleteBookList(existing.id);
        listId = (
          await storage.createBookList(listName, importedList.description)
        ).id;
        snapshot.addedListIds.push(listId);
      } else if (action === "merge" && existing) {
        // Merge into existing list (books will be added below)
        listId = existing.id;
        // Don't increment lists count for merge
      } else if (action === "rename" || !existing) {
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

      // Only increment count for new lists (not merges)
      if (action !== "merge") {
        result.imported.lists++;
      }

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

        const bookResolution = strategy.bookResolutions?.get(bookKey);
        const bookAction = bookResolution?.action || strategy.defaultBookAction;

        let bookId: string;

        if (existingBook && bookAction === "merge") {
          // Merge: update existing book with imported data
          bookId = existingBook.id;

          const globalFieldStrategy =
            bookResolution?.fieldMergeStrategy || strategy.defaultFieldMerge;
          const fieldStrategies = bookResolution?.fieldStrategies;

          // Save original metadata before updating
          snapshot.modifiedBooks.push({
            id: existingBook.id,
            metadataBefore: {
              isbn: existingBook.isbn,
              publisher: existingBook.publisher,
              publishDate: existingBook.publishDate,
              cover: existingBook.cover,
            },
          });

          // Apply field-level merge (per-field strategy overrides global)
          const mergedBook: Partial<Book> = {
            isbn: mergeField(
              existingBook.isbn,
              importedBook.isbn || "",
              fieldStrategies?.isbn || globalFieldStrategy
            ),
            publisher: mergeField(
              existingBook.publisher,
              importedBook.publisher || "",
              fieldStrategies?.publisher || globalFieldStrategy
            ),
            publishDate: mergeField(
              existingBook.publishDate,
              importedBook.publishDate || "",
              fieldStrategies?.publishDate || globalFieldStrategy
            ),
            cover: mergeField(
              existingBook.cover,
              importedBook.coverUrl || "",
              fieldStrategies?.cover || globalFieldStrategy
            ),
          };

          // Only update if there are actual changes
          await storage.updateBook(bookId, mergedBook);
          result.imported.booksMerged++;
        } else if (existingBook && bookAction === "skip") {
          // Skip: only update list membership, don't touch book metadata
          bookId = existingBook.id;
          result.imported.booksMerged++;
        } else {
          // Create new book (for "duplicate" or when no existing book)
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

        // Add book to list and handle comment
        await storage.addBookToList(listId, bookId);

        // Handle comment merge for list conflicts
        if (action === "merge" && existing) {
          // Get existing comment for this book in this list
          const existingBookInList = existing.books.find(
            (b) => b.bookId === bookId
          );
          const existingComment = existingBookInList?.comment;

          const commentStrategy =
            listResolution?.commentMergeStrategy ||
            strategy.defaultCommentMerge;
          const mergedComment = mergeComments(
            existingComment,
            importedBook.comment,
            commentStrategy
          );

          if (mergedComment) {
            await storage.updateBookComment(listId, bookId, mergedComment);
          }
        } else {
          // For new lists or non-merge actions, just use imported comment
          if (importedBook.comment) {
            await storage.updateBookComment(
              listId,
              bookId,
              importedBook.comment
            );
          }
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
  // 1. Delete all added books
  for (const bookId of snapshot.addedBookIds) {
    await storage.deleteBook(bookId);
  }

  // 2. Delete all added lists (including those created by "replace" action)
  for (const listId of snapshot.addedListIds) {
    await storage.deleteBookList(listId);
  }

  // 3. Restore replaced lists (direct overwrite with original data)
  for (const replaced of snapshot.replacedLists) {
    console.log(
      `[Undo] Restoring replaced list "${replaced.fullData.name}" with original ID`
    );
    await db.bookLists.put(replaced.fullData);
  }

  // 4. Restore modified books' original metadata
  for (const modified of snapshot.modifiedBooks) {
    await storage.updateBook(modified.id, modified.metadataBefore);
  }

  // 5. Restore modified lists to previous state (direct overwrite)
  for (const modified of snapshot.modifiedLists) {
    console.log(
      `[Undo] Restoring merged list "${modified.fullDataBefore.name}" to previous state`
    );
    await db.bookLists.put(modified.fullDataBefore);
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

/**
 * Merge two comment strings based on strategy
 */
function mergeComments(
  localComment: string | undefined,
  importedComment: string | undefined,
  strategy: "local" | "import" | "both"
): string | undefined {
  const local = localComment?.trim() || "";
  const imported = importedComment?.trim() || "";

  switch (strategy) {
    case "local":
      return local || undefined;
    case "import":
      return imported || undefined;
    case "both":
      if (!local && !imported) return undefined;
      if (!local) return imported;
      if (!imported) return local;
      return `${local}\n\n${imported}`;
    default:
      return local || imported || undefined;
  }
}

/**
 * Merge a single field based on strategy
 */
function mergeField<T>(
  localValue: T,
  importedValue: T,
  strategy: "detailed" | "unresolved" | "non-empty" | "local" | "import"
): T {
  // If strategy is "detailed" or "unresolved", use "non-empty" as fallback
  const effectiveStrategy = (strategy === "detailed" || strategy === "unresolved") ? "non-empty" : strategy;

  switch (effectiveStrategy) {
    case "local":
      return localValue;
    case "import":
      return importedValue;
    case "non-empty":
      // For strings, check if empty
      if (typeof localValue === "string" && typeof importedValue === "string") {
        return (localValue.trim() || importedValue.trim() || localValue) as T;
      }
      // For other types, prefer non-null/non-undefined
      return localValue ?? importedValue;
    default:
      return localValue ?? importedValue;
  }
}
