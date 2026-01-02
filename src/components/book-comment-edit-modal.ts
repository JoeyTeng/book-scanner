import { i18n } from '../modules/i18n';
import { storage } from '../modules/storage';

const MAX_COMMENT_LENGTH = 500;

export class BookCommentEditModal {
  private modalElement: HTMLElement | null = null;
  private onSave?: (comment: string | undefined) => void;
  private bookId?: string;
  private bookListId?: string;
  private currentComment?: string;

  async show(
    bookId: string,
    bookListId: string,
    currentComment: string | undefined,
    onSave: (comment: string | undefined) => void
  ): Promise<void> {
    this.bookId = bookId;
    this.bookListId = bookListId;
    this.currentComment = currentComment;
    this.onSave = onSave;
    await this.render();
  }

  private async render(): Promise<void> {
    if (this.modalElement) {
      this.modalElement.remove();
    }

    const bookList = await storage.getBookList(this.bookListId!);
    const book = await storage.getBook(this.bookId!);

    if (!bookList || !book) {
      console.error('Book or book list not found');
      return;
    }

    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal';
    this.modalElement.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>${i18n.t('bookCommentEdit.title')}</h2>
          <button class="btn-close" id="btn-close-comment-edit">&times;</button>
        </div>
        <div class="modal-body">
          <div class="book-info-preview">
            <div class="book-title">${this.escapeHtml(book.title)}</div>
            <div class="book-list-name">📚 ${this.escapeHtml(bookList.name)}</div>
          </div>
          <div class="form-group">
            <label for="comment-textarea">${i18n.t('bookCommentEdit.commentLabel')}</label>
            <textarea
              id="comment-textarea"
              class="form-control"
              rows="6"
              placeholder="${i18n.t('bookCommentEdit.commentPlaceholder')}"
            >${this.currentComment || ''}</textarea>
            <div class="char-counter">
              <span id="char-count">${
                (this.currentComment || '').length
              }</span>/<span>${MAX_COMMENT_LENGTH}</span>
              <span class="over-limit-warning" id="over-limit-warning" style="display: none;">
                ${i18n.t('bookCommentEdit.overLimit')}
              </span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="btn-cancel-comment">${i18n.t(
            'common.cancel'
          )}</button>
          <button class="btn btn-danger" id="btn-delete-comment" ${
            !this.currentComment ? 'style="display: none;"' : ''
          }>
            ${i18n.t('bookCommentEdit.deleteComment')}
          </button>
          <button class="btn btn-primary" id="btn-save-comment">${i18n.t('common.save')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalElement);
    this.attachEventListeners();

    // Show modal with animation
    setTimeout(() => this.modalElement?.classList.add('active'), 10);

    // Focus on textarea
    setTimeout(() => {
      (this.modalElement?.querySelector('#comment-textarea') as HTMLTextAreaElement)?.focus();
    }, 100);
  }

  private attachEventListeners(): void {
    const textarea = this.modalElement?.querySelector('#comment-textarea') as HTMLTextAreaElement;
    const charCount = this.modalElement?.querySelector('#char-count') as HTMLSpanElement;
    const overLimitWarning = this.modalElement?.querySelector(
      '#over-limit-warning'
    ) as HTMLSpanElement;
    const saveButton = this.modalElement?.querySelector('#btn-save-comment') as HTMLButtonElement;

    // Character counter
    textarea?.addEventListener('input', () => {
      const length = textarea.value.length;
      charCount.textContent = length.toString();

      if (length > MAX_COMMENT_LENGTH) {
        textarea.classList.add('over-limit');
        overLimitWarning.style.display = 'inline';
        saveButton.disabled = true;
      } else {
        textarea.classList.remove('over-limit');
        overLimitWarning.style.display = 'none';
        saveButton.disabled = false;
      }
    });

    // Close button
    this.modalElement?.querySelector('#btn-close-comment-edit')?.addEventListener('click', () => {
      this.close();
    });

    // Cancel button
    this.modalElement?.querySelector('#btn-cancel-comment')?.addEventListener('click', () => {
      this.close();
    });

    // Delete button
    this.modalElement?.querySelector('#btn-delete-comment')?.addEventListener('click', () => {
      if (confirm(i18n.t('bookCommentEdit.confirmDelete'))) {
        if (this.onSave) {
          this.onSave(undefined);
        }
        this.close();
      }
    });

    // Save button
    saveButton?.addEventListener('click', () => {
      const comment = textarea.value.trim();
      if (this.onSave) {
        this.onSave(comment || undefined);
      }
      this.close();
    });

    // ESC key to close
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
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
