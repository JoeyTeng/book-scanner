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

## Phase 2: Enhanced Operations ✅ COMPLETED

### Features Implemented

### 1. Bulk Edit: Book List Operations ✅

**New section in Bulk Edit Modal**: Added third checkbox section for book list operations

#### Add to Book Lists Mode

- Displays all existing book lists with checkboxes
- Multi-select to add selected books to multiple lists
- Automatically skips if book already in list
- Success toast notification with count

#### Remove from Book Lists Mode

- Displays **union** of all book lists containing any selected book
- Example:
  - Book A in ["Sci-Fi", "Recommended"]
  - Book B in ["Sci-Fi", "Must-Read"]
  - Book C in ["Recommended"]
  - Shows: ["Sci-Fi", "Recommended", "Must-Read"] (union)
- Multi-select to remove books from selected lists
- Only removes if book actually exists in that list

#### Special Behavior

- When viewing a specific book list (not "All Books"):
  - Defaults to "Remove" mode
  - Pre-selects current active book list
  - User can switch to "Add" mode if needed

**Files modified**:

- `bulk-edit-modal.ts`: Added book list operations section with mode toggle
- `en.ts`, `zh-CN.ts`: Added `bulkEdit.bookListOperation.*` translations
- `components.css`: Added `.checkbox-list`, `.checkbox-item` styles

### 2. BookCard: Add/Remove Button ✅

**Button behavior implemented**:

#### No Active Book List (showing "All Books")

- Display: "➕" icon button
- Click: Opens book list selector modal
- User selects destination book list
- Already-in lists shown as disabled with badge
- Toast notification on success

#### Active Book List Selected

- If book **is in** current list:
  - Display: "➖" button with tooltip showing list name
  - Click: Removes book from current list
  - Button updates immediately

- If book **not in** current list:
  - Display: "➕" button with tooltip
  - Click: Adds book to current list
  - Button updates immediately

**Components created**:

- `book-list-selector-modal.ts`: Simple selector popup (95 lines)
  - Shows all book lists
  - Checks membership with `isBookInList()`
  - Disables and grays out lists already containing book
  - Shows "Already in list" badge

**Files modified**:

- `book-card.ts`: Made `render()` async, added `activeBookListId` parameter, three button states
- `book-list.ts`: Updated to async `renderGrid()` with `Promise.all`
- `en.ts`, `zh-CN.ts`: Added `bookCard.*` and `bookListSelector.*` translations
- `components.css`: Added `.btn-icon.btn-small`, `.badge-in-list`, disabled button styles

### 3. SearchBar: Search Scope Toggle ✅

**UI implemented**: Dropdown menu integrated into search icon

```
[🔍] ← Click to toggle
[All] or [in list] label below icon

Dropdown menu:
- All Books
- Current Book List
```

**Behavior**:

- Scope toggle only appears when a book list is active
- Small label below search icon shows current scope:
  - "All" / "全部" when searching all books
  - "in list" / "书单" when searching current list only
- Click icon to show dropdown with two options
- When toggled, re-filters search results immediately
- Switching book lists defaults to "current" scope
- Search input and all filters preserved when switching scope

**Implementation details**:

- SearchBar tracks `activeBookListId` and `searchScope` state
- SearchBar tracks `currentSortOrder` to persist sort across re-renders
- `setActiveBookList()` defaults to "current" scope and triggers filter update
- `triggerFilterChange()` method emits filter change with current scope
- BookList applies book list filter only when `searchScope === "current"`
- Saves and restores all filter values when switching scope or book list

**Files modified**:

- `search-bar.ts`: Added scope state, dropdown UI, event handlers, filter preservation
- `app.ts`: Pass `activeBookListId` to SearchBar, get scope in filter callback
- `book-list.ts`: Added `searchScope` parameter to `updateFilters()`, conditional filtering
- `en.ts`, `zh-CN.ts`: Added `searchBar.scope.*` translations (all, inList, currentFull)
- `layout.css`: Added `.search-icon-wrapper`, `.search-scope-label`, `.search-scope-dropdown` styles

### Verification Points

- ✅ Bulk edit: Add books to multiple lists
- ✅ Bulk edit: Remove books from multiple lists
- ✅ Bulk edit: Pre-selects current list in remove mode
- ✅ BookCard: Shows context-aware button (➕/➖)
- ✅ BookCard: Selector modal disables already-in lists
- ✅ SearchBar: Scope toggle appears only when list is active
- ✅ SearchBar: Defaults to "current" when switching to a list
- ✅ SearchBar: Search text preserved when switching scope
- ✅ SearchBar: All filters preserved when switching

