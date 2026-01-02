import { i18n } from '../modules/i18n';
import { storage } from '../modules/storage';

export class BookListSelectorModal {
  private modalElement: HTMLElement | null = null;
  private onSelect?: (bookListId: string) => void;
  private bookId?: string;

  async show(bookId: string, onSelect: (bookListId: string) => void): Promise<void> {
    this.bookId = bookId;
    this.onSelect = onSelect;
    await this.render();
  }

  private async render(): Promise<void> {
    if (this.modalElement) {
      this.modalElement.remove();
    }

    const bookLists = await storage.getBookLists();

    // Check which lists already contain this book
    const listStatus = await Promise.all(
      bookLists.map(async (list) => ({
        list,
        isInList: this.bookId ? await storage.isBookInList(list.id, this.bookId) : false,
      }))
    );

    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal';
    this.modalElement.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>${i18n.t('bookListSelector.selectTitle')}</h2>
          <button class="btn-close" id="btn-close-selector">&times;</button>
        </div>
        <div class="modal-body">
          ${
            bookLists.length === 0
              ? `
            <p class="text-secondary">${i18n.t('bookListSelector.noLists')}</p>
          `
              : `
            <div class="book-list-options">
              ${listStatus
                .map(
                  ({ list, isInList }) => `
                <button 
                  class="btn-full btn-list-option ${isInList ? 'disabled' : ''}" 
                  data-id="${list.id}"
                  ${isInList ? 'disabled' : ''}>
                  📚 ${this.escapeHtml(list.name)}
                  ${isInList ? `<span class="badge-in-list">${i18n.t('bookListSelector.alreadyInList')}</span>` : ''}
                </button>
              `
                )
                .join('')}
            </div>
          `
          }
        </div>
      </div>
    `;

    document.body.appendChild(this.modalElement);
    this.attachEventListeners();

    // Show modal with animation
    setTimeout(() => this.modalElement?.classList.add('active'), 10);
  }

  private attachEventListeners(): void {
    // Close button
    this.modalElement?.querySelector('#btn-close-selector')?.addEventListener('click', () => {
      this.close();
    });

    // Book list option buttons
    this.modalElement?.querySelectorAll('.btn-list-option:not(.disabled)').forEach((btn) => {
      btn.addEventListener('click', () => {
        const listId = (btn as HTMLElement).dataset.id!;
        if (this.onSelect) {
          this.onSelect(listId);
        }
        this.close();
      });
    });

    // Click outside to close
    this.modalElement?.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.close();
      }
    });
  }

  private close(): void {
    if (this.modalElement) {
      this.modalElement.classList.remove('active');
      setTimeout(() => {
        this.modalElement?.remove();
        this.modalElement = null;
      }, 300);
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
