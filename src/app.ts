import { Navbar } from './components/navbar';
import { SearchBar } from './components/search-bar';
import { BookList } from './components/book-list';
import { ScannerModal } from './components/scanner-modal';
import { OCRModal } from './components/ocr-modal';
import { BookSelectorModal } from "./components/book-selector-modal";
import { BookForm } from './components/book-form';
import { BulkEditModal } from './components/bulk-edit-modal';
import { storage } from './modules/storage';
import { searchBookByTitle } from "./modules/api/aggregator";

export class App {
  private bookList!: BookList;
  private searchBar!: SearchBar;
  private scannerModal!: ScannerModal;
  private ocrModal!: OCRModal;
  private bookSelectorModal!: BookSelectorModal;
  private bookForm!: BookForm;
  private bulkEditModal!: BulkEditModal;
  private bulkEditMode: boolean = false;
  private selectedBookIds: string[] = [];

  init(): void {
    // Initialize components
    new Navbar("navbar", () => {
      this.bookList.render();
    });

    this.bookForm = new BookForm(() => {
      this.bookList.render();
    });

    this.bulkEditModal = new BulkEditModal(() => {
      this.bookList.render();
      this.exitBulkEditMode();
    });

    this.bookSelectorModal = new BookSelectorModal();

    this.bookList = new BookList(
      "book-list",
      (book) => {
        this.bookForm.showForEdit(book);
      },
      (id) => {
        storage.deleteBook(id);
        this.bookList.render();
      }
    );

    this.searchBar = new SearchBar("search-bar", (filters, sortField, sortOrder) => {
      this.bookList.updateFilters(filters, sortField, sortOrder);
    });

    // Set up bulk edit handler
    this.searchBar.setBulkEditClickHandler(() => {
      this.handleBulkEditClick();
    });

    // Set up view mode change handler
    this.searchBar.setViewModeChangeHandler((mode) => {
      this.bookList.setViewMode(mode);
    });

    this.ocrModal = new OCRModal();

    this.scannerModal = new ScannerModal(async (isbn) => {
      // Scenario C: ISBN search from barcode/manual input
      await this.handleISBNSearch(isbn);
    });

    // Attach FAB button
    document.getElementById("fab-scan")?.addEventListener("click", () => {
      this.scannerModal.show(
        // OCR button callback
        () => {
          // Scenario A: OCR recognition
          this.ocrModal.open(
            // Direct add callback
            async (result) => {
              await this.handleOCRDirectAdd(
                result.bookTitle,
                result.recommendation
              );
            },
            // Search metadata callback
            async (title, recommendation) => {
              await this.handleTitleSearch(title, recommendation);
            },
            // Books added callback (for manual LLM mode)
            () => {
              this.bookList.render();
            }
          );
        },
        // Title search callback
        async (title) => {
          // Scenario B: Manual title input
          await this.handleTitleSearch(title);
        }
      );
    });

    // Initial render
    this.bookList.render();

    // Check for API key on first load
    this.checkApiKey();
  }

  /**
   * Handle ISBN search (from barcode or manual input)
   * Scenario C: Show fallback if no results found
   */
  private async handleISBNSearch(isbn: string): Promise<void> {
    await this.bookForm.showForNew(
      isbn,
      undefined,
      // Fallback: search by title when ISBN fails
      async () => {
        const title = prompt("Enter book title to search:");
        if (title) {
          await this.handleTitleSearch(title, undefined, isbn);
        }
      }
    );
  }

