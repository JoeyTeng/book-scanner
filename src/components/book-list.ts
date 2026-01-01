import type { Book, SearchFilters, SortField, SortOrder, ViewMode } from '../types';
import { storage } from '../modules/storage';
import { searchBooks, sortBooks } from '../modules/search';
import { BookCard } from './book-card';
import { i18n } from '../modules/i18n';

export class BookList {
  private element: HTMLElement;
  private onEdit: (book: Book) => void;
  private onDelete: (id: string) => void;
  private onBulkSelectChange?: (selectedIds: string[]) => void;

  private currentFilters: SearchFilters = { query: "", status: "all" };
  private currentSortField: SortField = "addedAt";
  private currentSortOrder: SortOrder = "desc";
  private bulkSelectMode: boolean = false;
  private viewMode: ViewMode = "grid";
  private activeBookListId: string | null = null;
  private searchScope: "current" | "all" = "all";

  constructor(
    containerId: string,
    onEdit: (book: Book) => void,
    onDelete: (id: string) => void
  ) {
    this.element = document.getElementById(containerId)!;
    this.onEdit = onEdit;
    this.onDelete = onDelete;
  }

  setActiveBookList(bookListId: string | null): void {
    this.activeBookListId = bookListId;
  }

  setBulkSelectMode(
    enabled: boolean,
    onBulkSelectChange?: (selectedIds: string[]) => void
  ): void {
    this.bulkSelectMode = enabled;
    this.onBulkSelectChange = onBulkSelectChange;
    void this.render();
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
    void this.render();
  }

  selectAll(): void {
    if (!this.bulkSelectMode) return;

    const checkboxes = this.element.querySelectorAll(
      ".bulk-select-checkbox"
    ) as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((checkbox) => {
      checkbox.checked = true;
    });

    const selectedIds = Array.from(checkboxes).map((cb) => cb.dataset.id!);
    if (this.onBulkSelectChange) {
      this.onBulkSelectChange(selectedIds);
    }
  }

