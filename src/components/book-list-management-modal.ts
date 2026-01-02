import { i18n } from '../modules/i18n';
import { storage } from '../modules/storage';

export class BookListManagementModal {
  private modalElement: HTMLElement | null = null;
  private bookId?: string;
  private onChange?: () => void;

  async show(bookId: string, onChange?: () => void): Promise<void> {
    this.bookId = bookId;
    this.onChange = onChange;

    if (!this.modalElement) {
      this.createModal();
    }

    await this.updateContent();
  }

  private createModal(): void {
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal';
    this.modalElement.innerHTML = `
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>⭐ ${i18n.t('bookForm.bookLists.manage')}</h2>
          <button class="btn-close" id="btn-close-management">&times;</button>
        </div>
        <div class="modal-body" id="book-list-modal-body">
          <!-- Content will be dynamically updated -->
        </div>
      </div>
    `;

    document.body.appendChild(this.modalElement);

    // Attach static event listeners
    this.modalElement.querySelector('#btn-close-management')?.addEventListener('click', () => {
      this.close();
    });

    // Click outside to close
    this.modalElement.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.close();
      }
    });

    // ESC key to close
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Show modal with animation
    setTimeout(() => this.modalElement?.classList.add('active'), 10);
  }

  private async updateContent(): Promise<void> {
    const book = await storage.getBook(this.bookId!);
    if (!book) {
      console.error('Book not found');
      return;
    }

    const allLists = await storage.getBookLists();

    // Separate lists into "in" and "not in"
    const listsWithBook: Array<{ id: string; name: string; comment?: string }> = [];
    const listsWithoutBook: Array<{ id: string; name: string }> = [];

    for (const list of allLists) {
      const bookItem = list.books.find((item) => item.bookId === this.bookId);
      if (bookItem) {
        listsWithBook.push({
          id: list.id,
          name: list.name,
          comment: bookItem.comment,
        });
      } else {
        listsWithoutBook.push({
          id: list.id,
          name: list.name,
        });
      }
    }

    const modalBody = this.modalElement?.querySelector('#book-list-modal-body');
    if (!modalBody) return;

    modalBody.innerHTML = `
      <div class="book-info-preview">
        <div class="book-title">${this.escapeHtml(book.title)}</div>
        <div class="book-author">${this.escapeHtml(book.author)}</div>
      </div>

      ${
        listsWithBook.length > 0
          ? `
        <h3>${i18n.t('bookForm.bookLists.inLists')}</h3>
        <div class="book-lists-management-container">
          ${listsWithBook
            .map(
              (list) => `
            <div class="book-list-management-item" data-list-id="${list.id}">
              <div class="book-list-header">
                <span class="book-list-name">📚 ${this.escapeHtml(list.name)}</span>
                <button type="button" class="btn-icon btn-small btn-remove-from-list" data-list-id="${
                  list.id
                }" title="${i18n.t('bookForm.bookLists.removeFrom')}">
                  ➖
                </button>
              </div>
              <div class="book-list-comment">
                ${
                  list.comment
                    ? `<div class="comment-display">${this.escapeHtml(list.comment)}</div>`
                    : `<div class="no-comment">${i18n.t('bookForm.bookLists.noComment')}</div>`
                }
                <button type="button" class="btn-small btn-secondary btn-edit-list-comment" data-list-id="${
                  list.id
                }">
                  ${i18n.t('bookForm.bookLists.editComment')}
                </button>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : `
        <p class="text-secondary">${i18n.t('bookForm.bookLists.empty')}</p>
      `
      }

      ${
        listsWithoutBook.length > 0
          ? `
        <h3>${i18n.t('bookForm.bookLists.notInLists')}</h3>
        <div class="book-lists-add-container">
          ${listsWithoutBook
            .map(
              (list) => `
            <button type="button" class="btn-full btn-list-option" data-list-id="${list.id}">
              📚 ${this.escapeHtml(list.name)}
              <span class="action-icon">➕</span>
            </button>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }

      ${
        allLists.length === 0
          ? `
        <p class="text-secondary">${i18n.t('bookListSelector.noLists')}</p>
      `
          : ''
      }
    `;

    this.attachDynamicEventListeners();
  }

  private attachDynamicEventListeners(): void {
    // Remove from list buttons
    this.modalElement?.querySelectorAll('.btn-remove-from-list').forEach((btn) => {
      btn.addEventListener('click', () => {
        void (async () => {
          const listId = (btn as HTMLElement).dataset.listId!;
          const allLists = await storage.getBookLists();
          const list = allLists.find((l) => l.id === listId);

          if (list && confirm(i18n.t('bookForm.bookLists.removeConfirm', { name: list.name }))) {
            await storage.removeBookFromList(listId, this.bookId!);
            if (this.onChange) this.onChange();
            await this.updateContent();
          }
        })();
      });
    });

    // Edit comment buttons
    this.modalElement?.querySelectorAll('.btn-edit-list-comment').forEach((btn) => {
      btn.addEventListener('click', () => {
        void (async () => {
          const listId = (btn as HTMLElement).dataset.listId!;
          const currentComment = await storage.getBookComment(listId, this.bookId!);

          const { BookCommentEditModal } = await import('./book-comment-edit-modal');
          const modal = new BookCommentEditModal();
          await modal.show(this.bookId!, listId, currentComment, (newComment) => {
            void (async () => {
              await storage.updateBookComment(listId, this.bookId!, newComment);
              if (this.onChange) this.onChange();
              await this.updateContent();
            })();
          });
        })();
      });
    });

    // Add to list buttons
    this.modalElement?.querySelectorAll('.btn-list-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        void (async () => {
          const listId = (btn as HTMLElement).dataset.listId!;
          await storage.addBookToList(listId, this.bookId!);
          if (this.onChange) this.onChange();
          await this.updateContent();
        })();
      });
    });
  }

  private close(): void {
    this.modalElement?.classList.remove('active');
    setTimeout(() => {
      this.modalElement?.remove();
      this.modalElement = null;
    }, 300);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
