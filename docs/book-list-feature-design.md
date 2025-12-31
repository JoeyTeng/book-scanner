# Book List Feature Design

## Overview

The Book List (书单) feature allows users to organize their book collection into multiple lists, similar to bookshelves or reading lists. This document outlines the three-phase implementation plan.

**Core Concept**: Books are stored centrally in the main database, and book lists only store references (book IDs) to avoid data duplication.

---

## Phase 1: Core Functionality ✅ COMPLETED

### Features Implemented

#### 1. Data Model
- **BookList Interface**:
  ```typescript
  interface BookList {
    id: string;              // UUID
    name: string;            // Display name
    description?: string;    // Optional description
    bookIds: string[];       // References to books
    createdAt: Date;
    updatedAt: Date;
  }
  ```
- **Export/Import Interfaces**: `BookListExport`, `BookListImportResult`

#### 2. Database Schema
- IndexedDB upgraded to version 2
- Added `bookLists` table with index on `id, name, createdAt, updatedAt`

#### 3. Storage Layer (storage.ts)
New methods:
- `getBookLists()`: Fetch all lists (sorted by updatedAt DESC)
- `getBookList(id)`: Get single list
- `createBookList(name, description?)`: Create new list with UUID
- `updateBookList(id, updates)`: Update list properties
- `deleteBookList(id)`: Delete list
- `addBookToList(bookListId, bookId)`: Add book reference
- `removeBookFromList(bookListId, bookId)`: Remove book reference
- `getBooksInList(bookListId)`: Fetch actual books, filter non-existent
- `isBookInList(bookListId, bookId)`: Check membership

Enhanced existing methods:
- `deleteBook()`: Now automatically removes book ID from all book lists

#### 4. Book List Manager Modal
- Create, rename, delete book lists
- Shows book count for each list
- Optional description display
- Duplicate name validation
- Deletion warning if list contains books

#### 5. Navbar Integration
- Center section: Book list selector dropdown
- Default option: "📚 All Books"
- Menu item: "Manage Book Lists"
- Callbacks for list selection changes
- Public API methods for external control

#### 6. Filtering System
- App.ts: Connects navbar selection to BookList component
- BookList.ts: Filters books based on active book list ID
- Seamless switching between "All Books" and specific lists

#### 7. Internationalization
Added translations for:
- `bookListSelector.*`: Selector UI
- `bookListManager.*`: Manager modal
- `error.bookList*`: Error messages
- `navbar.menu.manageBookLists`: Menu item

#### 8. Styling
- `.navbar-center`: Center section layout
- `.booklist-selector`: Dropdown styling with hover/focus states

### Verification Points
- ✅ Create book list → appears in dropdown
- ✅ Select book list → only shows books in that list
- ✅ Select "All Books" → shows all books
- ✅ Delete book → automatically removed from all lists
- ✅ Rename list → dropdown updates
- ✅ Delete list → dropdown updates, reverts to "All Books"

---

## Phase 2: Enhanced Operations (IN PROGRESS)

### 1. Bulk Edit: Book List Operations

**New section in Bulk Edit Modal**:
```
[✓] Change Reading Status
[✓] Modify Categories  
[✓] Book List Operations  ← NEW
    ● Add to Book Lists ○ Remove from Book Lists
    └─ [Book list selector with checkboxes]
```

#### Add to Book Lists Mode
- Display all existing book lists
- Multi-select checkboxes
- Add selected books to selected lists
- Skip if book already in list

#### Remove from Book Lists Mode
- Display **union** of all book lists that contain any of the selected books
- Example:
  - Book A in ["Sci-Fi", "Recommended"]
  - Book B in ["Sci-Fi", "Must-Read"]
  - Book C in ["Recommended"]
  - Shows: ["Sci-Fi", "Recommended", "Must-Read"] (union)
- Multi-select checkboxes
- Remove books from selected lists (only removes if book is actually in that list)

#### Special Behavior
- When in a specific book list view (not "All Books"):
  - Default to "Remove" mode
  - Pre-select current active book list
  - User can still switch to "Add" mode

**Files to modify**:
- `bulk-edit-modal.ts`: Add UI and logic
- `en.ts`, `zh-CN.ts`: Add translations
- `components.css`: Styling (reuse radio-group styles)

### 2. BookCard: Add to List Button

**Button behavior**:

#### No Active Book List (showing "All Books")
- Display: "➕" icon button
- Click: Open book list selector popup
- User selects one book list to add book to
- Toast notification on success

#### Active Book List Selected
- If book **is in** current list:
  - Display: "✓ In List" or "➖ Remove" button
  - Click: Remove book from current list
  - Button updates immediately
  
- If book **not in** current list:
  - Display: "➕ Add to List" button
  - Click: Add book to current list
  - Button updates immediately

**Implementation needs**:
- Pass `activeBookListId` from App → BookList → BookCard
- Create simple book list selector modal (for "All Books" view)
- Update button state after operation
- Toast notifications for user feedback

**Files to modify**:
- `book-card.ts`: Add button and logic
- `book-list.ts`: Pass activeBookListId to BookCard
- Create `book-list-selector-modal.ts`: Simple selector popup
- `en.ts`, `zh-CN.ts`: Add button labels
- `components.css`: Button styling

