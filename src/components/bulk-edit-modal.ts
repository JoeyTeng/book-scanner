import type { ReadingStatus } from '../types';
import { storage } from '../modules/storage';

export class BulkEditModal {
  private modalElement: HTMLDivElement | null = null;
  private selectedBookIds: string[] = [];
  private onSave: () => void;

  constructor(onSave: () => void) {
    this.onSave = onSave;
  }

  async show(bookIds: string[]): Promise<void> {
    if (bookIds.length === 0) {
      alert('Please select at least one book to edit.');
      return;
    }

    this.selectedBookIds = bookIds;
    await this.render();
  }

  private async render(): Promise<void> {
    const categories = await storage.getCategories();
    const count = this.selectedBookIds.length;

    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal';
    this.modalElement.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Bulk Edit (${count} book${count > 1 ? 's' : ''})</h2>
          <button class="btn-close" id="btn-close-bulk-edit">&times;</button>
        </div>
        <div class="modal-body">
          <form id="bulk-edit-form">
            <div class="form-group">
              <label>
                <input type="checkbox" id="change-status">
                Change Reading Status
              </label>
              <select id="input-status" class="input-full" disabled>
                <option value="want">Want to Read</option>
                <option value="reading">Reading</option>
                <option value="read">Read</option>
              </select>
            </div>

            <div class="form-group">
              <label>
                <input type="checkbox" id="modify-categories">
                Modify Categories
              </label>
              <div id="category-operations" style="display: none; margin-top: var(--spacing-sm);">
                <div class="radio-group" style="margin-bottom: var(--spacing-sm);">
                  <label>
                    <input type="radio" name="category-operation" value="add" checked>
                    Add categories
                  </label>
                  <label>
                    <input type="radio" name="category-operation" value="remove">
                    Remove categories
                  </label>
                  <label>
                    <input type="radio" name="category-operation" value="replace">
                    Replace all categories
                  </label>
                </div>
                <div class="checkbox-group">
                  ${categories.map(cat => `
                    <label class="checkbox-label">
                      <input type="checkbox" name="category" value="${cat}">
                      ${cat}
                    </label>
                  `).join('')}
                </div>
                <input type="text" id="input-new-category" class="input-full"
                       placeholder="Add new category">
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn-secondary" id="btn-cancel-bulk">Cancel</button>
              <button type="submit" class="btn-primary">Apply Changes</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById('modal-container')?.appendChild(this.modalElement);
    this.modalElement.style.display = 'flex';
    document.body.style.overflow = 'hidden';

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
    this.modalElement?.querySelector('#modify-categories')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      const categoryOps = this.modalElement?.querySelector('#category-operations') as HTMLElement;
      categoryOps.style.display = checked ? 'block' : 'none';
    });

    // Form submission
    this.modalElement?.querySelector('#bulk-edit-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  }

  private async handleSubmit(): Promise<void> {
    const changeStatus = (this.modalElement?.querySelector('#change-status') as HTMLInputElement).checked;
    const modifyCategories = (this.modalElement?.querySelector('#modify-categories') as HTMLInputElement).checked;

    if (!changeStatus && !modifyCategories) {
      alert('Please select at least one change to apply.');
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

      // Get selected categories
      const checkboxes = this.modalElement?.querySelectorAll(
        'input[name="category"]:checked'
      ) as NodeListOf<HTMLInputElement>;
      selectedCategories = Array.from(checkboxes).map((cb) => cb.value);

      // Add new category if provided
      const newCategoryInput = this.modalElement?.querySelector(
        "#input-new-category"
      ) as HTMLInputElement;
      const newCategory = newCategoryInput.value.trim();
      if (newCategory) {
        selectedCategories.push(newCategory);
        await storage.addCategory(newCategory);
      }

      if (selectedCategories.length === 0) {
        alert("Please select at least one category.");
        return;
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
      this.modalElement.remove();
      this.modalElement = null;
    }
    document.body.style.overflow = '';
  }
}
