import type { Book, SearchFilters, SortField, SortOrder } from '../types';
import { storage } from '../modules/storage';
import { searchBooks, sortBooks } from '../modules/search';
import { BookCard } from './book-card';

export class BookList {
  private element: HTMLElement;
  private onEdit: (book: Book) => void;
  private onDelete: (id: string) => void;
  private onBulkSelectChange?: (selectedIds: string[]) => void;

  private currentFilters: SearchFilters = { query: '', status: 'all' };
  private currentSortField: SortField = 'addedAt';
  private currentSortOrder: SortOrder = 'desc';
  private bulkSelectMode: boolean = false;

  constructor(
    containerId: string,
    onEdit: (book: Book) => void,
    onDelete: (id: string) => void
  ) {
    this.element = document.getElementById(containerId)!;
    this.onEdit = onEdit;
    this.onDelete = onDelete;
  }

  setBulkSelectMode(enabled: boolean, onBulkSelectChange?: (selectedIds: string[]) => void): void {
    this.bulkSelectMode = enabled;
    this.onBulkSelectChange = onBulkSelectChange;
    this.render();
  }

  render(): void {
    let books = storage.getBooks();

    // Apply filters and sorting
    books = searchBooks(books, this.currentFilters);
    books = sortBooks(books, this.currentSortField, this.currentSortOrder);

    if (books.length === 0) {
      this.element.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <h2>No books yet</h2>
          <p>Scan a barcode to add your first book</p>
        </div>
      `;
      return;
    }

    const cardsHtml = books.map(book => BookCard.render(book, this.onEdit, this.onDelete, this.bulkSelectMode)).join('');

    this.element.innerHTML = `
      <div class="book-grid">
        ${cardsHtml}
      </div>
    `;

    // Attach event listeners to all cards
    BookCard.attachEventListeners(this.element, this.onEdit, this.onDelete, this.onBulkSelectChange);
  }

  updateFilters(filters: SearchFilters, sortField: SortField, sortOrder: SortOrder): void {
    this.currentFilters = filters;
    this.currentSortField = sortField;
    this.currentSortOrder = sortOrder;
    this.render();
  }
}