---

## Phase 2.5: Book List Comments ✅ COMPLETED

### Overview
Add per-list comments for each book, allowing users to add public, shareable notes specific to each book list context.

### Features to Implement

#### 1. Data Model Changes ✅

**Updated BookList Interface**:
```typescript
interface BookInList {
  bookId: string;
  comment?: string;     // Public comment, 500 char limit
  addedAt: Date;        // When book was added to this list
}

interface BookList {
  id: string;
  name: string;
  description?: string;
  books: BookInList[];  // Replaces bookIds: string[]
  createdAt: Date;
  updatedAt: Date;
}
```

**Database Migration**: v2 → v3
- Convert `bookIds: string[]` to `books: BookInList[]`
- Set `addedAt` to `bookList.updatedAt` or current time
- Initial `comment` is `undefined`

#### 2. Storage API Updates ✅

**Modified methods**:
- `addBookToList(bookListId, bookId, comment?)`: Accept optional comment
- `getBooksInList(bookListId)`: Return books with comment and addedAt

**New methods**:
- `updateBookComment(bookListId, bookId, comment)`: Update comment
- `getBookComment(bookListId, bookId)`: Get comment for specific book

#### 3. UI Components ✅

**3.1 Comment Edit Modal** ✅
- Modal popup for editing comments
- Textarea with 500 character limit
- Real-time character counter (e.g., "234/500")
- Red border and warning when over limit
- Does not prevent typing (supports IME)
- Prevents submission when over limit
- Note: "This comment can be publicly shared"

**3.2 Book List Management Modal** ✅
- **Google Maps-style collection interface**
- Single modal for managing all book list memberships
- Shows book info preview at top
- Two sections:
  - "已添加到" (In Lists): Lists containing the book
  - "可添加到" (Add to): Available lists to add
- In-place operations: add, remove, edit comment
- No page flash when adding/removing (content-only updates)
- Unified entry point from BookForm and BookCard

**3.3 BookCard Display** ✅
- Single ⭐/☆ button for collection management
- Dynamic icon based on list membership:
  - ☆ (empty star): Book not in any list
  - ⭐ (filled star): Book in one or more lists
- Visual feedback:
  - Opacity 0.6 for unsaved books
  - Opacity 1.0 for saved books
  - Scale 1.15x on hover
- Opens BookListManagementModal

**3.4 BookForm - Book Lists Section** ✅
- Replaced detailed list section with collection button
- Button shows "⭐ 管理收藏书单" with badge showing count
- Badge only visible when book is in lists
- Opens BookListManagementModal
- Privacy notices changed to inline text (mobile-friendly)

#### 4. Technical Improvements ✅

**4.1 Modal Flash Fix**
- **Problem**: Modal flickered when adding/removing books (entire modal was removed and recreated)
- **Solution**: Separated modal into static and dynamic parts
  - `createModal()`: Creates modal skeleton once (header, close buttons, static event listeners)
  - `updateContent()`: Updates only the body content
  - `attachDynamicEventListeners()`: Rebinds only content-related listeners
- **Result**: Smooth content updates without visual interruption

**4.2 Privacy Notice Improvements**
- Removed clickable alert buttons
- Changed to inline `<small class="privacy-hint">` text
- Always visible, better for mobile UX

**4.3 Visual State Feedback**
- Icon distinction: ☆ vs ⭐ for unsaved vs saved
- CSS transitions for smooth opacity and scale changes
- Consistent collection paradigm across all components

#### 5. Files Modified ✅

**New files created**:
- `src/components/book-comment-edit-modal.ts`: Comment editing modal
- `src/components/book-list-management-modal.ts`: Unified collection management modal

**Modified files**:
- `src/types.ts`: Added `BookInList` interface, updated `BookList`
- `src/modules/db.ts`: Database v2→v3 migration
- `src/modules/storage.ts`: Updated methods for comment support
- `src/components/book-form.ts`: Collection button with inline privacy hints
- `src/components/book-card.ts`: Single ⭐/☆ button with state detection
- `src/styles/components.css`: Collection UI styles, button states, privacy hints
- `src/locales/zh-CN.ts`: Added collection management translations
- `src/locales/en.ts`: Added collection management translations

