import { storage } from '../modules/storage';
import { i18n } from '../modules/i18n';

export class BookListManagerModal {
  private modalElement: HTMLElement | null = null;
  private onBookListsChanged?: () => void;

  constructor(onBookListsChanged?: () => void) {
    this.onBookListsChanged = onBookListsChanged;
  }

  async open(): Promise<void> {
    console.log('[BookListManagerModal] open() called');
    if (this.modalElement) {
      console.log('[BookListManagerModal] Removing existing modal element');
      this.modalElement.remove();
    }

    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal';
    console.log('[BookListManagerModal] Created modal element');
    this.modalElement.innerHTML = `
      <div class="modal-content category-manager-modal">
        <div class="modal-header">
          <h2>${i18n.t("bookListManager.title")}</h2>
          <button class="btn-close" id="btn-close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="category-manager-search">
            <input
              type="text"
              id="booklist-name-input"
              placeholder="${i18n.t("bookListManager.placeholder")}"
              class="category-search-input"
            />
            <button id="btn-add-booklist" class="btn btn-primary">
              ${i18n.t("bookListManager.add")}
            </button>
          </div>
          <div id="booklist-list" class="category-list"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalElement);
    console.log('[BookListManagerModal] Modal element appended to body');
    await this.renderBookLists();
    this.attachEventListeners();

    // Show modal with animation
    setTimeout(() => {
      console.log('[BookListManagerModal] Adding active class to modal');
      this.modalElement?.classList.add('active');
    }, 10);
  }

  close(): void {
    if (this.modalElement) {
      this.modalElement.classList.remove('active');
      setTimeout(() => {
        this.modalElement?.remove();
        this.modalElement = null;
      }, 300);
    }
  }

  private async renderBookLists(): Promise<void> {
    const bookLists = await storage.getBookLists();
    const listContainer = this.modalElement?.querySelector('#booklist-list');

    if (!listContainer) return;

    if (bookLists.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state-small">
          ${i18n.t("bookListManager.emptyList")}
        </div>
      `;
      return;
    }

    const itemsHTML = await Promise.all(
      bookLists.map(async (list) => {
        const books = await storage.getBooksInList(list.id);
        const bookCount = books.length;

        return `
          <div class="category-item" data-id="${list.id}">
            <div class="category-content">
              <div class="category-main">
                <span class="category-name">${this.escapeHtml(list.name)}</span>
                <span class="category-meta">
                  ${i18n.t("bookListManager.booksCount", { count: bookCount })}
                </span>
              </div>
              ${
                list.description
                  ? `
                <div class="category-description">
                  ${this.escapeHtml(list.description)}
                </div>
              `
                  : ""
              }
            </div>
            <div class="category-actions">
              <button class="btn-icon btn-edit" data-id="${
                list.id
              }" title="${i18n.t("bookListManager.edit")}">
                ✏️
              </button>
              <button class="btn-icon btn-delete" data-id="${
                list.id
              }" title="${i18n.t("bookListManager.delete")}">
                🗑️
              </button>
            </div>
          </div>
        `;
      })
    );

    listContainer.innerHTML = itemsHTML.join('');
  }

  private attachEventListeners(): void {
    // Close button
    this.modalElement?.querySelector('#btn-close-modal')?.addEventListener('click', () => {
      this.close();
    });

    // Click outside to close
    this.modalElement?.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.close();
      }
    });

    // Add book list button
    const addButton = this.modalElement?.querySelector('#btn-add-booklist');
    const nameInput = this.modalElement?.querySelector('#booklist-name-input') as HTMLInputElement;

    addButton?.addEventListener('click', async () => {
      await this.handleAdd();
    });

    nameInput?.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        await this.handleAdd();
      }
    });

    // Event delegation for edit and delete buttons
    const listContainer = this.modalElement?.querySelector('#booklist-list');
    listContainer?.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;

      if (target.classList.contains('btn-edit')) {
        const id = target.dataset.id!;
        await this.handleEdit(id);
      } else if (target.classList.contains('btn-delete')) {
        const id = target.dataset.id!;
        await this.handleDelete(id);
      }
    });
  }

  private async handleAdd(): Promise<void> {
    const nameInput = this.modalElement?.querySelector('#booklist-name-input') as HTMLInputElement;
    const name = nameInput?.value.trim();

    if (!name) {
      alert(i18n.t('error.bookListEmpty'));
      return;
    }

    // Check for duplicate names
    const existing = await storage.getBookLists();
    if (existing.some(list => list.name === name)) {
      alert(i18n.t('error.bookListExists', { name }));
      return;
    }

    try {
      await storage.createBookList(name);
      nameInput.value = '';
      await this.renderBookLists();

      if (this.onBookListsChanged) {
        this.onBookListsChanged();
      }
    } catch (error) {
      console.error('Failed to create book list:', error);
      alert(i18n.t('error.bookListAdd'));
    }
  }

  private async handleEdit(id: string): Promise<void> {
    const bookList = await storage.getBookList(id);
    if (!bookList) return;

    const newName = prompt(i18n.t('bookListManager.editPrompt'), bookList.name);
    if (!newName || newName.trim() === '' || newName === bookList.name) {
      return;
    }

    // Check for duplicate names
    const existing = await storage.getBookLists();
    if (existing.some(list => list.id !== id && list.name === newName.trim())) {
      alert(i18n.t('error.bookListExists', { name: newName.trim() }));
      return;
    }

    try {
      await storage.updateBookList(id, { name: newName.trim() });
      await this.renderBookLists();

      if (this.onBookListsChanged) {
        this.onBookListsChanged();
      }
    } catch (error) {
      console.error('Failed to update book list:', error);
      alert(i18n.t('error.bookListUpdate'));
    }
  }

  private async handleDelete(id: string): Promise<void> {
    const bookList = await storage.getBookList(id);
    if (!bookList) return;

    const books = await storage.getBooksInList(id);
    const confirmMsg = books.length > 0
      ? i18n.t('bookListManager.deleteWarning', { name: bookList.name, count: books.length })
      : i18n.t('bookListManager.deleteConfirm', { name: bookList.name });

    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      await storage.deleteBookList(id);
      await this.renderBookLists();

      if (this.onBookListsChanged) {
        this.onBookListsChanged();
      }
    } catch (error) {
      console.error('Failed to delete book list:', error);
      alert(i18n.t('error.bookListDelete'));
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
