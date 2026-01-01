import type { SearchFilters, SortField, SortOrder, ViewMode } from '../types';
import { storage } from '../modules/storage';
import { i18n } from '../modules/i18n';

export class SearchBar {
  private element: HTMLElement;
  private onFilterChange: (
    filters: SearchFilters,
    sortField: SortField,
    sortOrder: SortOrder
  ) => void;
  private onBulkEditClick?: () => void;
  private onViewModeChange?: (mode: ViewMode) => void;
  private onSelectAllClick?: () => void;
  private activeBookListId: string | null = null;
  private searchScope: "current" | "all" = "all";
  private initPromise: Promise<void>;
  private allSelected: boolean = false;
  private currentSortOrder: SortOrder = "desc";

  constructor(
    containerId: string,
    onFilterChange: (
      filters: SearchFilters,
      sortField: SortField,
      sortOrder: SortOrder
    ) => void
  ) {
    this.element = document.getElementById(containerId)!;
    this.onFilterChange = onFilterChange;
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    await this.render();
    this.attachEventListeners();
  }

  async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  setBulkEditClickHandler(handler: () => void): void {
    this.onBulkEditClick = handler;
  }

  setViewModeChangeHandler(handler: (mode: ViewMode) => void): void {
    this.onViewModeChange = handler;
  }

  setSelectAllClickHandler(handler: () => void): void {
    this.onSelectAllClick = handler;
  }

  setActiveBookList(id: string | null): void {
    if (this.activeBookListId !== id) {
      // Save current filter values before changing book list
      const searchInput = this.element.querySelector("#search-input") as HTMLInputElement;
      const categorySelect = this.element.querySelector("#filter-category") as HTMLSelectElement;
      const statusSelect = this.element.querySelector("#filter-status") as HTMLSelectElement;
      const sortFieldSelect = this.element.querySelector("#sort-field") as HTMLSelectElement;

      const currentValues = {
        search: searchInput?.value || "",
        category: categorySelect?.value || "all",
        status: statusSelect?.value || "all",
        sortField: sortFieldSelect?.value || "addedAt",
      };

      this.activeBookListId = id;
      // When switching to a book list, default to "current" scope
      // When switching to "All Books", default to "all" scope
      this.searchScope = id ? "current" : "all";
      // Re-render to show/hide scope toggle
      this.render().then(() => {
        // Restore filter values
        const newSearchInput = this.element.querySelector("#search-input") as HTMLInputElement;
        const newCategorySelect = this.element.querySelector("#filter-category") as HTMLSelectElement;
        const newStatusSelect = this.element.querySelector("#filter-status") as HTMLSelectElement;
        const newSortFieldSelect = this.element.querySelector("#sort-field") as HTMLSelectElement;

        if (newSearchInput) newSearchInput.value = currentValues.search;
        if (newCategorySelect) newCategorySelect.value = currentValues.category;
        if (newStatusSelect) newStatusSelect.value = currentValues.status;
        if (newSortFieldSelect) newSortFieldSelect.value = currentValues.sortField;

        this.attachEventListeners();
        // Trigger filter change to apply the new scope
        this.triggerFilterChange();
      });
    }
  }

  private triggerFilterChange(): void {
    const searchInput = document.getElementById("search-input") as HTMLInputElement;
    const categorySelect = document.getElementById("filter-category") as HTMLSelectElement;
    const statusSelect = document.getElementById("filter-status") as HTMLSelectElement;
    const sortFieldSelect = document.getElementById("sort-field") as HTMLSelectElement;

    if (searchInput && categorySelect && statusSelect && sortFieldSelect) {
      const filters: SearchFilters = {
        query: searchInput.value,
        category:
          categorySelect.value === "all" ? undefined : categorySelect.value,
        status: statusSelect.value as any,
      };

      const sortField = sortFieldSelect.value as SortField;

      this.onFilterChange(filters, sortField, this.currentSortOrder);
    }
  }

  getSearchScope(): "current" | "all" {
    return this.searchScope;
  }

  updateBulkEditButton(mode: boolean, selectedCount: number = 0, totalCount: number = 0): void {
    this.allSelected = selectedCount > 0 && selectedCount === totalCount;

    const button = this.element.querySelector(
      "#btn-bulk-edit"
    ) as HTMLButtonElement;
    if (button) {
      if (mode) {
        button.textContent =
          selectedCount > 0
            ? i18n.t("searchBar.selected", { count: selectedCount })
            : i18n.t("searchBar.exitBulkEdit");
        button.className =
          selectedCount > 0 ? "btn btn-primary" : "btn btn-secondary";
      } else {
        button.textContent = i18n.t("searchBar.bulkEdit");
        button.className = "btn btn-secondary";
      }
    }

    // Update select all button visibility and text
    const selectAllBtn = this.element.querySelector(
      "#btn-select-all"
    ) as HTMLButtonElement;
    if (selectAllBtn) {
      if (mode) {
        selectAllBtn.style.display = "inline-block";
        selectAllBtn.textContent = this.allSelected
          ? i18n.t("searchBar.deselectAll")
          : i18n.t("searchBar.selectAll");
      } else {
        selectAllBtn.style.display = "none";
      }
    }
  }