  deselectAll(): void {
    if (!this.bulkSelectMode) return;

    const checkboxes = this.element.querySelectorAll(
      ".bulk-select-checkbox"
    ) as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });

    if (this.onBulkSelectChange) {
      this.onBulkSelectChange([]);
    }
  }

  async render(): Promise<void> {
    let books: Array<Book & { comment?: string }> = [];

    // Apply book list filter if active and scope is "current"
    if (this.activeBookListId && this.searchScope === "current") {
      // Get books with comments from the active book list
      books = await storage.getBooksInList(this.activeBookListId);
    } else {
      // Get all books (no comments)
      books = await storage.getBooks();
    }

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
          <p>${i18n.t("bookList.empty")}</p>
        </div>
      `;
      return;
    }

    if (this.viewMode === "grid") {
      await this.renderGrid(books);
    } else {
      await this.renderList(books);
    }
  }

  private async renderGrid(books: Book[]): Promise<void> {
    const cardsHtmlPromises = books.map((book) =>
      BookCard.render(
        book,
        this.onEdit,
        this.onDelete,
        this.bulkSelectMode,
        this.activeBookListId
      )
    );
    const cardsHtml = (await Promise.all(cardsHtmlPromises)).join("");

    this.element.innerHTML = `
      <div class="book-grid">
        ${cardsHtml}
      </div>
    `;

    // Attach event listeners to all cards
    BookCard.attachEventListeners(
      this.element,
      this.onEdit,
      this.onDelete,
      this.onBulkSelectChange,
      this.activeBookListId,
      () => void this.render()
    );
  }

  private async renderList(books: Book[]): Promise<void> {
    const rowsHtmlPromises = books.map((book) => this.renderListRow(book));
    const rowsHtmlArray = await Promise.all(rowsHtmlPromises);
    const rowsHtml = rowsHtmlArray.join("");

    this.element.innerHTML = `
      <div class="book-list-view">
        <table class="book-table">
          <thead>
            <tr>
              ${this.bulkSelectMode ? '<th class="col-checkbox"></th>' : ""}
              <th class="col-cover"></th>
              <th class="col-title">Title</th>
              <th class="col-author">Author</th>
              <th class="col-isbn">ISBN</th>
              <th class="col-status">Status</th>
              <th class="col-categories">Categories</th>
              <th class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    this.attachListEventListeners();
  }

  private async renderListRow(book: Book & { comment?: string }): Promise<string> {
    const statusColor = this.getStatusColor(book.status);
    const statusLabel = this.getStatusLabel(book.status);

    return `
      <tr class="book-row" data-id="${book.id}">
        ${
          this.bulkSelectMode
            ? `
          <td class="col-checkbox">
            <input type="checkbox" class="bulk-select-checkbox" data-id="${book.id}">
          </td>
        `
            : ""
        }
        <td class="col-cover">
          ${
            book.cover
              ? `<img src="${book.cover}" alt="${this.escapeHtml(
                  book.title
                )}" loading="lazy">`
              : '<div class="no-cover">📚</div>'
          }
        </td>
        <td class="col-title">
          <div class="title-cell">
            <strong>${this.escapeHtml(book.title)}</strong>
            ${
              book.comment && this.activeBookListId
                ? `<div class="comment-preview">💬 ${this.escapeHtml(book.comment)}</div>`
                : ""
            }
            ${
              book.notes
                ? `<div class="notes-preview">${this.escapeHtml(
                    book.notes.substring(0, 80)
                  )}${book.notes.length > 80 ? "..." : ""}</div>`
                : ""
            }
          </div>
        </td>
        <td class="col-author">${this.escapeHtml(book.author)}</td>
        <td class="col-isbn"><code>${this.escapeHtml(book.isbn)}</code></td>
        <td class="col-status">
          <span class="badge" style="background-color: ${statusColor}20; color: ${statusColor};">
            ${statusLabel}
          </span>
        </td>
        <td class="col-categories">
          ${book.categories
            .map(
              (cat) =>
                `<span class="badge badge-category">${this.escapeHtml(
                  cat
                )}</span>`
            )
            .join(" ")}
        </td>
        <td class="col-actions">
          ${await this.renderBookListButton(book.id)}
          <button class="btn-small btn-edit" data-id="${book.id}">Edit</button>
          <button class="btn-small btn-delete" data-id="${
            book.id
          }">Delete</button>
        </td>
      </tr>
    `;
  }

  private async renderBookListButton(bookId: string): Promise<string> {
    // Check if book is in any book list
    const allLists = await storage.getBookLists();
    const isInAnyList = allLists.some((list) =>
      list.books.some((item) => item.bookId === bookId)
    );

    // Use different icon based on whether book is in any list
    const icon = isInAnyList ? "⭐" : "☆";
    const buttonClass = isInAnyList
      ? "btn-manage-book-lists in-lists"
      : "btn-manage-book-lists";

    return `<button class="btn-small btn-icon ${buttonClass}" data-id="${bookId}" title="${i18n.t(
      "bookCard.manageBookLists"
    )}">${icon}</button>`;
  }

  private attachListEventListeners(): void {
    // Manage book lists button
    this.element.querySelectorAll(".btn-manage-book-lists").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const bookId = (btn as HTMLElement).dataset.id!;
        const { BookListManagementModal } = await import(
          "./book-list-management-modal"
        );
        const modal = new BookListManagementModal();
        await modal.show(bookId, () => {
          void this.render();
        });
      });
    });

    // Edit buttons
    this.element.querySelectorAll(".btn-edit").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = (btn as HTMLElement).dataset.id!;
        const book = await storage.getBook(id);
        if (book) this.onEdit(book);
      });
    });

    // Delete buttons
    this.element.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = (btn as HTMLElement).dataset.id!;
        const book = await storage.getBook(id);
        if (book && confirm(`Delete "${book.title}"?`)) {
          this.onDelete(id);
        }
      });
    });

    // Bulk selection checkboxes
    if (this.onBulkSelectChange) {
      this.element
        .querySelectorAll(".bulk-select-checkbox")
        .forEach((checkbox) => {
          checkbox.addEventListener("change", () => {
            const selectedCheckboxes = this.element.querySelectorAll(
              ".bulk-select-checkbox:checked"
            );
            const selectedIds = Array.from(selectedCheckboxes).map(
              (cb) => (cb as HTMLInputElement).dataset.id!
            );
            this.onBulkSelectChange!(selectedIds);
          });
        });
    }
  }

  private getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      want: "#007bff",
      reading: "#28a745",
      read: "#6c757d",
    };
    return colors[status] || "#6c757d";
  }

  private getStatusLabel(status: string): string {
    return i18n.t(`bookForm.status.${status}`);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  updateFilters(
    filters: SearchFilters,
    sortField: SortField,
    sortOrder: SortOrder,
    searchScope?: "current" | "all"
  ): void {
    this.currentFilters = filters;
    this.currentSortField = sortField;
    this.currentSortOrder = sortOrder;
    this.searchScope = searchScope || "all";
    void this.render();
  }
}
