import type { Book } from '../types';
import { STATUS_COLORS } from '../config';
import { storage } from '../modules/storage';
import { formatISBN } from '../utils/isbn';
import { i18n } from '../modules/i18n';

export class BookCard {
  static async render(
    book: Book,
    _onEdit: (book: Book) => void,
    _onDelete: (id: string) => void,
    bulkSelectMode: boolean = false,
    activeBookListId: string | null = null
  ): Promise<string> {
    const statusColor = STATUS_COLORS[book.status];
    const statusLabel = i18n.t(`bookForm.status.${book.status}`);

    // Determine book list button state
    let bookListButton = '';
    if (!bulkSelectMode) {
      if (activeBookListId) {
        // Check if book is in the active list
        const isInList = await storage.isBookInList(activeBookListId, book.id);
        const bookList = await storage.getBookList(activeBookListId);
        const listName = bookList?.name || '';
        
        if (isInList) {
          // Book is in list - show remove button
          bookListButton = `<button class="btn-small btn-icon btn-remove-from-list" data-id="${book.id}" title="${i18n.t('bookCard.removeFromList', { name: listName })}">➖</button>`;
        } else {
          // Book not in list - show add button
          bookListButton = `<button class="btn-small btn-icon btn-add-to-list" data-id="${book.id}" title="${i18n.t('bookCard.addToList', { name: listName })}">➕</button>`;
        }
      } else {
        // No active list - show generic add button
        bookListButton = `<button class="btn-small btn-icon btn-select-list" data-id="${book.id}" title="${i18n.t('bookCard.addToBookList')}">➕</button>`;
      }
    }

    return `
      <div class="book-card" data-id="${book.id}">
        ${bulkSelectMode ? `
          <div class="book-checkbox">
            <input type="checkbox" class="bulk-select-checkbox" data-id="${book.id}">
          </div>
        ` : ''}
        ${book.cover ? `
          <div class="book-cover">
            <img src="${book.cover}" alt="${book.title}" loading="lazy">
          </div>
        ` : ''}
        <div class="book-info">
          <h3 class="book-title">${this.escapeHtml(book.title)}</h3>
          <p class="book-author">${this.escapeHtml(book.author)}</p>
          ${book.publisher ? `<p class="book-meta">${this.escapeHtml(book.publisher)}</p>` : ''}
          ${book.publishDate ? `<p class="book-meta">${this.escapeHtml(book.publishDate)}</p>` : ''}
          <p class="book-isbn">${formatISBN(book.isbn)}</p>

          <div class="book-badges">
            <span class="badge" style="background-color: ${statusColor}20; color: ${statusColor};">
              ${statusLabel}
            </span>
            ${book.categories.map(cat => `
              <span class="badge badge-category">${this.escapeHtml(cat)}</span>
            `).join('')}
          </div>

          ${book.tags.length > 0 ? `
            <div class="book-tags">
              ${book.tags.map(tag => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}

          ${book.notes ? `
            <p class="book-notes">${this.escapeHtml(book.notes)}</p>
          ` : ''}

          <div class="book-actions">
            <button class="btn-small btn-edit" data-id="${book.id}">${i18n.t('common.edit')}</button>
            <button class="btn-small btn-delete" data-id="${book.id}">${i18n.t('common.delete')}</button>
            ${bookListButton}
          </div>
        </div>
      </div>
    `;
  }

  static attachEventListeners(
    container: HTMLElement,
    onEdit: (book: Book) => void,
    onDelete: (id: string) => void,
    onBulkSelectChange?: (selectedIds: string[]) => void,
    activeBookListId: string | null = null,
    onBookListChange?: () => void
  ): void {
    container.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.id!;
        const book = await storage.getBook(id);
        if (book) onEdit(book);
      });
    });

    container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = (btn as HTMLElement).dataset.id!;
        const book = await storage.getBook(id);
        if (book && confirm(i18n.t('confirm.deleteBook'))) {
          onDelete(id);
        }
      });
    });

    // Bulk selection checkboxes
    if (onBulkSelectChange) {
      container.querySelectorAll('.bulk-select-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
          const selectedCheckboxes = container.querySelectorAll('.bulk-select-checkbox:checked');
          const selectedIds = Array.from(selectedCheckboxes).map(cb => (cb as HTMLInputElement).dataset.id!);
          onBulkSelectChange(selectedIds);
        });
      });
    }

    // Book list buttons
    container.querySelectorAll('.btn-add-to-list').forEach(btn => {
      btn.addEventListener('click', async () => {
        const bookId = (btn as HTMLElement).dataset.id!;
        if (activeBookListId) {
          await storage.addBookToList(activeBookListId, bookId);
          if (onBookListChange) onBookListChange();
        }
      });
    });

    container.querySelectorAll('.btn-remove-from-list').forEach(btn => {
      btn.addEventListener('click', async () => {
        const bookId = (btn as HTMLElement).dataset.id!;
        if (activeBookListId) {
          await storage.removeBookFromList(activeBookListId, bookId);
          if (onBookListChange) onBookListChange();
        }
      });
    });

    container.querySelectorAll('.btn-select-list').forEach(btn => {
      btn.addEventListener('click', async () => {
        const bookId = (btn as HTMLElement).dataset.id!;
        const { BookListSelectorModal } = await import('./book-list-selector-modal');
        const modal = new BookListSelectorModal();
        await modal.show(bookId, async (listId) => {
          await storage.addBookToList(listId, bookId);
          if (onBookListChange) onBookListChange();
        });
      });
    });
  }

  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