  async refresh(): Promise<void> {
    // Save current filter values before re-rendering
    const searchInput = this.element.querySelector(
      "#search-input"
    ) as HTMLInputElement;
    const categorySelect = this.element.querySelector(
      "#filter-category"
    ) as HTMLSelectElement;
    const statusSelect = this.element.querySelector(
      "#filter-status"
    ) as HTMLSelectElement;
    const sortFieldSelect = this.element.querySelector(
      "#sort-field"
    ) as HTMLSelectElement;

    const currentValues = {
      search: searchInput?.value || "",
      category: categorySelect?.value || "all",
      status: statusSelect?.value || "all",
      sortField: sortFieldSelect?.value || "addedAt",
    };

    // Re-render with updated categories
    await this.render();
    this.attachEventListeners();

    // Restore filter values
    const newSearchInput = this.element.querySelector(
      "#search-input"
    ) as HTMLInputElement;
    const newCategorySelect = this.element.querySelector(
      "#filter-category"
    ) as HTMLSelectElement;
    const newStatusSelect = this.element.querySelector(
      "#filter-status"
    ) as HTMLSelectElement;
    const newSortFieldSelect = this.element.querySelector(
      "#sort-field"
    ) as HTMLSelectElement;

    if (newSearchInput) newSearchInput.value = currentValues.search;
    if (newCategorySelect) {
      // Check if the selected category still exists
      const optionExists = Array.from(newCategorySelect.options).some(
        (opt) => opt.value === currentValues.category
      );
      newCategorySelect.value = optionExists ? currentValues.category : "all";
    }
    if (newStatusSelect) newStatusSelect.value = currentValues.status;
    if (newSortFieldSelect) newSortFieldSelect.value = currentValues.sortField;
  }