#### 6. Design Decisions ✅

**Character Limit Handling**:
- 500 char soft limit (respects IME composition)
- Over-limit: Red border + warning, but allows typing
- Submit disabled when over limit
- Bulk edit: Does not support comments

**Google Maps-Style Collection Interface**:
- Unified modal approach reduces UI complexity
- Clear visual separation of "in lists" vs "available lists"
- In-place operations avoid navigation overhead
- Content-only updates prevent modal flicker
- Badge count provides at-a-glance membership info

**Icon Selection**:
- ☆ (empty star): Universal symbol for "not saved"
- ⭐ (filled star): Universal symbol for "saved/favorited"
- Consistent with Google Maps collection metaphor

### Verification Points

- ✅ Can add comment when adding book to list
- ✅ Comment respects 500 char limit
- ✅ Over-limit shows warning but allows typing
- ✅ Cannot submit over-limit comment
- ✅ BookCard shows ⭐/☆ based on membership
- ✅ BookCard opacity changes based on state (0.6 vs 1.0)
- ✅ BookForm shows collection button with count badge
- ✅ BookListManagementModal opens from both BookForm and BookCard
- ✅ Can add/remove books from lists in modal
- ✅ Can edit comment from modal
- ✅ Modal updates smoothly without flashing
- ✅ Privacy notices shown as inline text
- ✅ All operations auto-update counts and states

---

## Phase 3: Import/Export (IN PROGRESS)

### Step 1: Export Book Lists ✅ COMPLETED

**Feature**: Export one or more book lists as JSON with full book data

**Export format**:
```typescript
interface BookListExportFormat {
  version: number;        // DB version (currently 3)
  exportedAt: string;     // ISO 8601 timestamp
  lists: BookListExportData[];
}

interface BookListExportData {
  id: string;             // Original list ID (for reference)
  name: string;
  description?: string;
  createdAt: string;      // ISO 8601
  updatedAt: string;      // ISO 8601
  books: ExportedBook[];
}

interface ExportedBook {
  // Basic book info (copied from Book object)
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publishDate?: string;
  coverUrl?: string;
  rating?: number;
  // Note: recommendation and notes are NOT exported (private fields)

  // List-specific info
  comment?: string;       // Book's comment in this list
  addedAt: string;        // ISO 8601
}
```

**File naming**:

- Single list: `${listName}_${YYYY-MM-DD}.json`
- Multiple lists: `book-lists_${YYYY-MM-DD}.json`
- Special chars in filename replaced with `_`

**UI Entry Points**:

1. **Book List Manager Modal**:
   - Checkbox for each list (batch selection)
   - Actions toolbar appears when ≥1 list selected:
     - "📤 Export Selected (N)" button
     - "🗑️ Delete Selected (N)" button
   - Individual "📤" button for quick single export
   - Static hint: "📝 导出不包含私有字段（推荐语、笔记）"

2. **Navbar (when a list is active)**:
   - "📤" export button next to current list name
   - Tooltip: "Export current list"
   - Click → Directly export current list

**Privacy Handling**:

- Private fields (`recommendation`, `notes`) are **never exported**
- Static gray text hint in modal: "导出不包含私有字段（推荐语、笔记）"
- No per-export confirmation needed

**Implementation**:

**New file**: `src/modules/book-list-export.ts`

- `exportBookList(listId: string): Promise<void>` - Single list export
- `exportBookLists(listIds: string[]): Promise<void>` - Batch export
- Helper: `sanitizeFilename(name: string): string`
- Helper: `downloadJSON(data: any, filename: string): void`

**Modified files**:

- `src/components/book-list-manager-modal.ts`:
  - Add checkbox column
  - Add batch selection state
  - Add actions toolbar (export/delete buttons)
  - Keep individual export button
  - Add export hint text

- `src/components/navbar.ts`:
  - Add export button (📤) next to active list name
  - Show only when `activeBookListId !== null`
  - Call `exportBookList(activeBookListId)`

- `src/locales/zh-CN.ts`, `en.ts`:
  - Add `bookListManager.export*` translations
  - Add `navbar.exportCurrentList` translation

**Error handling**:

- List not found → Error toast
- Empty list → Still export (with `books: []`)
- Download blocked → Error toast

**Verification Points**:

