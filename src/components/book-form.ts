import type { Book, BookDataSource } from '../types';
import { storage } from '../modules/storage';
import { generateUUID } from '../utils/uuid';
import { aggregateBookData } from '../modules/api/aggregator';
import { generateExternalLinks } from '../modules/api/external-links';
import { parseSmartPaste } from '../utils/text-parser';

export class BookForm {
  private modalElement: HTMLDivElement | null = null;
  private book: Book | null = null;
  private dataSources: BookDataSource[] = [];
  private scannedIsbn: string = '';
  private onSave: () => void;

  constructor(onSave: () => void) {
    this.onSave = onSave;
  }

  async showForNew(isbn?: string): Promise<void> {
    this.book = null;
    this.scannedIsbn = isbn || '';

    // Fetch data if ISBN provided
    if (isbn) {
      this.dataSources = await aggregateBookData(isbn);
    }

    this.render();
  }

  showForEdit(book: Book): void {
    this.book = book;
    this.dataSources = [];
    this.render();
  }

  private render(): void {
    const categories = storage.getCategories();
    const isEdit = this.book !== null;

    // Prepare initial values
    const initialData = this.book || this.getInitialFromSources();

    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal';
    this.modalElement.innerHTML = `
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>${isEdit ? 'Edit Book' : 'Add Book'}</h2>
          <button class="btn-close" id="btn-close-form" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          ${this.dataSources.length > 0 ? `
            <div class="info-box">
              Found ${this.dataSources.length} result(s). You can select values or edit manually.
            </div>
          ` : ''}

          ${!isEdit && this.dataSources.length === 0 ? `
            <div class="smart-paste-section">
              <h3>Smart Paste</h3>
              <textarea id="smart-paste-input" class="textarea-full"
                        placeholder="Paste book information here (Title: xxx, Author: xxx, ISBN: xxx)"></textarea>
              <button id="btn-smart-paste" class="btn-secondary">Parse & Fill</button>
            </div>
            <div class="divider">OR</div>
          ` : ''}

          <form id="book-form">
            <div class="form-group">
              <label>ISBN *</label>
              <input type="text" id="input-isbn" class="input-full" required
                     value="${initialData.isbn || ''}" ${isEdit ? 'readonly' : ''}>
              ${this.renderDataSourceOptions('isbn')}
            </div>

            <div class="form-group">
              <label>Title *</label>
              <input type="text" id="input-title" class="input-full" required
                     value="${initialData.title || ''}">
              ${this.renderDataSourceOptions('title')}
            </div>

            <div class="form-group">
              <label>Author *</label>
              <input type="text" id="input-author" class="input-full" required
                     value="${initialData.author || ''}">
              ${this.renderDataSourceOptions('author')}
            </div>

            <div class="form-group">
              <label>Publisher</label>
              <input type="text" id="input-publisher" class="input-full"
                     value="${initialData.publisher || ''}">
              ${this.renderDataSourceOptions('publisher')}
            </div>

            <div class="form-group">
              <label>Publish Date</label>
              <input type="text" id="input-publish-date" class="input-full"
                     placeholder="YYYY or YYYY-MM-DD" value="${initialData.publishDate || ''}">
              ${this.renderDataSourceOptions('publishDate')}
            </div>

            <div class="form-group">
              <label>Cover URL</label>
              <input type="url" id="input-cover" class="input-full"
                     value="${initialData.cover || ''}">
              ${this.renderDataSourceOptions('cover')}
            </div>

            <div class="form-group">
              <label>Categories</label>
              <div class="checkbox-group">
                ${categories.map(cat => `
                  <label class="checkbox-label">
                    <input type="checkbox" name="category" value="${cat}"
                           ${initialData.categories?.includes(cat) ? 'checked' : ''}>
                    ${cat}
                  </label>
                `).join('')}
              </div>
              <input type="text" id="input-new-category" class="input-full"
                     placeholder="Add new category">
            </div>

            <div class="form-group">
              <label>Tags (comma-separated)</label>
              <input type="text" id="input-tags" class="input-full"
                     placeholder="e.g., programming, rust, reference"
                     value="${initialData.tags?.join(', ') || ''}">
            </div>

            <div class="form-group">
              <label>Reading Status</label>
              <select id="input-status" class="input-full">
                <option value="want" ${initialData.status === 'want' ? 'selected' : ''}>Want to Read</option>
                <option value="reading" ${initialData.status === 'reading' ? 'selected' : ''}>Reading</option>
                <option value="read" ${initialData.status === 'read' ? 'selected' : ''}>Read</option>
              </select>
            </div>

            <div class="form-group">
              <label>Notes</label>
              <textarea id="input-notes" class="textarea-full" rows="4">${initialData.notes || ''}</textarea>
            </div>

            ${!isEdit && initialData.isbn ? `
              <div class="external-links">
                <h3>Search on other platforms:</h3>
                ${this.renderExternalLinks(initialData.isbn, initialData.title)}
              </div>
            ` : ''}

            <div class="modal-actions">
              <button type="button" class="btn-secondary" id="btn-cancel">Cancel</button>
              <button type="submit" class="btn-primary">${isEdit ? 'Update' : 'Add'}</button>
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

  private getInitialFromSources(): Partial<Book> {
    if (this.dataSources.length === 0) {
      return { 
        isbn: this.scannedIsbn,
        categories: [], 
        tags: [], 
        status: 'want', 
        notes: '' 
      };
    }

    const first = this.dataSources[0];
    return {
      isbn: this.scannedIsbn || first.isbn || '',
      title: first.title || '',
      author: first.author || '',
      publisher: first.publisher,
      publishDate: first.publishDate,
      cover: first.cover,
      categories: [],
      tags: [],
      status: 'want',
      notes: ''
    };
  }

  private renderDataSourceOptions(field: keyof BookDataSource): string {
    const sources = this.dataSources.filter(s => s[field]);

    if (sources.length <= 1) return '';

    return `
      <div class="data-sources">
        <small>Available from:</small>
        ${sources.map((s) => `
          <button type="button" class="btn-source" data-field="${field}" data-value="${s[field]}">
            ${s.source}: ${s[field]}
          </button>
        `).join('')}
      </div>
    `;
  }

  private renderExternalLinks(isbn: string, title?: string): string {
    const links = generateExternalLinks(isbn, title);

    return `
      <div class="external-links-list">
        <a href="${links.amazonUS}" target="_blank">Amazon US</a>
        <a href="${links.amazonUK}" target="_blank">Amazon UK</a>
        <a href="${links.amazonEU}" target="_blank">Amazon EU</a>
        <a href="${links.amazonJP}" target="_blank">Amazon JP</a>
        <a href="${links.amazonCN}" target="_blank">Amazon CN</a>
        <a href="${links.douban}" target="_blank">豆瓣读书</a>
        <a href="${links.dangdang}" target="_blank">当当网</a>
        <a href="${links.jd}" target="_blank">京东</a>
        <a href="${links.zlibrary}" target="_blank">zlibrary</a>
        <a href="${links.annasArchive}" target="_blank">Anna's Archive</a>
      </div>
    `;
  }

  private attachEventListeners(): void {
    // Close button
    this.modalElement?.querySelector('#btn-close-form')?.addEventListener('click', () => {
      this.hide();
    });

    this.modalElement?.querySelector('#btn-cancel')?.addEventListener('click', () => {
      this.hide();
    });

    // Data source selection
    this.modalElement?.querySelectorAll('.btn-source').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const field = target.dataset.field!;
        const value = target.dataset.value!;

        const input = this.modalElement?.querySelector(`#input-${field.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()}`) as HTMLInputElement;
        if (input) {
          input.value = value;
        }
      });
    });

    // Smart paste
    this.modalElement?.querySelector('#btn-smart-paste')?.addEventListener('click', () => {
      const textarea = this.modalElement?.querySelector('#smart-paste-input') as HTMLTextAreaElement;
      const parsed = parseSmartPaste(textarea.value);

      if (parsed.isbn) (this.modalElement?.querySelector('#input-isbn') as HTMLInputElement).value = parsed.isbn;
      if (parsed.title) (this.modalElement?.querySelector('#input-title') as HTMLInputElement).value = parsed.title;
      if (parsed.author) (this.modalElement?.querySelector('#input-author') as HTMLInputElement).value = parsed.author;
      if (parsed.publisher) (this.modalElement?.querySelector('#input-publisher') as HTMLInputElement).value = parsed.publisher;
      if (parsed.publishDate) (this.modalElement?.querySelector('#input-publish-date') as HTMLInputElement).value = parsed.publishDate;
    });

    // Form submit
    this.modalElement?.querySelector('#book-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    // Modal background click
    this.modalElement?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) {
        this.hide();
      }
    });
  }

  private handleSubmit(): void {
    const form = this.modalElement?.querySelector('#book-form') as HTMLFormElement;

    const isbn = (form.querySelector('#input-isbn') as HTMLInputElement).value.trim();
    const title = (form.querySelector('#input-title') as HTMLInputElement).value.trim();
    const author = (form.querySelector('#input-author') as HTMLInputElement).value.trim();
    const publisher = (form.querySelector('#input-publisher') as HTMLInputElement).value.trim();
    const publishDate = (form.querySelector('#input-publish-date') as HTMLInputElement).value.trim();
    const cover = (form.querySelector('#input-cover') as HTMLInputElement).value.trim();
    const status = (form.querySelector('#input-status') as HTMLSelectElement).value as Book['status'];
    const notes = (form.querySelector('#input-notes') as HTMLTextAreaElement).value.trim();

    const categories: string[] = [];
    form.querySelectorAll('input[name="category"]:checked').forEach((checkbox) => {
      categories.push((checkbox as HTMLInputElement).value);
    });

    const newCategory = (form.querySelector('#input-new-category') as HTMLInputElement).value.trim();
    if (newCategory) {
      categories.push(newCategory);
      storage.addCategory(newCategory);
    }

    const tagsInput = (form.querySelector('#input-tags') as HTMLInputElement).value.trim();
    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

    if (this.book) {
      // Update existing book
      storage.updateBook(this.book.id, {
        title,
        author,
        publisher: publisher || undefined,
        publishDate: publishDate || undefined,
        cover: cover || undefined,
        categories,
        tags,
        status,
        notes
      });
    } else {
      // Add new book
      const newBook: Book = {
        id: generateUUID(),
        isbn,
        title,
        author,
        publisher: publisher || undefined,
        publishDate: publishDate || undefined,
        cover: cover || undefined,
        categories,
        tags,
        status,
        notes,
        addedAt: Date.now(),
        updatedAt: Date.now(),
        source: this.dataSources.map(s => s.source)
      };

      storage.addBook(newBook);
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
