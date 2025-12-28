import type { Book } from '../types';
import { STATUS_LABELS, STATUS_COLORS } from '../config';
import { storage } from '../modules/storage';
import { formatISBN } from '../utils/isbn';

export class BookCard {
  static render(book: Book, _onEdit: (book: Book) => void, _onDelete: (id: string) => void, bulkSelectMode: boolean = false): string {
    const statusColor = STATUS_COLORS[book.status];
    const statusLabel = STATUS_LABELS[book.status];

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
            <button class="btn-small btn-edit" data-id="${book.id}">Edit</button>
            <button class="btn-small btn-delete" data-id="${book.id}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  static attachEventListeners(
    container: HTMLElement,
    onEdit: (book: Book) => void,
    onDelete: (id: string) => void,
    onBulkSelectChange?: (selectedIds: string[]) => void
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
        if (book && confirm(`Delete "${book.title}"?`)) {
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
  }

  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