  private async render(): Promise<void> {
    const categories = await storage.getCategories();

    const scopeLabel = this.activeBookListId
      ? this.searchScope === "current"
        ? i18n.t("searchBar.scope.inList")
        : i18n.t("searchBar.scope.all")
      : "";

    this.element.innerHTML = `
      <div class="search-bar">
        <div class="search-input-wrapper">
          <div class="search-icon-wrapper" id="search-scope-btn">
            <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            ${scopeLabel ? `<span class="search-scope-label">${scopeLabel}</span>` : ""}
          </div>
          <input type="text" id="search-input" class="search-input" placeholder="${i18n.t(
            "searchBar.placeholder"
          )}">
          ${this.activeBookListId ? `
          <div class="search-scope-dropdown" id="search-scope-dropdown">
            <div class="search-scope-option ${this.searchScope === "all" ? "active" : ""}" data-scope="all">
              ${i18n.t("searchBar.scope.all")}
            </div>
            <div class="search-scope-option ${this.searchScope === "current" ? "active" : ""}" data-scope="current">
              ${i18n.t("searchBar.scope.currentFull")}
            </div>
          </div>
          ` : ""}
        </div>

        <div class="filters">
          <select id="filter-category" class="filter-select">
            <option value="all">${i18n.t("searchBar.filter.all")}</option>
            ${categories
              .map((cat) => `<option value="${cat}">${cat}</option>`)
              .join("")}
          </select>

          <select id="filter-status" class="filter-select">
            <option value="all">${i18n.t("searchBar.filter.allStatus")}</option>
            <option value="want">${i18n.t("bookForm.status.want")}</option>
            <option value="reading">${i18n.t(
              "bookForm.status.reading"
            )}</option>
            <option value="read">${i18n.t("bookForm.status.read")}</option>
          </select>

          <select id="sort-field" class="filter-select">
            <option value="addedAt">${i18n.t(
              "searchBar.sort.dateAdded"
            )}</option>
            <option value="title">${i18n.t("searchBar.sort.title")}</option>
            <option value="author">${i18n.t("searchBar.sort.author")}</option>
            <option value="publishDate">${i18n.t(
              "searchBar.sort.publishDate"
            )}</option>
          </select>

          <button id="sort-order" class="btn-icon" aria-label="Toggle sort order">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
          </button>

          <div class="view-toggle">
            <button id="view-grid" class="btn-icon active" aria-label="Grid view">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
              </svg>
            </button>
            <button id="view-list" class="btn-icon" aria-label="List view">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6"/>
                <line x1="8" y1="12" x2="21" y2="12"/>
                <line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/>
                <line x1="3" y1="12" x2="3.01" y2="12"/>
                <line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
          </div>

          <button id="btn-bulk-edit" class="btn btn-secondary">${i18n.t(
            "searchBar.bulkEdit"
          )}</button>
          <button id="btn-select-all" class="btn btn-secondary" style="display: none;">${i18n.t(
            "searchBar.selectAll"
          )}</button>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    const searchInput = document.getElementById(
      "search-input"
    ) as HTMLInputElement;
    const categorySelect = document.getElementById(
      "filter-category"
    ) as HTMLSelectElement;
    const statusSelect = document.getElementById(
      "filter-status"
    ) as HTMLSelectElement;
    const sortFieldSelect = document.getElementById(
      "sort-field"
    ) as HTMLSelectElement;
    const sortOrderBtn = document.getElementById(
      "sort-order"
    ) as HTMLButtonElement;
    const bulkEditBtn = document.getElementById(
      "btn-bulk-edit"
    ) as HTMLButtonElement;
    const selectAllBtn = document.getElementById(
      "btn-select-all"
    ) as HTMLButtonElement;
    const viewGridBtn = document.getElementById(
      "view-grid"
    ) as HTMLButtonElement;
    const viewListBtn = document.getElementById(
      "view-list"
    ) as HTMLButtonElement;

    // Search scope dropdown elements
    const scopeBtn = document.getElementById("search-scope-btn");
    const scopeDropdown = document.getElementById("search-scope-dropdown");
    const scopeOptions = document.querySelectorAll(".search-scope-option");

    let currentOrder: SortOrder = this.currentSortOrder;

    const emitChange = () => {
      const filters: SearchFilters = {
        query: searchInput.value,
        category:
          categorySelect.value === "all" ? undefined : categorySelect.value,
        status: statusSelect.value as any,
      };

      const sortField = sortFieldSelect.value as SortField;

      this.onFilterChange(filters, sortField, currentOrder);
    };

    searchInput.addEventListener("input", emitChange);
    categorySelect.addEventListener("change", emitChange);
    statusSelect.addEventListener("change", emitChange);
    sortFieldSelect.addEventListener("change", emitChange);

    sortOrderBtn.addEventListener("click", () => {
      currentOrder = currentOrder === "asc" ? "desc" : "asc";
      this.currentSortOrder = currentOrder;

      // Update button icon
      sortOrderBtn.innerHTML =
        currentOrder === "asc"
          ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
          : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';

      emitChange();
    });

    bulkEditBtn.addEventListener("click", () => {
      if (this.onBulkEditClick) {
        this.onBulkEditClick();
      }
    });

    selectAllBtn.addEventListener("click", () => {
      if (this.onSelectAllClick) {
        this.onSelectAllClick();
      }
    });

    // View mode toggle
    viewGridBtn.addEventListener("click", () => {
      viewGridBtn.classList.add("active");
      viewListBtn.classList.remove("active");
      if (this.onViewModeChange) {
        this.onViewModeChange("grid");
      }
    });

    viewListBtn.addEventListener("click", () => {
      viewListBtn.classList.add("active");
      viewGridBtn.classList.remove("active");
      if (this.onViewModeChange) {
        this.onViewModeChange("list");
      }
    });

    // Scope dropdown event listeners
    if (scopeBtn && scopeDropdown) {
      scopeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        scopeDropdown.classList.toggle("active");
      });

      scopeOptions.forEach((option) => {
        option.addEventListener("click", (e) => {
          e.stopPropagation();
          const newScope = (option as HTMLElement).dataset.scope as "current" | "all";
          if (newScope && newScope !== this.searchScope) {
            // Save current filter values before scope change
            const currentValues = {
              search: searchInput.value,
              category: categorySelect.value,
              status: statusSelect.value,
              sortField: sortFieldSelect.value,
            };

            this.searchScope = newScope;
            scopeDropdown.classList.remove("active");
            // Re-render to update UI without re-attaching all listeners
            this.render().then(() => {
              // Restore filter values after re-render
              const newSearchInput = this.element.querySelector("#search-input") as HTMLInputElement;
              const newCategorySelect = this.element.querySelector("#filter-category") as HTMLSelectElement;
              const newStatusSelect = this.element.querySelector("#filter-status") as HTMLSelectElement;
              const newSortFieldSelect = this.element.querySelector("#sort-field") as HTMLSelectElement;

              if (newSearchInput) newSearchInput.value = currentValues.search;
              if (newCategorySelect) newCategorySelect.value = currentValues.category;
              if (newStatusSelect) newStatusSelect.value = currentValues.status;
              if (newSortFieldSelect) newSortFieldSelect.value = currentValues.sortField;

              this.attachEventListeners();
              emitChange();
            });
          }
        });
      });

      // Close dropdown when clicking outside
      const closeDropdown = () => {
        scopeDropdown.classList.remove("active");
      };
      document.addEventListener("click", closeDropdown);
    }
  }
}