- ✅ Can export single list from manager modal
- ✅ Can export single list from navbar button
- ✅ Can select multiple lists and batch export
- ✅ Export creates valid JSON file
- ✅ Private fields (recommendation, notes) not included
- ✅ Comments are included in exported books
- ✅ Filename is sanitized and formatted correctly
- ✅ Empty lists can be exported
- ✅ Batch delete works correctly

---

### Step 2: Batch Delete Enhancement ✅ COMPLETED

**Feature**: Delete multiple book lists at once

**UI**:

- Uses same checkbox selection as batch export
- "🗑️ Delete Selected (N)" button in actions toolbar
- Confirmation dialog before deletion:

  ```
  Delete 3 book lists?
  - "Sci-Fi" (12 books)
  - "Must-Read" (5 books)
  - "Wishlist" (empty)

  This action cannot be undone.

  [Cancel] [Delete]
  ```

**Implementation**:

- `storage.ts`: `deleteBookLists(listIds: string[]): Promise<void>` - Batch delete helper
- `book-list-manager-modal.ts`: Batch delete logic with confirmation

**Verification Points**:

- ✅ Can select multiple lists and batch delete
- ✅ Confirmation dialog shows list details
- ✅ Deletion removes all selected lists
- ✅ UI updates correctly after deletion
- ✅ No success toast after deletion (clean UX)

---

### Step 3: Import Book Lists (TODO)

**Feature**: Import book lists from JSON, handle naming conflicts and duplicate books

**Import flow**:

1. User selects JSON file (via menu: "Import Book Lists")
2. System validates and parses JSON
3. Detects conflicts (if any):
   - Name conflicts (list with same name exists)
   - Book duplicates (match by ISBN or title+author)
4. Show conflict resolution dialog (if needed)
5. Execute import based on user choices
6. Show import summary

**Import format** (accepts Step 1 export format):

- Parse `BookListExportFormat`
- Generate new list IDs (ignore imported IDs)
- Skip private fields if present in import data

**Conflict Resolution Options**:

**List name conflicts**:

- Replace: Delete existing, import new
- Keep both: Auto-rename import (append " (2)", " (3)", etc.)
- Skip: Don't import this list

**Book duplicates** (match by ISBN, or title+author if no ISBN):

- Skip: Keep existing book, add to list
- Update: Merge data (import data preferred)
- Duplicate: Add as new book (generate new ID)

**Default strategy** (if no conflicts):

- New lists → Import directly with new IDs
- New books → Add to database
- Existing books → Reuse existing book IDs

**Implementation**:

**New files**:

- `src/modules/book-list-import.ts`: Import logic, conflict detection
- `src/components/book-list-import-modal.ts`: Conflict resolution UI

**Modified files**:

- `src/components/navbar.ts`: Add "Import Book Lists" menu item
- `src/locales/zh-CN.ts`, `en.ts`: Import translations

**Verification Points**:

- ✅ Can import lists without conflicts
- ✅ Detects list name conflicts
- ✅ Detects book duplicates (ISBN match)
- ✅ Detects book duplicates (title+author match)
- ✅ Conflict dialog shows all conflicts
- ✅ Can resolve conflicts individually
- ✅ "Apply to all" works correctly
- ✅ Import summary shows results
- ✅ Private fields not imported
- ✅ UI refreshes after import

---

### Implementation Plan

**Priority 1: Export (Current)** ✅ COMPLETED

1. ✅ Create `book-list-export.ts`
2. ✅ Add batch selection to Book List Manager Modal
3. ✅ Add export buttons (individual + batch)
4. ✅ Add export button to navbar
5. ✅ Add batch delete functionality
6. ✅ Add i18n translations
7. ✅ Test all export scenarios

**Priority 2: Import (Next)** ⏳ PLANNED

1. ⏳ Create `book-list-import.ts` (parsing + validation)
2. ⏳ Implement conflict detection logic
3. ⏳ Create `book-list-import-modal.ts` (UI)
4. ⏳ Add import menu item to navbar
5. ⏳ Test all import scenarios
6. ⏳ Test conflict resolution paths

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
| Phase 2: Enhanced Operations | ✅ Completed | 2025-12-31 |
| Phase 2.5: Book List Comments | ✅ Completed | 2025-12-31 |
| Phase 3.1: Export Book Lists | ✅ Completed | 2025-12-31 |
| Phase 3.2: Import Book Lists | 📋 Planned | - |

Last updated: 2025-12-31
