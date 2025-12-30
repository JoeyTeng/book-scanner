import type { ReadingStatus } from '../types';
import { storage } from '../modules/storage';
import { i18n } from '../modules/i18n';
import { CategoryTagInput } from './category-tag-input';

export class BulkEditModal {
  private modalElement: HTMLDivElement | null = null;
  private selectedBookIds: string[] = [];
  private onSave: () => void;
  private categoryTagInput: CategoryTagInput | null = null;

  constructor(onSave: () => void) {
    this.onSave = onSave;
  }

  async show(bookIds: string[]): Promise<void> {
    if (bookIds.length === 0) {
      alert(i18n.t('alert.selectOneBook'));
      return;
    }

    this.selectedBookIds = bookIds;
    await this.render();
  }

  private async render(): Promise<void> {
    const count = this.selectedBookIds.length;

    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal';
    this.modalElement.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>${i18n.t('bulkEdit.title', { count, plural: count > 1 ? 's' : '' })}</h2>
          <button class="btn-close" id="btn-close-bulk-edit">&times;</button>
        </div>
        <div class="modal-body">
          <form id="bulk-edit-form">
            <div class="form-group">
              <label>
                <input type="checkbox" id="change-status">
                ${i18n.t('bulkEdit.changeStatus')}
              </label>
              <select id="input-status" class="input-full" disabled>
                <option value="want">${i18n.t('bookForm.status.want')}</option>
                <option value="reading">${i18n.t('bookForm.status.reading')}</option>
                <option value="read">${i18n.t('bookForm.status.read')}</option>
              </select>
            </div>

            <div class="form-group">
              <label>
                <input type="checkbox" id="modify-categories">
                ${i18n.t('bulkEdit.changeCategory')}
              </label>
              <div id="category-operations" style="display: none; margin-top: var(--spacing-sm);">
                <div class="radio-group" style="margin-bottom: var(--spacing-sm);">
                  <label>
                    <input type="radio" name="category-operation" value="add" checked>
                    ${i18n.t('bulkEdit.operation.add')}
                  </label>
                  <label>
                    <input type="radio" name="category-operation" value="remove">
                    ${i18n.t('bulkEdit.operation.remove')}
                  </label>
                  <label>
                    <input type="radio" name="category-operation" value="replace">
                    ${i18n.t('bulkEdit.operation.replace')}
                  </label>
                </div>
                <div id="category-tag-input-container"></div>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-secondary" id="btn-cancel-bulk">${i18n.t('bulkEdit.button.cancel')}</button>
              <button type="submit" class="btn-primary">${i18n.t('bulkEdit.button.apply')}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('modal-container')?.appendChild(this.modalElement);
    this.modalElement.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Initialize CategoryTagInput
    const container = this.modalElement.querySelector('#category-tag-input-container');
    if (container) {
      this.categoryTagInput = new CategoryTagInput([]);
      await this.categoryTagInput.render(container as HTMLElement);
    }

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    // Close button
    this.modalElement?.querySelector('#btn-close-bulk-edit')?.addEventListener('click', () => {
      this.hide();
    });

    // Cancel button
    this.modalElement?.querySelector('#btn-cancel-bulk')?.addEventListener('click', () => {
      this.hide();
    });

    // Enable/disable status select
    this.modalElement?.querySelector('#change-status')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const statusSelect = this.modalElement?.querySelector('#input-status') as HTMLSelectElement;
      statusSelect.disabled = !checked;
    });

    // Enable/disable category operations
    this.modalElement?.querySelector('#modify-categories')?.addEventListener('change', async (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const categoryOps = this.modalElement?.querySelector('#category-operations') as HTMLElement;
      categoryOps.style.display = checked ? 'block' : 'none';

      // Update available categories when enabled
      if (checked) {
        await this.updateCategoryOperationMode();
      }
    });

    // Listen to category operation mode changes
    this.modalElement?.querySelectorAll('input[name="category-operation"]').forEach((radio) => {
      radio.addEventListener('change', async () => {
        await this.updateCategoryOperationMode();
      });
    });

    // Form submission
    this.modalElement?.querySelector('#bulk-edit-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  }

  private async updateCategoryOperationMode(): Promise<void> {
    const operation = (
      this.modalElement?.querySelector(
        'input[name="category-operation"]:checked'
      ) as HTMLInputElement
    )?.value;

    if (!this.categoryTagInput) return;

    if (operation === 'remove') {
      // Get union of categories from selected books
      const existingCategories = await this.getExistingCategoriesFromSelectedBooks();
      this.categoryTagInput.setAvailableCategories(existingCategories);
    } else {
      // Reset to all categories for add/replace operations
      this.categoryTagInput.setAvailableCategories(null);
    }
  }

  private async getExistingCategoriesFromSelectedBooks(): Promise<string[]> {
    const categoriesSet = new Set<string>();

    for (const bookId of this.selectedBookIds) {
      const book = await storage.getBook(bookId);
      if (book) {
        book.categories.forEach((cat) => categoriesSet.add(cat));
      }
    }

    return Array.from(categoriesSet);
  }

  private async handleSubmit(): Promise<void> {
    const changeStatus = (this.modalElement?.querySelector('#change-status') as HTMLInputElement).checked;
    const modifyCategories = (this.modalElement?.querySelector('#modify-categories') as HTMLInputElement).checked;

    if (!changeStatus && !modifyCategories) {
      alert(i18n.t('alert.selectOneChange'));
      return;
    }

    // Get new status if selected
    let newStatus: ReadingStatus | null = null;
    if (changeStatus) {
      newStatus = (this.modalElement?.querySelector('#input-status') as HTMLSelectElement).value as ReadingStatus;
    }

    // Get category changes if selected
    let categoryOperation: 'add' | 'remove' | 'replace' | null = null;
    let selectedCategories: string[] = [];

    if (modifyCategories) {
      categoryOperation = (
        this.modalElement?.querySelector(
          'input[name="category-operation"]:checked'
        ) as HTMLInputElement
      ).value as "add" | "remove" | "replace";

      // Get selected categories from CategoryTagInput
      selectedCategories = this.categoryTagInput?.getSelectedCategories() || [];

      if (selectedCategories.length === 0) {
        alert(i18n.t('alert.selectOneCategory'));
        return;
      }

      // Touch all categories to update lastUsedAt
      for (const cat of selectedCategories) {
        await storage.touchCategory(cat);
      }
    }

    // Apply changes to all selected books
    for (const bookId of this.selectedBookIds) {
      const book = await storage.getBook(bookId);
      if (!book) return;

      // Update status
      if (newStatus) {
        book.status = newStatus;
      }

      // Update categories
      if (categoryOperation && selectedCategories.length > 0) {
        switch (categoryOperation) {
          case 'add':
            // Add new categories, avoid duplicates
            selectedCategories.forEach(cat => {
              if (!book.categories.includes(cat)) {
                book.categories.push(cat);
              }
            });
            break;
          case 'remove':
            // Remove specified categories
            book.categories = book.categories.filter(cat => !selectedCategories.includes(cat));
            break;
          case 'replace':
            // Replace all categories
            book.categories = [...selectedCategories];
            break;
        }
      }

      book.updatedAt = Date.now();
      await storage.updateBook(book.id, book);
    }

    this.hide();
    this.onSave();
  }

  hide(): void {
    if (this.modalElement) {
      this.categoryTagInput?.destroy();
      this.categoryTagInput = null;
      this.modalElement.remove();
      this.modalElement = null;
    }
    document.body.style.overflow = '';
  }
}
