import { i18n } from '../modules/i18n';
import { storage } from '../modules/storage';
import type { CategoryMetadata } from '../types';

// Extended type with bookCount
interface CategoryWithCount extends CategoryMetadata {
  bookCount?: number;
}

export class CategoryManagerModal {
  private modalElement: HTMLDivElement | null = null;
  private categories: CategoryWithCount[] = [];
  private filteredCategories: CategoryWithCount[] = [];
  private searchQuery: string = '';
  private isEditMode: boolean = false;
  private selectedForDeletion: Set<string> = new Set();
  private editingCategory: string | null = null;
  private onClose?: () => void | Promise<void>;
  private onCategoriesChanged?: () => void | Promise<void>;

  constructor(
    onClose?: () => void | Promise<void>,
    onCategoriesChanged?: () => void | Promise<void>
  ) {
    this.onClose = onClose;
    this.onCategoriesChanged = onCategoriesChanged;
  }

  async show(): Promise<void> {
    await this.loadCategories();
    this.render();
  }

  hide(): void {
    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
      document.body.style.overflow = '';

      // Notify parent that categories may have changed
      void this.onClose?.();
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      this.categories = await storage.getCategoriesSorted();
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  private formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return i18n.t('categoryManager.daysAgo', { count: days });
    } else if (hours > 0) {
      return i18n.t('categoryManager.hoursAgo', { count: hours });
    } else if (minutes > 0) {
      return i18n.t('categoryManager.minutesAgo', { count: minutes });
    } else {
      return i18n.t('categoryManager.justNow');
    }
  }

  private render(): void {
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal';
    this.modalElement.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>${i18n.t('categoryManager.title')}</h2>
          <button class="btn-close" id="btn-close-category-manager">&times;</button>
        </div>
        <div class="modal-body">
          <!-- Search/Add Category -->
          <div class="add-category-section" style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">
              ${i18n.t('common.search')} / ${i18n.t('categoryManager.add')}
            </label>
            <div style="position: relative;">
              <input
                type="text"
                id="category-search-input"
                class="tag-input"
                autocomplete="off"
                placeholder="${i18n.t('categoryInput.placeholder')}"
                style="width: 100%; padding: 8px 40px 8px 12px; border: 1px solid var(--color-border); border-radius: 4px;"
              />
              <button
                id="btn-add-category"
                class="btn-icon"
                style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer;"
                title="${i18n.t('categoryManager.add')}"
              >
                <span style="font-size: 20px; font-weight: bold; line-height: 1;">+</span>
              </button>
            </div>
          </div>

          <!-- Edit Mode Toggle -->
          <div class="category-manager-toolbar" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border);">
            <button id="btn-toggle-edit-mode" class="btn-secondary">
              ${this.isEditMode ? i18n.t('common.done') : i18n.t('categoryManager.edit')}
            </button>
            ${
              this.isEditMode && this.selectedForDeletion.size > 0
                ? `
              <button id="btn-batch-delete" class="btn-danger">
                ${i18n.t('categoryManager.delete')} (${this.selectedForDeletion.size})
              </button>
            `
                : ''
            }
          </div>

          <!-- Category List -->
          <div id="category-list" class="category-list"></div>
        </div>
      </div>
    `;

    document.getElementById('modal-container')?.appendChild(this.modalElement);
    this.modalElement.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    this.updateFilteredCategories();
    this.renderCategoryList();
    this.attachEventListeners(); // Only call once during initialization
  }

  private attachEventListeners(): void {
    // Search input - bind once
    const searchInput = this.modalElement?.querySelector(
      '#category-search-input'
    ) as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target as HTMLInputElement).value;
        this.updateFilteredCategories();
        this.renderCategoryListOnly(); // Only update list, don't rebind events
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void this.handleAddCategory();
        }
      });
    }

    // Add button - bind once
    this.modalElement?.querySelector('#btn-add-category')?.addEventListener('click', () => {
      void this.handleAddCategory();
    });

    // Close button - bind once
    this.modalElement
      ?.querySelector('#btn-close-category-manager')
      ?.addEventListener('click', () => {
        this.hide();
      });

    // Use event delegation for dynamic elements
    const categoryList = this.modalElement?.querySelector('#category-list');
    if (categoryList) {
      categoryList.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.classList.contains('category-delete-checkbox')) {
          const name = target.dataset.name!;
          if (target.checked) {
            this.selectedForDeletion.add(name);
          } else {
            this.selectedForDeletion.delete(name);
          }
          this.updateToolbar();
        }
      });

      categoryList.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;

        // Handle category content click (for editing)
        if (
          target.classList.contains('category-content') &&
          target.classList.contains('clickable')
        ) {
          const name = target.dataset.name!;
          this.startEditing(name);
        }

        // Handle save button
        if (target.classList.contains('btn-save')) {
          const oldName = target.dataset.oldName!;
          void this.saveEditing(oldName);
        }

        // Handle cancel button
        if (target.classList.contains('btn-cancel')) {
          this.cancelEditing();
        }
      });

      categoryList.addEventListener('keydown', (e) => {
        const target = e.target as HTMLInputElement;
        const keyEvent = e as KeyboardEvent;
        if (target.classList.contains('category-edit-input')) {
          if (keyEvent.key === 'Enter') {
            e.preventDefault();
            const oldName = this.editingCategory!;
            void this.saveEditing(oldName);
          } else if (keyEvent.key === 'Escape') {
            this.cancelEditing();
          }
        }
      });
    }

    // Toolbar buttons - use event delegation
    const toolbar = this.modalElement?.querySelector('.category-manager-toolbar');
    if (toolbar) {
      toolbar.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;

        if (target.id === 'btn-toggle-edit-mode' || target.closest('#btn-toggle-edit-mode')) {
          this.toggleEditMode();
        }

        if (target.id === 'btn-batch-delete' || target.closest('#btn-batch-delete')) {
          void this.handleBatchDelete();
        }
      });
    }
  }

  private renderCategoryListOnly(): void {
    // Only update the list content without rebinding events
    this.renderCategoryList();
  }

  private updateFilteredCategories(): void {
    if (!this.searchQuery.trim()) {
      this.filteredCategories = [...this.categories];
    } else {
      const query = this.searchQuery.toLowerCase().trim();
      this.filteredCategories = this.categories.filter((cat) =>
        cat.name.toLowerCase().includes(query)
      );
    }
  }

  private renderCategoryList(): void {
    const listContainer = this.modalElement?.querySelector('#category-list');
    if (!listContainer) return;

    if (this.filteredCategories.length === 0) {
      if (this.searchQuery.trim()) {
        listContainer.innerHTML = `
          <div class="empty-state" style="text-align: center; padding: 40px; color: var(--color-text-secondary);">
            ${i18n.t('categoryInput.noResults')}
          </div>
        `;
      } else {
        listContainer.innerHTML = `
          <div class="empty-state" style="text-align: center; padding: 40px; color: var(--color-text-secondary);">
            ${i18n.t('categoryManager.emptyList')}
          </div>
        `;
      }
      return;
    }

    listContainer.innerHTML = this.filteredCategories
      .map((category) => {
        const bookCount = category.bookCount || 0;
        const relativeTime = this.formatRelativeTime(category.lastUsedAt);
        const isEditing = this.editingCategory === category.name;
        const isSelected = this.selectedForDeletion.has(category.name);

        return `
          <div class="category-item ${this.isEditMode ? 'edit-mode' : ''}" data-name="${category.name}">
            ${
              this.isEditMode
                ? `
              <label class="category-checkbox">
                <input
                  type="checkbox"
                  class="category-delete-checkbox"
                  data-name="${category.name}"
                  ${isSelected ? 'checked' : ''}
                />
              </label>
            `
                : ''
            }
            ${
              isEditing
                ? `
              <div class="category-editing" style="display: flex; gap: 8px; align-items: center; flex: 1;">
                <input
                  type="text"
                  class="input-full category-edit-input"
                  value="${category.name}"
                  id="edit-input-${category.name.replace(/[^a-zA-Z0-9]/g, '_')}"
                  style="flex: 1;"
                />
                <button class="btn-icon btn-save" data-old-name="${category.name}" style="width: 32px; height: 32px; font-size: 18px;">✓</button>
                <button class="btn-icon btn-cancel" style="width: 32px; height: 32px; font-size: 18px;">✕</button>
              </div>
            `
                : `
              <div class="category-content ${this.isEditMode ? 'clickable' : ''}" data-name="${category.name}" style="flex: 1; cursor: ${this.isEditMode ? 'pointer' : 'default'};">
                <div class="category-name" style="font-weight: 500;">${category.name}</div>
                <div class="category-meta" style="font-size: 0.85rem; color: var(--color-text-secondary);">
                  ${i18n.t('categoryManager.booksCount', { count: bookCount })} · ${relativeTime}
                </div>
              </div>
            `
            }
          </div>
        `;
      })
      .join('');
  }

  private toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
    this.selectedForDeletion.clear();
    this.editingCategory = null;
    this.renderCategoryList();
    this.updateToolbar();
  }

  private updateToolbar(): void {
    const toolbar = this.modalElement?.querySelector('.category-manager-toolbar');
    if (toolbar) {
      toolbar.innerHTML = `
        <button id="btn-toggle-edit-mode" class="btn-secondary">
          ${this.isEditMode ? i18n.t('common.done') : i18n.t('categoryManager.edit')}
        </button>
        ${
          this.isEditMode && this.selectedForDeletion.size > 0
            ? `
          <button id="btn-batch-delete" class="btn-danger">
            ${i18n.t('categoryManager.delete')} (${this.selectedForDeletion.size})
          </button>
        `
            : ''
        }
      `;
      // No need to re-attach listeners, using event delegation
    }
  }

  private async updateView(): Promise<void> {
    await this.loadCategories();
    this.updateFilteredCategories();
    this.renderCategoryList();
    this.updateToolbar();
  }

  private async handleAddCategory(): Promise<void> {
    const searchInput = this.modalElement?.querySelector(
      '#category-search-input'
    ) as HTMLInputElement;
    const categoryName = searchInput?.value.trim();

    if (!categoryName) return;

    try {
      await storage.addCategory(categoryName);

      // Clear search input
      if (searchInput) {
        searchInput.value = '';
      }
      this.searchQuery = '';

      // Reload and refresh
      await this.loadCategories();
      this.updateFilteredCategories();
      this.renderCategoryList();

      // Focus back to search input
      if (searchInput) {
        searchInput.focus();
      }
    } catch (error) {
      console.error('Failed to add category:', error);
      alert(i18n.t('error.categoryAdd'));
    }
  }

  private startEditing(categoryName: string): void {
    this.editingCategory = categoryName;
    this.renderCategoryList();

    // Focus the input
    setTimeout(() => {
      const input = this.modalElement?.querySelector(
        `#edit-input-${categoryName.replace(/[^a-zA-Z0-9]/g, '_')}`
      ) as HTMLInputElement;
      input?.focus();
      input?.select();
    }, 0);
  }

  private cancelEditing(): void {
    this.editingCategory = null;
    this.renderCategoryList();
  }

  private async saveEditing(oldName: string): Promise<void> {
    const input = this.modalElement?.querySelector(
      `#edit-input-${oldName.replace(/[^a-zA-Z0-9]/g, '_')}`
    ) as HTMLInputElement;
    const newName = input?.value.trim();

    if (!newName) {
      alert(i18n.t('error.categoryEmpty'));
      return;
    }

    if (newName !== oldName && this.categories.find((c) => c.name === newName)) {
      alert(i18n.t('error.categoryExists', { name: newName }));
      return;
    }

    if (newName === oldName) {
      this.cancelEditing();
      return;
    }

    try {
      await storage.updateCategoryName(oldName, newName);
      this.editingCategory = null;
      await this.updateView();
    } catch (error) {
      console.error('Failed to update category:', error);
      alert(i18n.t('error.categoryUpdate'));
    }
  }

  private showLoading(message: string): void {
    const overlay = document.createElement('div');
    overlay.id = 'category-manager-loading';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.95);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      gap: 12px;
    `;
    overlay.innerHTML = `
      <div style="
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <div style="color: #666; font-size: 14px;">${message}</div>
    `;
    document.body.appendChild(overlay);
  }

  private hideLoading(): void {
    document.getElementById('category-manager-loading')?.remove();
  }

  private async handleBatchDelete(): Promise<void> {
    if (this.selectedForDeletion.size === 0) return;

    const categoriesToDelete = Array.from(this.selectedForDeletion);
    const categoryDetails = categoriesToDelete
      .map((name) => {
        const cat = this.categories.find((c) => c.name === name);
        const bookCount = cat?.bookCount || 0;
        return `• ${name} (${i18n.t('categoryManager.booksCount', { count: bookCount })})`;
      })
      .join('\n');

    const message = `${i18n.t('categoryManager.deleteConfirm', { name: categoriesToDelete.join(', ') })}\n\n${categoryDetails}\n\n${i18n.t('categoryManager.deleteWarning', { count: categoriesToDelete.length })}`;

    if (!confirm(message)) {
      return;
    }

    try {
      // Show loading overlay
      this.showLoading(i18n.t('common.loading'));

      // Use setTimeout to let the UI update before blocking operation
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Delete all categories in a single batch operation to avoid race conditions
      await storage.deleteCategoriesBatch(categoriesToDelete);

      this.selectedForDeletion.clear();

      // Exit edit mode after deletion
      this.isEditMode = false;

      // Notify immediately that categories have changed (await to ensure search bar updates)
      await this.onCategoriesChanged?.();

      this.hideLoading();
      await this.updateView();
    } catch (error) {
      this.hideLoading();
      console.error('Failed to delete categories:', error);
      alert(i18n.t('error.categoryDelete'));
    }
  }
}
