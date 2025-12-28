import { OCRService, ParsedOCRResult } from '../modules/ocr';
import { llmService, ParsedBookInfo } from '../modules/llm';
import { ManualLLMHelper, MANUAL_LLM_PROMPTS } from './manual-llm-helper';
import { storage } from '../modules/storage';
import { Book } from '../types';
import { searchBookByTitle } from '../modules/api/aggregator';

export class OCRModal {
  private modal: HTMLElement;
  private ocrService: OCRService;
  private onRecognized?: (result: ParsedOCRResult) => void;
  private onSearchMetadata?: (title: string, recommendation?: string) => void;
  private onBooksAdded?: () => void;

  constructor() {
    this.modal = this.createModal();
    this.ocrService = new OCRService();
    document.body.appendChild(this.modal);
    this.attachEventListeners();
    // Update LLM button visibility after modal is created
    this.updateLLMButtonVisibility();
  }

  private createModal(): HTMLElement {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "ocr-modal";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Recognize Book Screenshot</h2>
          <button class="btn-close" id="ocr-close">&times;</button>
        </div>
        <div class="modal-body">
          <div id="ocr-upload" class="ocr-upload-area">
            <div class="upload-icon">📸</div>
            <p>Click to upload or drag & drop</p>
            <p class="upload-hint">Xiaohongshu screenshot or book photo</p>
            <input type="file" id="ocr-file-input" accept="image/*" style="display: none;">
          </div>

          <div id="ocr-preview" class="ocr-preview" style="display: none;">
            <img id="ocr-image" src="" alt="Preview">
          </div>

          <div id="ocr-progress" class="ocr-progress" style="display: none;">
            <div class="progress-label">Initializing OCR...</div>
            <div class="progress-bar">
              <div id="ocr-progress-fill" class="progress-fill"></div>
            </div>
            <div class="progress-percent">0%</div>
          </div>

          <div id="ocr-result" class="ocr-result" style="display: none;">
            <h3>Recognized Content</h3>
            <div class="form-group">
              <label>Book Title</label>
              <input type="text" id="ocr-title" class="input-full">
            </div>
            <div class="form-group">
              <label>Recommendation</label>
              <textarea id="ocr-recommendation" rows="6" class="input-full"></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="ocr-cancel" class="btn btn-secondary">Cancel</button>
          <button id="ocr-manual-llm" class="btn btn-secondary">📱 Use Your Own LLM</button>
          <button id="ocr-recognize" class="btn btn-primary" style="display: none;">Recognize with Tesseract</button>
          <button id="ocr-llm-vision" class="btn btn-primary" style="display: none;">✨ Recognize with LLM Vision</button>
          <button id="ocr-search" class="btn btn-primary" style="display: none;">Search Metadata</button>
          <button id="ocr-confirm" class="btn btn-primary" style="display: none;">Add Book</button>
        </div>
      </div>
    `;
    return modal;
  }

  private async updateLLMButtonVisibility(): Promise<void> {
    const llmVisionBtn = this.modal.querySelector("#ocr-llm-vision");
    if (llmVisionBtn && !(await llmService.isConfigured())) {
      (llmVisionBtn as HTMLElement).style.display = "none";
    }
  }

  private attachEventListeners(): void {
    // Close button
    const closeBtn = this.modal.querySelector("#ocr-close") as HTMLElement;
    closeBtn?.addEventListener("click", () => this.close());

    // Cancel button
    const cancelBtn = this.modal.querySelector("#ocr-cancel") as HTMLElement;
    cancelBtn?.addEventListener("click", () => this.close());

    // Upload area click
    const uploadArea = this.modal.querySelector("#ocr-upload") as HTMLElement;
    const fileInput = this.modal.querySelector(
      "#ocr-file-input"
    ) as HTMLInputElement;

    uploadArea?.addEventListener("click", () => {
      fileInput?.click();
    });

    // File input change
    fileInput?.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        this.handleFileSelected(target.files[0]);
      }
    });

    // Drag and drop
    uploadArea?.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("drag-over");
    });

    uploadArea?.addEventListener("dragleave", () => {
      uploadArea.classList.remove("drag-over");
    });

    uploadArea?.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("drag-over");

      const files = e.dataTransfer?.files;
      if (files && files[0]) {
        this.handleFileSelected(files[0]);
      }
    });

    // Recognize button
    const recognizeBtn = this.modal.querySelector(
      "#ocr-recognize"
    ) as HTMLElement;
    recognizeBtn?.addEventListener("click", () => this.startRecognition());

    // Manual LLM button
    const manualLLMBtn = this.modal.querySelector(
      "#ocr-manual-llm"
    ) as HTMLElement;
    manualLLMBtn?.addEventListener("click", () => this.showManualLLMHelper());

    // LLM Vision button
    const llmVisionBtn = this.modal.querySelector(
      "#ocr-llm-vision"
    ) as HTMLElement;
    llmVisionBtn?.addEventListener("click", () => this.startLLMVisionRecognition());

    // Search metadata button
    const searchBtn = this.modal.querySelector("#ocr-search") as HTMLElement;
    searchBtn?.addEventListener("click", () => this.handleSearchMetadata());

    // Confirm button
    const confirmBtn = this.modal.querySelector("#ocr-confirm") as HTMLElement;
    confirmBtn?.addEventListener("click", () => this.handleConfirm());

    // Close on backdrop click
    this.modal.addEventListener("click", (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
  }

  private handleFileSelected(file: File): void {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imgElement = this.modal.querySelector(
        "#ocr-image"
      ) as HTMLImageElement;
      if (imgElement && e.target?.result) {
        imgElement.src = e.target.result as string;
      }

      // Update UI
      this.showElement("#ocr-preview");
      this.hideElement("#ocr-upload");
      this.showElement("#ocr-recognize");
      if (await llmService.isConfigured()) {
        this.showElement("#ocr-llm-vision");
      }
    };
    reader.readAsDataURL(file);

    // Store file for later recognition
    (this.modal as any)._selectedFile = file;
  }

  private async startRecognition(): Promise<void> {
    const file = (this.modal as any)._selectedFile as File;
    if (!file) return;

    this.hideElement("#ocr-recognize");
    this.showElement("#ocr-progress");

    const progressLabel = this.modal.querySelector(
      ".progress-label"
    ) as HTMLElement;
    const progressFill = this.modal.querySelector(
      "#ocr-progress-fill"
    ) as HTMLElement;
    const progressPercent = this.modal.querySelector(
      ".progress-percent"
    ) as HTMLElement;

    try {
      // Initialize OCR
      progressLabel.textContent = "Loading OCR engine...";
      await this.ocrService.initialize((progress) => {
        const percent = Math.round(progress * 50); // 0-50% for initialization
        progressFill.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;
      });

      // Recognize text
      progressLabel.textContent = "Recognizing text...";
      const text = await this.ocrService.recognizeImage(file, (progress) => {
        const percent = 50 + Math.round(progress * 50); // 50-100% for recognition
        progressFill.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;
      });

      // Parse content
      const result = this.ocrService.parseXiaohongshuContent(text);

      // Show result
      this.hideElement("#ocr-progress");
      this.showElement("#ocr-result");
      this.showElement("#ocr-search");
      this.showElement("#ocr-confirm");

      const titleInput = this.modal.querySelector(
        "#ocr-title"
      ) as HTMLInputElement;
      const recommendationInput = this.modal.querySelector(
        "#ocr-recommendation"
      ) as HTMLTextAreaElement;

      if (titleInput) titleInput.value = result.bookTitle || "";
      if (recommendationInput)
        recommendationInput.value = result.recommendation || "";
    } catch (error) {
      console.error("OCR error:", error);
      alert("Failed to recognize text. Please try again.");

      // Reset UI
      this.hideElement("#ocr-progress");
      this.showElement("#ocr-recognize");
      if (await llmService.isConfigured()) {
        this.showElement("#ocr-llm-vision");
      }
    }
  }

  private async startLLMVisionRecognition(): Promise<void> {
    const file = (this.modal as any)._selectedFile as File;
    if (!file) return;

    this.hideElement("#ocr-recognize");
    this.hideElement("#ocr-llm-vision");
    this.showElement("#ocr-progress");

    const progressLabel = this.modal.querySelector(
      ".progress-label"
    ) as HTMLElement;
    const progressFill = this.modal.querySelector(
      "#ocr-progress-fill"
    ) as HTMLElement;
    const progressPercent = this.modal.querySelector(
      ".progress-percent"
    ) as HTMLElement;

    try {
      progressLabel.textContent = "Analyzing image with LLM Vision...";
      progressFill.style.width = "30%";
      progressPercent.textContent = "30%";

      // Call LLM Vision API
      const books = await llmService.parseBooksFromImage(file);

      progressFill.style.width = "100%";
      progressPercent.textContent = "100%";

      if (!books || books.length === 0) {
        throw new Error("No books found in the image");
      }

      // If multiple books found, use the first one for single book OCR
      // (or could show a selection dialog)
      const book = books[0];

      // Show result
      this.hideElement("#ocr-progress");
      this.showElement("#ocr-result");
      this.showElement("#ocr-search");
      this.showElement("#ocr-confirm");

      const titleInput = this.modal.querySelector(
        "#ocr-title"
      ) as HTMLInputElement;
      const recommendationInput = this.modal.querySelector(
        "#ocr-recommendation"
      ) as HTMLTextAreaElement;

      if (titleInput) titleInput.value = book.title || "";
      if (recommendationInput) recommendationInput.value = book.notes || "";

      // Store parsed book info for later use
      (this.modal as any)._llmParsedBook = book;
    } catch (error) {
      console.error("LLM Vision error:", error);
      alert("Failed to recognize with LLM Vision. Please try Tesseract OCR or check your API configuration.");

      // Reset UI
      this.hideElement("#ocr-progress");
      this.showElement("#ocr-recognize");
      if (await llmService.isConfigured()) {
        this.showElement("#ocr-llm-vision");
      }
    }
  }

  private handleConfirm(): void {
    const titleInput = this.modal.querySelector(
      "#ocr-title"
    ) as HTMLInputElement;
    const recommendationInput = this.modal.querySelector(
      "#ocr-recommendation"
    ) as HTMLTextAreaElement;

    const result: ParsedOCRResult = {
      bookTitle: titleInput.value.trim() || undefined,
      recommendation: recommendationInput.value.trim() || undefined,
    };

    if (this.onRecognized) {
      this.onRecognized(result);
    }

    this.close();
  }

  private handleSearchMetadata(): void {
    const titleInput = this.modal.querySelector(
      "#ocr-title"
    ) as HTMLInputElement;
    const recommendationInput = this.modal.querySelector(
      "#ocr-recommendation"
    ) as HTMLTextAreaElement;

    const title = titleInput.value.trim();
    const recommendation = recommendationInput.value.trim();

    if (title && this.onSearchMetadata) {
      this.onSearchMetadata(title, recommendation || undefined);
      this.close();
    } else {
      alert("Please enter a book title to search.");
    }
  }

  private showManualLLMHelper(): void {
    // Temporarily hide this modal to avoid z-index conflicts
    this.modal.classList.remove('active');

    const helper = new ManualLLMHelper({
      title: '📱 Extract Book Info with Your LLM App',
      description: 'Use ChatGPT, Claude, or any LLM app with vision to extract book information from your screenshot.',
      systemPrompt: MANUAL_LLM_PROMPTS.smartPaste.system,
      userPromptTemplate: MANUAL_LLM_PROMPTS.smartPaste.user,
      onResult: async (result) => {
        const books = Array.isArray(result) ? result : [result];
        if (books.length === 0) {
          alert('No book information found in the result. Please try again.');
          // Restore OCR modal
          this.modal.classList.add('active');
          return;
        }

        // Close OCR modal and add all books (same behavior as VisionUploadModal)
        this.close();
        await this.addBooks(books);
      }
    });

    helper.show('Upload your screenshot to your LLM app and paste the JSON response below.');
  }

  private async addBooks(parsedBooks: ParsedBookInfo[]): Promise<void> {
    const addedBooks: Book[] = [];
    const existingBooks = await storage.getBooks();

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
      const book: Book = {
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
        source: ['manual-llm']
      };

      await storage.addBook(book);
      addedBooks.push(book);
    }

    // Show success message
    if (addedBooks.length > 0) {
      alert(`Successfully added ${addedBooks.length} book(s)!`);

      // Trigger refresh
      if (this.onBooksAdded) {
        this.onBooksAdded();
      }
    } else {
      alert('No new books to add (all were duplicates).');
    }
  }

  private showElement(selector: string): void {
    const element = this.modal.querySelector(selector) as HTMLElement;
    if (element) {
      element.style.display = "";
    }
  }

  private hideElement(selector: string): void {
    const element = this.modal.querySelector(selector) as HTMLElement;
    if (element) {
      element.style.display = "none";
    }
  }

  open(
    onRecognized: (result: ParsedOCRResult) => void,
    onSearchMetadata?: (title: string, recommendation?: string) => void,
    onBooksAdded?: () => void
  ): void {
    this.onRecognized = onRecognized;
    this.onSearchMetadata = onSearchMetadata;
    this.onBooksAdded = onBooksAdded;
    this.modal.classList.add("active");
    document.body.style.overflow = "hidden";

    // Reset UI
    this.showElement("#ocr-upload");
    this.hideElement("#ocr-preview");
    this.hideElement("#ocr-progress");
    this.hideElement("#ocr-result");
    this.hideElement("#ocr-recognize");
    this.hideElement("#ocr-search");
    this.hideElement("#ocr-confirm");

    // Reset file input
    const fileInput = this.modal.querySelector(
      "#ocr-file-input"
    ) as HTMLInputElement;
    if (fileInput) fileInput.value = "";
    delete (this.modal as any)._selectedFile;
  }

  close(): void {
    this.modal.classList.remove("active");
    document.body.style.overflow = "";
  }

  async cleanup(): Promise<void> {
    await this.ocrService.terminate();
  }
}
