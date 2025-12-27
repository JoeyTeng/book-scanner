import { Navbar } from './components/navbar';
import { SearchBar } from './components/search-bar';
import { BookList } from './components/book-list';
import { ScannerModal } from './components/scanner-modal';
import { BookForm } from './components/book-form';
import { storage } from './modules/storage';

export class App {
  private navbar!: Navbar;
  private searchBar!: SearchBar;
  private bookList!: BookList;
  private scannerModal!: ScannerModal;
  private bookForm!: BookForm;

  init(): void {
    // Initialize components
    this.navbar = new Navbar('navbar');

    this.bookForm = new BookForm(() => {
      this.bookList.render();
    });

    this.bookList = new BookList(
      'book-list',
      (book) => {
        this.bookForm.showForEdit(book);
      },
      (id) => {
        storage.deleteBook(id);
        this.bookList.render();
      }
    );

    this.searchBar = new SearchBar('search-bar', (filters, sortField, sortOrder) => {
      this.bookList.updateFilters(filters, sortField, sortOrder);
    });

    this.scannerModal = new ScannerModal(async (isbn) => {
      await this.bookForm.showForNew(isbn);
    });

    // Attach FAB button
    document.getElementById('fab-scan')?.addEventListener('click', () => {
      this.scannerModal.show();
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