### 3. SearchBar: Search Scope Toggle

**UI addition**: Radio button group next to search input

```
[Search input...] [🔍]
○ Current Book List  ● All Books
```

**Behavior**:
- "Current Book List" option disabled when showing "All Books"
- When toggled, filter search results to:
  - Current list only, OR
  - All books in library
- Scope preference could be saved to localStorage

**Implementation needs**:
- Add toggle UI in SearchBar
- Modify search logic to respect scope
- Pass activeBookListId to SearchBar
- Update search results count label

**Files to modify**:
- `search-bar.ts`: Add toggle UI and logic
- `app.ts`: Pass activeBookListId to SearchBar
- `en.ts`, `zh-CN.ts`: Add scope labels
- `components.css`: Toggle styling

---

## Phase 3: Import/Export (PLANNED)

### 1. Export Book Lists

**Feature**: Export one or more book lists as JSON with full book data

**Export format**:
```typescript
interface BookListExport {
  id: string;
  name: string;
  description?: string;
  books: Book[];  // Full book objects, not just IDs
  createdAt: Date;
  updatedAt: Date;
  exportedAt: Date;
  version: number;
}
```

**UI flow**:
1. In Book List Manager Modal, add "Export" button next to each list
2. Click → Download JSON file
3. Alternatively: "Export All Lists" button to export all lists at once

**Benefits**:
- Share curated book lists with others
- Backup specific collections
- Portable format includes all book metadata

### 2. Import Book Lists with Conflict Resolution

**Feature**: Import book lists from JSON, handle naming conflicts and duplicate books

**Import flow**:
1. User selects JSON file (via menu: "Import Book Lists")
2. System detects:
   - Name conflicts (list with same name exists)
   - Book duplicates (match by ISBN or title+author)
3. Show conflict resolution dialog

**Conflict Resolution Dialog**:

```
Importing "Sci-Fi Classics"
⚠️ A book list with this name already exists.

Book List Conflict:
○ Replace existing list (delete old, import new)
○ Keep both (rename import to "Sci-Fi Classics (2)")
○ Skip this list

Book Conflicts (3 books):
- "Foundation" by Isaac Asimov
  ○ Skip (keep existing book data)
  ○ Update (merge with import data)
  ○ Add as duplicate

[Apply to all similar conflicts] ✓

[Cancel] [Import]
```

**Resolution options**:
- **List name conflicts**:
  - Replace: Delete existing, import new
  - Keep both: Auto-rename import (append number)
  - Skip: Don't import this list
  
- **Book duplicates** (matched by ISBN):
  - Skip: Don't import, keep existing book
  - Update: Merge data (prefer import for conflicts)
  - Duplicate: Add as separate book (change ID)

**Implementation needs**:
- Create `book-list-import-modal.ts`: Conflict resolution UI
- Enhance `storage.ts`: Add merge/conflict detection logic
- Update `import.ts`: Handle book list imports
- Add menu item in navbar
- Extensive i18n for all resolution options

**Files to modify**:
- Create `modules/book-list-import.ts`: Import logic
- Create `book-list-import-modal.ts`: Conflict UI
- `storage.ts`: Merge helpers
- `navbar.ts`: Add menu items
- `en.ts`, `zh-CN.ts`: Import/export translations

---

## Technical Decisions

### Why ID References Instead of Embedding Books?
- **Single source of truth**: Book data is edited in one place
- **Consistency**: Updates to book metadata automatically reflect in all lists
- **Storage efficiency**: No data duplication
- **Referential integrity**: Deleting a book removes it from all lists automatically

### Why Union (not Intersection) for Bulk Remove?
- More intuitive: "Show me all lists these books are in"
- More useful: User can see the full scope of where books exist
- Flexible: User can selectively remove from some lists but not others

### Why Export Includes Full Book Data?
- **Portability**: Recipient gets complete information
- **Backup**: Full restoration capability
- **Sharing**: Others can import without having the books already

---

## Future Enhancements (Post Phase 3)

### Potential additions:
1. **List descriptions/notes**: Rich text descriptions for each list
2. **List cover images**: Visual representation of lists
3. **Smart lists**: Auto-populate based on rules (e.g., "All 5-star sci-fi books")
4. **List ordering**: Custom sort order for books within lists
5. **Nested lists**: Lists can contain sub-lists
6. **Collaborative lists**: Share and edit lists with other users
7. **List templates**: Predefined list structures (e.g., "Reading Challenge 2025")
8. **Statistics**: Reading progress per list, completion rates

---

## Migration Notes

### Database Migrations
- v1 → v2: Added `bookLists` table
- Future migrations should preserve existing data
- Consider adding migration tests

### Backwards Compatibility
- Users without book lists: Feature is optional, doesn't affect existing workflow
- Old exports: Can still import old JSON format (without book lists)
- Future exports: Should be compatible with older app versions (graceful degradation)

---

## Development Status

| Phase | Status | Completion Date |
|-------|--------|----------------|
| Phase 1: Core Functionality | ✅ Completed | 2025-12-30 |
| Phase 2: Enhanced Operations | 🔄 In Progress | - |
| Phase 3: Import/Export | 📋 Planned | - |

Last updated: 2025-12-31
