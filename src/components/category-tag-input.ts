import { i18n } from '../modules/i18n';
import { storage } from '../modules/storage';
import type { CategoryMetadata } from '../types';

// Extended type with bookCount (dynamically added by getCategoriesSorted)
interface CategoryWithCount extends CategoryMetadata {
  bookCount?: number;
}

/**
 * WeChat-style tag input component for category selection
 * Features:
 * - Tag chips for selected categories (with remove button)
 * - Dropdown list for available categories (smart sorted)
 * - Search/filter functionality
 * - Inline "create new" support
 * - Auto-scroll on tag overflow
 */
export class CategoryTagInput {
  private container: HTMLElement | null = null;
  private selectedCategories: string[] = [];
  private availableCategories: CategoryWithCount[] = [];
  private filteredCategories: CategoryWithCount[] = [];
  private isDropdownOpen: boolean = false;
  private inputValue: string = '';
  private onChange?: (categories: string[]) => void;

  constructor(initialCategories: string[] = [], onChange?: (categories: string[]) => void) {
    this.selectedCategories = [...initialCategories];
    this.onChange = onChange;
  }

  async render(containerElement: HTMLElement): Promise<void> {
    this.container = containerElement;
    await this.loadCategories();
    this.updateView();
  }

  /**
   * Reload categories from storage (e.g., after deletion)
   */
  async reloadCategories(): Promise<void> {
    await this.loadCategories();
    // Only update dropdown if it's open, to avoid disrupting user input
    if (this.isDropdownOpen) {
      this.updateDropdownDisplay();
    }
  }

  private async loadCategories(): Promise<void> {
    const allCategories = await storage.getCategoriesSorted();
    // getCategoriesSorted already includes bookCount in the return value
    this.availableCategories = allCategories;
    this.updateFilteredCategories();
  }

  /**
   * Restrict available categories to a specific list (e.g., for bulk remove mode)
   * @param categoryNames - List of category names to allow, or null for all categories
   */
  setAvailableCategories(categoryNames: string[] | null): void {
    if (categoryNames === null) {
      // Reset to all categories
      void storage.getCategoriesSorted().then((allCategories) => {
        this.availableCategories = allCategories;
        this.updateFilteredCategories();
        this.updateDropdownDisplay();
      });
    } else {
      // Filter to specific categories
      this.availableCategories = this.availableCategories.filter((cat) =>
        categoryNames.includes(cat.name)
      );
      this.updateFilteredCategories();
      this.updateDropdownDisplay();
    }
  }

  private updateFilteredCategories(): void {
    const searchTerm = this.normalizeString(this.inputValue);

    this.filteredCategories = this.availableCategories.filter((cat) => {
      // Filter out already selected categories
      if (this.selectedCategories.includes(cat.name)) {
        return false;
      }

      // Filter by search term
      if (searchTerm) {
        const normalizedName = this.normalizeString(cat.name);
        return normalizedName.includes(searchTerm);
      }

      return true;
    });
  }

  private normalizeString(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private updateView(): void {
    if (!this.container) return;

    // First render: create initial structure
    if (!this.container.querySelector('.category-tag-input')) {
      this.container.innerHTML = `
        <div class="category-tag-input">
          <div class="tag-input-wrapper">
            <div class="tags-container">
              <input
                type="text"
                class="tag-input"
                autocomplete="off"
                placeholder="${i18n.t('categoryInput.placeholder')}"
              />
            </div>
          </div>
        </div>
      `;
      this.attachInputEventListeners();
    }

    // Update tags (preserves input element)
    this.updateTagsDisplay();

    // Update dropdown
    this.updateDropdownDisplay();
  }

  private updateTagsDisplay(): void {
    if (!this.container) return;

    const tagsContainer = this.container.querySelector('.tags-container');
    const input = tagsContainer?.querySelector('.tag-input') as HTMLInputElement;
    if (!tagsContainer || !input) return;

    // Remove old tag chips
    tagsContainer.querySelectorAll('.tag-chip').forEach((chip) => chip.remove());

    // Add new tag chips before input
    this.selectedCategories.forEach((cat) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `
        ${cat}
        <button type="button" class="tag-remove" data-category="${cat}">&times;</button>
      `;

      const removeBtn = chip.querySelector('.tag-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => this.removeCategory(cat));
      }

      tagsContainer.insertBefore(chip, input);
    });

    // Update input placeholder
    input.placeholder =
      this.selectedCategories.length === 0 ? i18n.t('categoryInput.placeholder') : '';
  }