  /**
   * Handle title search - show selector modal with results
   */
  private async handleTitleSearch(
    title: string,
    recommendation?: string,
    preserveISBN?: string
  ): Promise<void> {
    this.bookSelectorModal.showLoading();

    const results = await searchBookByTitle(title);

    if (results.length === 0) {
      // No results - let user fill manually
      await this.bookSelectorModal.close();
      await this.bookForm.showForNew(preserveISBN, recommendation);

      // Pre-fill title
      setTimeout(() => {
        const titleInput = document.querySelector(
          "#input-title"
        ) as HTMLInputElement;
        if (titleInput) titleInput.value = title;
      }, 100);
    } else {
      // Show results for selection
      await this.bookSelectorModal.open(results, async (selected) => {
        // User selected a book - open form with all data
        await this.bookForm.showForNew(
          preserveISBN || selected.isbn,
          recommendation
        );

        // Pre-fill all fields from selected source
        setTimeout(() => {
          if (selected.title) {
            (document.querySelector("#input-title") as HTMLInputElement).value =
              selected.title;
          }
          if (selected.author) {
            (
              document.querySelector("#input-author") as HTMLInputElement
            ).value = selected.author;
          }
          if (selected.publisher) {
            (
              document.querySelector("#input-publisher") as HTMLInputElement
            ).value = selected.publisher;
          }
          if (selected.publishDate) {
            (
              document.querySelector("#input-publish-date") as HTMLInputElement
            ).value = selected.publishDate;
          }
          if (selected.cover) {
            (document.querySelector("#input-cover") as HTMLInputElement).value =
              selected.cover;
          }

          // Auto-select Wishlist if recommendation exists
          if (recommendation) {
            const wishlistCheckbox = document.querySelector(
              'input[name="category"][value="Wishlist"]'
            ) as HTMLInputElement;
            if (wishlistCheckbox) wishlistCheckbox.checked = true;
          }
        }, 100);
      });
    }
  }

  /**
   * Handle OCR direct add (without metadata search)
   */
  private async handleOCRDirectAdd(
    title?: string,
    recommendation?: string
  ): Promise<void> {
    // Ensure Wishlist category exists
    const categories = storage.getCategories();
    if (!categories.includes("Wishlist")) {
      storage.addCategory("Wishlist");
    }

    await this.bookForm.showForNew(undefined, recommendation);

    // Pre-fill title if recognized
    if (title) {
      setTimeout(() => {
        const titleInput = document.querySelector(
          "#input-title"
        ) as HTMLInputElement;
        if (titleInput) titleInput.value = title;

        // Auto-select Wishlist category
        const wishlistCheckbox = document.querySelector(
          'input[name="category"][value="Wishlist"]'
        ) as HTMLInputElement;
        if (wishlistCheckbox) wishlistCheckbox.checked = true;
      }, 100);
    }
  }

  private checkApiKey(): void {
    if (!storage.getGoogleBooksApiKey() && storage.getBooks().length === 0) {
      setTimeout(() => {
        if (
          confirm(
            "Google Books API key is not set. Would you like to set it now?"
          )
        ) {
          document.getElementById("btn-menu")?.click();
          setTimeout(() => {
            document.getElementById("btn-api-key")?.click();
          }, 100);
        }
      }, 1000);
    }
  }

  private handleBulkEditClick(): void {
    if (!this.bulkEditMode) {
      // Enter bulk edit mode
      this.enterBulkEditMode();
    } else {
      // If in bulk edit mode, either exit or open modal
      if (this.selectedBookIds.length > 0) {
        this.bulkEditModal.show(this.selectedBookIds);
      } else {
        this.exitBulkEditMode();
      }
    }
  }

  private enterBulkEditMode(): void {
    this.bulkEditMode = true;
    this.selectedBookIds = [];
    this.bookList.setBulkSelectMode(true, (selectedIds) => {
      this.selectedBookIds = selectedIds;
      this.searchBar.updateBulkEditButton(true, selectedIds.length);
    });
    this.searchBar.updateBulkEditButton(true, 0);
  }

  private exitBulkEditMode(): void {
    this.bulkEditMode = false;
    this.selectedBookIds = [];
    this.bookList.setBulkSelectMode(false);
    this.searchBar.updateBulkEditButton(false, 0);
  }
}
