import { llmService, ParsedBookInfo } from '../modules/llm';
import { storage } from '../modules/storage';
import { Book } from '../types';
import { searchBookByTitle } from '../modules/api/aggregator';

export class VisionUploadModal {
  private modalElement: HTMLDivElement | null = null;
  private onBooksAdded?: () => void;

  constructor(onBooksAdded?: () => void) {
    this.onBooksAdded = onBooksAdded;
  }

  show(): void {
    this.render();
  }

  hide(): void {
    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
      document.body.style.overflow = '';
    }
  }

  private render(): void {
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal';
    this.modalElement.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>📸 Add Books from Image</h2>
          <button class="btn-close" id="btn-close-vision">&times;</button>
        </div>
        <div class="modal-body">
          ${
            !llmService.isConfigured()
              ? `
              <div class="info-box warning-box">
                <p>⚠️ LLM Vision requires API configuration</p>
                <p>Please configure your LLM API in Settings first. Make sure to use a vision-capable model like gpt-4o, gpt-4o-mini, or deepseek-chat.</p>
              </div>
            `
              : `
              <div class="info-box">
                <p>📷 Upload a screenshot containing book recommendations</p>
                <p>Supports Xiaohongshu, Douban, WeChat Read, Amazon listings, etc.</p>
              </div>

              <div class="upload-section">
                <input type="file" id="vision-file-input" accept="image/*" style="display: none;">
                <button id="btn-select-image" class="btn-primary btn-large">
                  📤 Select Image
                </button>
                <div id="image-preview" style="display: none; margin-top: 1rem;">
                  <img id="preview-img" style="max-width: 100%; max-height: 300px; border-radius: 8px;">
                  <p id="preview-name" style="margin-top: 0.5rem; color: var(--color-text-secondary);"></p>
                </div>
              </div>

              <div id="parsing-status" style="display: none; margin-top: 1rem;">
                <div class="loading-spinner"></div>
                <p id="status-text">Analyzing image with Vision API...</p>
              </div>

              <div id="books-preview" style="display: none; margin-top: 1rem;">
                <h3>Found Books:</h3>
                <div id="books-list"></div>
                <div class="modal-actions">
                  <button id="btn-add-all" class="btn-primary">Add All Books</button>
                  <button id="btn-cancel-preview" class="btn-secondary">Cancel</button>
                </div>
              </div>
            `
          }
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
    this.modalElement?.querySelector('#btn-close-vision')?.addEventListener('click', () => {
      this.hide();
    });

    if (!llmService.isConfigured()) {
      return;
    }

    // Select image button
    this.modalElement?.querySelector('#btn-select-image')?.addEventListener('click', () => {
      this.modalElement?.querySelector<HTMLInputElement>('#vision-file-input')?.click();
    });

    // File input change
    this.modalElement?.querySelector('#vision-file-input')?.addEventListener('change', async (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;

      // Show preview
      const preview = this.modalElement?.querySelector('#image-preview') as HTMLElement;
      const previewImg = this.modalElement?.querySelector('#preview-img') as HTMLImageElement;
      const previewName = this.modalElement?.querySelector('#preview-name') as HTMLElement;

      previewImg.src = URL.createObjectURL(file);
      previewName.textContent = file.name;
      preview.style.display = 'block';

      // Start parsing
      await this.parseImage(file);
    });
  }

  private async parseImage(file: File): Promise<void> {
    const statusSection = this.modalElement?.querySelector('#parsing-status') as HTMLElement;
    const booksPreview = this.modalElement?.querySelector('#books-preview') as HTMLElement;

    statusSection.style.display = 'block';
    booksPreview.style.display = 'none';

    try {
      const books = await llmService.parseBooksFromImage(file);

      if (!books || books.length === 0) {
        alert('No books found in the image. Please try another image or check the image quality.');
        statusSection.style.display = 'none';
        return;
      }

      // Show books preview
      await this.showBooksPreview(books);
      statusSection.style.display = 'none';
      booksPreview.style.display = 'block';
    } catch (error) {
      console.error('Failed to parse image:', error);
      alert('Failed to parse image. Please check your API configuration and try again.');
      statusSection.style.display = 'none';
    }
  }

  private async showBooksPreview(parsedBooks: ParsedBookInfo[]): Promise<void> {
    const booksList = this.modalElement?.querySelector('#books-list') as HTMLElement;

    booksList.innerHTML = parsedBooks.map((book, index) => `
      <div class="book-preview-item" data-index="${index}">
        <div class="book-preview-content">
          <h4>${book.title || 'Unknown Title'}</h4>
          <p><strong>Author:</strong> ${book.author || 'Unknown'}</p>
          ${book.isbn ? `<p><strong>ISBN:</strong> ${book.isbn}</p>` : ''}
          ${book.publisher ? `<p><strong>Publisher:</strong> ${book.publisher}</p>` : ''}
          ${book.publishDate ? `<p><strong>Date:</strong> ${book.publishDate}</p>` : ''}
          ${book.notes ? `<p><strong>Notes:</strong> ${book.notes}</p>` : ''}
        </div>
        <div class="book-preview-actions">
          <label>
            <input type="checkbox" checked data-index="${index}">
            Add this book
          </label>
        </div>
      </div>
    `).join('');

    // Add All button
    this.modalElement?.querySelector('#btn-add-all')?.addEventListener('click', async () => {
      const checkboxes = this.modalElement?.querySelectorAll<HTMLInputElement>('#books-list input[type="checkbox"]');
      const selectedBooks = parsedBooks.filter((_, index) => {
        const checkbox = Array.from(checkboxes || []).find(cb => cb.dataset.index === String(index));
        return checkbox?.checked;
      });

      if (selectedBooks.length === 0) {
        alert('Please select at least one book to add.');
        return;
      }

      await this.addBooks(selectedBooks);
    });

    // Cancel button
    this.modalElement?.querySelector('#btn-cancel-preview')?.addEventListener('click', () => {
      this.hide();
    });
  }

  private async addBooks(parsedBooks: ParsedBookInfo[]): Promise<void> {
    const addedBooks: Book[] = [];
    const existingBooks = storage.getBooks();

    for (const parsedBook of parsedBooks) {
      // Check if book already exists (by ISBN or title)
      const isDuplicate = existingBooks.some(
        (b: Book) =>
          (parsedBook.isbn && b.isbn === parsedBook.isbn) ||
          (parsedBook.title &&
            b.title === parsedBook.title &&
            b.author === parsedBook.author)
      );

      if (isDuplicate) {
        console.log('Skipping duplicate book:', parsedBook.title);
        continue;
      }

      // Try to fetch more info from APIs if we have title
      let finalBook = parsedBook;
      if (parsedBook.title && !parsedBook.isbn) {
        try {
          const apiResults = await searchBookByTitle(parsedBook.title);
          if (apiResults.length > 0) {
            // Use first result to supplement missing fields
            const apiBook = apiResults[0];
            finalBook = {
              ...parsedBook,
              isbn: parsedBook.isbn || apiBook.isbn,
              cover: parsedBook.cover || apiBook.cover,
              publisher: parsedBook.publisher || apiBook.publisher,
              publishDate: parsedBook.publishDate || apiBook.publishDate
            };
          }
        } catch (error) {
          console.error('Failed to fetch additional info for:', parsedBook.title, error);
        }
      }

      // Create book object
      const newBook: Book = {
        id: String(Date.now() + Math.random()),
        isbn: finalBook.isbn || '',
        title: finalBook.title || 'Unknown Title',
        author: finalBook.author || 'Unknown Author',
        status: 'want',
        categories: [],
        addedAt: Date.now(),
        updatedAt: Date.now(),
        publisher: finalBook.publisher,
        publishDate: finalBook.publishDate,
        cover: finalBook.cover,
        tags: [],
        recommendation: finalBook.notes, // Store LLM notes as recommendation
        notes: '',
        source: ['llm-vision']
      };

      storage.addBook(newBook);
      addedBooks.push(newBook);
    }

    this.hide();

    if (addedBooks.length > 0) {
      alert(`Successfully added ${addedBooks.length} book(s)!`);
      if (this.onBooksAdded) {
        this.onBooksAdded();
      }
    } else {
      alert('No new books were added (all were duplicates or invalid).');
    }
  }
}