  private updateDropdownDisplay(): void {
    if (!this.container) return;

    const categoryTagInput = this.container.querySelector('.category-tag-input');
    if (!categoryTagInput) return;

    // Remove existing dropdown
    const oldDropdown = categoryTagInput.querySelector('.tag-dropdown');
    if (oldDropdown) {
      oldDropdown.remove();
    }

    // Add new dropdown if open
    if (this.isDropdownOpen) {
      const dropdown = document.createElement('div');
      dropdown.className = 'tag-dropdown';

      if (this.filteredCategories.length > 0) {
        dropdown.innerHTML = this.filteredCategories
          .map(
            (cat) => `
            <div class="tag-dropdown-item" data-category="${cat.name}">
              <div class="category-name">${cat.name}</div>
              <div class="category-meta">
                ${this.formatCategoryMeta(cat)}
              </div>
            </div>
          `
          )
          .join('');
      } else if (this.inputValue.trim()) {
        dropdown.innerHTML = `
          <div class="tag-dropdown-item create-new" data-create="${this.inputValue.trim()}">
            <span class="create-icon">+</span>
            <div class="create-hint">
              ${i18n.t('categoryInput.createHint', { name: this.inputValue.trim() })}
            </div>
          </div>
        `;
      } else {
        dropdown.innerHTML = `
          <div class="tag-dropdown-empty">
            ${i18n.t('categoryInput.noResults')}
          </div>
        `;
      }

      // Attach dropdown item listeners
      dropdown.querySelectorAll('.tag-dropdown-item').forEach((item) => {
        item.addEventListener('click', (e) => {
          const element = e.currentTarget as HTMLElement;
          const category = element.dataset.category;
          const createNew = element.dataset.create;

          if (category) {
            this.selectCategory(category);
          } else if (createNew) {
            void this.createAndSelectCategory(createNew);
          }
        });
      });

      categoryTagInput.appendChild(dropdown);
    }
  }

  private formatCategoryMeta(category: CategoryWithCount): string {
    const bookCount = category.bookCount || 0;
    const relativeTime = this.formatRelativeTime(category.lastUsedAt);

    return `${i18n.t('categoryManager.booksCount', { count: bookCount })} · ${relativeTime}`;
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

  private attachInputEventListeners(): void {
    if (!this.container) return;

    const input = this.container.querySelector('.tag-input') as HTMLInputElement;
    if (!input) return;

    // Input focus - open dropdown
    input.addEventListener('focus', () => {
      this.isDropdownOpen = true;
      this.updateView();
    });

    // Input change
    input.addEventListener('input', (e) => {
      this.inputValue = (e.target as HTMLInputElement).value;
      this.updateFilteredCategories();
      this.updateDropdownDisplay(); // Only update dropdown, not entire view
    });

    // Keyboard shortcuts
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void this.handleCreateOrSelect();
      } else if (
        e.key === 'Backspace' &&
        this.inputValue === '' &&
        this.selectedCategories.length > 0
      ) {
        // Remove last tag on backspace when input is empty
        this.removeCategory(this.selectedCategories[this.selectedCategories.length - 1]);
      }
    });

    // Click outside to close dropdown
    const clickOutsideHandler = (e: MouseEvent) => {
      if (this.container && !this.container.contains(e.target as Node)) {
        this.isDropdownOpen = false;
        this.updateDropdownDisplay();
      }
    };
    document.addEventListener('click', clickOutsideHandler);

    // Store handler for cleanup
    if (!this.container.dataset.hasClickHandler) {
      this.container.dataset.hasClickHandler = 'true';
      // Note: In a production app, you'd want to store and remove this handler in destroy()
    }
  }

  private async handleCreateOrSelect(): Promise<void> {
    const trimmed = this.inputValue.trim();
    if (!trimmed) return;

    // Check if it matches an existing category
    const existing = this.filteredCategories.find(
      (cat) => this.normalizeString(cat.name) === this.normalizeString(trimmed)
    );

    if (existing) {
      this.selectCategory(existing.name);
    } else {
      await this.createAndSelectCategory(trimmed);
    }
  }

  private selectCategory(categoryName: string): void {
    if (!this.selectedCategories.includes(categoryName)) {
      this.selectedCategories.push(categoryName);
      this.inputValue = '';

      // Clear actual input element value and keep focus for continuous input
      const input = this.container?.querySelector('.tag-input') as HTMLInputElement;
      if (input) {
        input.value = '';
        input.focus();
      }

      // Keep dropdown open for continuous selection
      this.isDropdownOpen = true;
      this.updateFilteredCategories();
      this.updateView();
      this.notifyChange();
    }
  }

  private async createAndSelectCategory(categoryName: string): Promise<void> {
    try {
      await storage.addCategory(categoryName);
      await this.loadCategories();
      this.selectCategory(categoryName);
    } catch (error) {
      console.error('Failed to create category:', error);
      alert(i18n.t('error.categoryAdd'));
    }
  }

  private removeCategory(categoryName: string): void {
    this.selectedCategories = this.selectedCategories.filter((cat) => cat !== categoryName);

    // Ensure input is cleared
    this.inputValue = '';
    const input = this.container?.querySelector('.tag-input') as HTMLInputElement;
    if (input) {
      input.value = '';
      input.focus(); // Keep focus in input for continuous editing
    }

    this.updateFilteredCategories();
    this.updateView();
    this.notifyChange();
  }

  private notifyChange(): void {
    if (this.onChange) {
      this.onChange([...this.selectedCategories]);
    }
  }

  getSelectedCategories(): string[] {
    return [...this.selectedCategories];
  }

  setSelectedCategories(categories: string[]): void {
    this.selectedCategories = [...categories];
    this.updateFilteredCategories();
    this.updateView();
  }

  destroy(): void {
    this.container = null;
  }
}
