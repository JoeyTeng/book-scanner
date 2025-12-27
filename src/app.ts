import { Navbar } from './components/navbar';
import { SearchBar } from './components/search-bar';
import { BookList } from './components/book-list';
import { ScannerModal } from './components/scanner-modal';
import { OCRModal } from './components/ocr-modal';
import { BookForm } from './components/book-form';
import { storage } from './modules/storage';

export class App {
  private bookList!: BookList;
  private scannerModal!: ScannerModal;
  private ocrModal!: OCRModal;
  private bookForm!: BookForm;

  init(): void {
    // Initialize components
    new Navbar('navbar');

    this.bookForm = new BookForm(() => {
      this.bookList.render();
    });

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

    new SearchBar("search-bar", (filters, sortField, sortOrder) => {
      this.bookList.updateFilters(filters, sortField, sortOrder);
    });

    this.ocrModal = new OCRModal();

    this.scannerModal = new ScannerModal(async (isbn) => {
      await this.bookForm.showForNew(isbn);
    });

    // Attach FAB button
    document.getElementById("fab-scan")?.addEventListener("click", () => {
      this.scannerModal.show(() => {
        // OCR button clicked in scanner modal
        this.ocrModal.open(async (result) => {
          // Ensure Wishlist category exists
          const categories = storage.getCategories();
          if (!categories.includes("Wishlist")) {
            storage.addCategory("Wishlist");
          }

          // Open book form with OCR result
          await this.bookForm.showForNew(undefined, result.recommendation);

          // Pre-fill title if recognized
          if (result.bookTitle) {
            setTimeout(() => {
              const titleInput = document.querySelector(
                "#input-title"
              ) as HTMLInputElement;
              if (titleInput && result.bookTitle) {
                titleInput.value = result.bookTitle;
              }

              // Auto-select Wishlist category
              const wishlistCheckbox = document.querySelector(
                'input[name="category"][value="Wishlist"]'
              ) as HTMLInputElement;
              if (wishlistCheckbox) wishlistCheckbox.checked = true;
            }, 100);
          }
        });
      });
    });

    // Initial render
    this.bookList.render();

    // Check for API key on first load
    this.checkApiKey();
  }

  private checkApiKey(): void {
    if (!storage.getGoogleBooksApiKey() && storage.getBooks().length === 0) {
      setTimeout(() => {
        if (confirm('Google Books API key is not set. Would you like to set it now?')) {
          document.getElementById('btn-menu')?.click();
          setTimeout(() => {
            document.getElementById('btn-api-key')?.click();
          }, 100);
        }
      }, 1000);
    }
  }
}
