import { OCRService, ParsedOCRResult } from '../modules/ocr';

export class OCRModal {
  private modal: HTMLElement;
  private ocrService: OCRService;
  private onRecognized?: (result: ParsedOCRResult) => void;
  private onSearchMetadata?: (title: string, recommendation?: string) => void;

  constructor() {
    this.modal = this.createModal();
    this.ocrService = new OCRService();
    document.body.appendChild(this.modal);
    this.attachEventListeners();
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
          <button id="ocr-recognize" class="btn btn-primary" style="display: none;">Recognize</button>
          <button id="ocr-search" class="btn btn-primary" style="display: none;">Search Metadata</button>
          <button id="ocr-confirm" class="btn btn-primary" style="display: none;">Add Book</button>
        </div>
      </div>
    `;
    return modal;
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
    reader.onload = (e) => {
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
    onSearchMetadata?: (title: string, recommendation?: string) => void
  ): void {
    this.onRecognized = onRecognized;
    this.onSearchMetadata = onSearchMetadata;
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
