import type { SearchFilters, SortField, SortOrder } from '../types';
import { storage } from '../modules/storage';

export class SearchBar {
  private element: HTMLElement;
  private onFilterChange: (filters: SearchFilters, sortField: SortField, sortOrder: SortOrder) => void;
  private onBulkEditClick?: () => void;

  constructor(
    containerId: string,
    onFilterChange: (filters: SearchFilters, sortField: SortField, sortOrder: SortOrder) => void
  ) {
    this.element = document.getElementById(containerId)!;
    this.onFilterChange = onFilterChange;
    this.render();
    this.attachEventListeners();
  }

  setBulkEditClickHandler(handler: () => void): void {
    this.onBulkEditClick = handler;
  }

  updateBulkEditButton(mode: boolean, selectedCount: number = 0): void {
    const button = this.element.querySelector('#btn-bulk-edit') as HTMLButtonElement;
    if (button) {
      if (mode) {
        button.textContent =
          selectedCount > 0
            ? `Edit Selected (${selectedCount})`
            : "Cancel Selection";
        button.className = selectedCount > 0 ? 'btn btn-primary' : 'btn btn-secondary';
      } else {
        button.textContent = 'Bulk Edit';
        button.className = 'btn btn-secondary';
      }
    }
  }

  private render(): void {
    const categories = storage.getCategories();

    this.element.innerHTML = `
      <div class="search-bar">
        <div class="search-input-wrapper">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input type="text" id="search-input" class="search-input" placeholder="Search books...">
        </div>

        <div class="filters">
          <select id="filter-category" class="filter-select">
            <option value="all">All Categories</option>
            ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
          </select>

          <select id="filter-status" class="filter-select">
            <option value="all">All Status</option>
            <option value="want">Want to Read</option>
            <option value="reading">Reading</option>
            <option value="read">Read</option>
          </select>

          <select id="sort-field" class="filter-select">
            <option value="addedAt">Sort by Date</option>
            <option value="title">Sort by Title</option>
            <option value="author">Sort by Author</option>
            <option value="publishDate">Sort by Publish Date</option>
          </select>

          <button id="sort-order" class="btn-icon" aria-label="Toggle sort order">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
          </button>

          <button id="btn-bulk-edit" class="btn btn-secondary">Bulk Edit</button>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    const categorySelect = document.getElementById('filter-category') as HTMLSelectElement;
    const statusSelect = document.getElementById('filter-status') as HTMLSelectElement;
    const sortFieldSelect = document.getElementById('sort-field') as HTMLSelectElement;
    const sortOrderBtn = document.getElementById('sort-order') as HTMLButtonElement;
    const bulkEditBtn = document.getElementById('btn-bulk-edit') as HTMLButtonElement;

    let currentOrder: SortOrder = 'desc';

    const emitChange = () => {
      const filters: SearchFilters = {
        query: searchInput.value,
        category: categorySelect.value === 'all' ? undefined : categorySelect.value,
        status: statusSelect.value as any
      };

      const sortField = sortFieldSelect.value as SortField;

      this.onFilterChange(filters, sortField, currentOrder);
    };

    searchInput.addEventListener('input', emitChange);
    categorySelect.addEventListener('change', emitChange);
    statusSelect.addEventListener('change', emitChange);
    sortFieldSelect.addEventListener('change', emitChange);

    sortOrderBtn.addEventListener('click', () => {
      currentOrder = currentOrder === 'asc' ? 'desc' : 'asc';

      // Update button icon
      sortOrderBtn.innerHTML = currentOrder === 'asc'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';

      emitChange();
    });

    bulkEditBtn.addEventListener('click', () => {
      if (this.onBulkEditClick) {
        this.onBulkEditClick();
      }
    });
  }
}
