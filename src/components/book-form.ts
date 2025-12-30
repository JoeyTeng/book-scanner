import type { Book, BookDataSource } from '../types';
import { storage } from '../modules/storage';
import { generateUUID } from '../utils/uuid';
import {
  aggregateBookData,
  searchBookByTitle,
} from "../modules/api/aggregator";
import { generateExternalLinks } from "../modules/api/external-links";
import { parseSmartPaste } from "../utils/text-parser";
import { llmService } from "../modules/llm";
import { ManualLLMHelper, MANUAL_LLM_PROMPTS } from "./manual-llm-helper";
import { i18n } from '../modules/i18n';
import { CategoryTagInput } from './category-tag-input';

export class BookForm {
  private modalElement: HTMLDivElement | null = null;
  private book: Book | null = null;
  private dataSources: BookDataSource[] = [];
  private scannedIsbn: string = "";
  private initialRecommendation: string = "";
  private onSave: () => void;
  private onTitleSearchRequest?: () => void;
  private categoryTagInput: CategoryTagInput | null = null;

  constructor(onSave: () => void) {
    this.onSave = onSave;
  }

  async showForNew(
    isbn?: string,
    recommendation?: string,
    onTitleSearchRequest?: () => void
  ): Promise<void> {
    this.book = null;
    this.scannedIsbn = isbn || "";
    this.initialRecommendation = recommendation || "";
    this.onTitleSearchRequest = onTitleSearchRequest;

    // Fetch data if ISBN provided
    if (isbn) {
      this.dataSources = await aggregateBookData(isbn);
    }

    await this.render();
  }

  async showForEdit(book: Book): Promise<void> {
    this.book = book;
    this.dataSources = [];
    await this.render();
  }

  private async render(): Promise<void> {
    const isEdit = this.book !== null;

    // Prepare initial values
    const initialData = this.book || this.getInitialFromSources();

    this.modalElement = document.createElement("div");
    this.modalElement.className = "modal";
    this.modalElement.innerHTML = `
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>${isEdit ? i18n.t('bookForm.title.edit') : i18n.t('bookForm.title.add')}</h2>
          <button class="btn-close" id="btn-close-form" aria-label="${i18n.t('common.close')}">&times;</button>
        </div>
        <div class="modal-body">
          ${
            this.dataSources.length > 0
              ? `
            <div class="info-box">
              ${i18n.t('bookForm.found', { count: this.dataSources.length })}
            </div>
          `
              : ""
          }

          ${
            !isEdit && this.scannedIsbn && this.dataSources.length === 0
              ? `
            <div class="info-box warning-box">
              <p>⚠️ ${i18n.t('bookForm.isbnFailed', { isbn: this.scannedIsbn })}</p>
              <button id="btn-search-by-title" class="btn btn-small">${i18n.t('bookForm.searchByTitle')}</button>
            </div>
          `
              : ""
          }

          ${
            isEdit || (this.dataSources.length === 0 && !this.scannedIsbn)
              ? `
            <div class="smart-paste-section">
              <h3>${i18n.t('bookForm.smartPaste')}</h3>
              <p class="hint-text">${i18n.t('bookForm.smartPaste.help')}</p>
              <textarea id="smart-paste-input" class="textarea-full"
                        placeholder="${i18n.t('bookForm.smartPaste.placeholder')}"></textarea>
              <div class="button-group">
                ${(
                  await llmService.isTextConfigured()
                )
                  ? `<button id="btn-llm-parse" class="btn-secondary">${i18n.t('bookForm.parseLLM')}</button>`
                  : ""
                }
                <button id="btn-manual-llm" class="btn-secondary">${i18n.t('bookForm.useYourLLM')}</button>
              </div>
              ${
                !(await llmService.isTextConfigured())
                  ? `<p class="hint-text">${i18n.t('bookForm.llmTip')}</p>`
                  : ""
              }
            </div>
            <div class="divider">${i18n.t('common.or')}</div>
          `
              : ""
          }

          ${
            isEdit
              ? `
            <div class="info-box">
              <p>${i18n.t('bookForm.refreshMetadata')}</p>
              <div class="button-group">
                <button id="btn-refresh-isbn" class="btn btn-secondary btn-small" ${
                  !initialData.isbn ? "disabled" : ""
                }>
                  ${i18n.t('bookForm.refreshISBN')}
                </button>
                <button id="btn-refresh-title" class="btn btn-secondary btn-small" ${
                  !initialData.title ? "disabled" : ""
                }>
                  ${i18n.t('bookForm.refreshTitle')}
                </button>
              </div>
            </div>
          `
              : ""
          }

          <form id="book-form">
            <h3>${i18n.t('bookForm.basicInfo')}</h3>
            <!-- Always visible fields -->
            <div class="form-group">
              <label>${i18n.t('bookForm.label.isbn')}</label>
              <input type="text" id="input-isbn" class="input-full"
                     value="${initialData.isbn || ""}">
              ${this.renderDataSourceOptions("isbn")}
            </div>

            <div class="form-group">
              <label>${i18n.t('bookForm.label.title')} *</label>
              <input type="text" id="input-title" class="input-full" required
                     value="${initialData.title || ""}">
              ${this.renderDataSourceOptions("title")}
            </div>

            <div class="form-group">
              <label>${i18n.t('bookForm.label.author')} *</label>
              <input type="text" id="input-author" class="input-full" required
                     value="${initialData.author || ""}">
              ${this.renderDataSourceOptions("author")}
            </div>

            <div class="form-group">
              <label>${i18n.t('bookForm.label.status')}</label>
              <select id="input-status" class="input-full">
                <option value="want" ${
                  initialData.status === "want" ? "selected" : ""
                }>${i18n.t('bookForm.status.want')}</option>
                <option value="reading" ${
                  initialData.status === "reading" ? "selected" : ""
                }>${i18n.t('bookForm.status.reading')}</option>
                <option value="read" ${
                  initialData.status === "read" ? "selected" : ""
                }>${i18n.t('bookForm.status.read')}</option>
              </select>
            </div>

            <div class="form-group">
              <label>${i18n.t('bookForm.label.category')}</label>
              <div id="category-tag-input-container"></div>
            </div>

            <!-- Collapsible: Additional Info -->
            <details class="form-section">
              <summary>${i18n.t('bookForm.additionalInfo')}</summary>
              <div class="form-section-content">
                <div class="form-group">
                  <label>${i18n.t('bookForm.label.publisher')}</label>
                  <input type="text" id="input-publisher" class="input-full"
                         value="${initialData.publisher || ""}">
                  ${this.renderDataSourceOptions("publisher")}
                </div>

                <div class="form-group">
                  <label>${i18n.t('bookForm.label.publishDate')}</label>
                  <input type="text" id="input-publish-date" class="input-full"
                         placeholder="YYYY or YYYY-MM-DD" value="${
                           initialData.publishDate || ""
                         }">
                  ${this.renderDataSourceOptions("publishDate")}
                </div>

                <div class="form-group">
                  <label>${i18n.t('bookForm.label.coverUrl')}</label>
                  <input type="url" id="input-cover" class="input-full"
                         value="${initialData.cover || ""}">
                  ${this.renderDataSourceOptions("cover")}
                </div>

                <div class="form-group">
                  <label>${i18n.t('bookForm.label.tags')}</label>
                  <input type="text" id="input-tags" class="input-full"
                         placeholder="${i18n.t('bookForm.tags.placeholder')}"
                         value="${initialData.tags?.join(", ") || ""}">
                </div>
              </div>
            </details>

            <!-- Collapsible: Recommendation & Notes -->
            <details class="form-section" open>
              <summary>${i18n.t('bookForm.label.recommendation')} & ${i18n.t('bookForm.label.notes')}</summary>
              <div class="form-section-content">
                <div class="form-group">
                  <label>${i18n.t('bookForm.label.recommendation')} <small>${i18n.t('bookForm.recommendation.note')}</small></label>
                  <textarea id="input-recommendation" class="textarea-full" rows="3">${
                    initialData.recommendation || ""
                  }</textarea>
                </div>

                <div class="form-group">
                  <label>${i18n.t('bookForm.label.notes')}</label>
                  <textarea id="input-notes" class="textarea-full" rows="4">${
                    initialData.notes || ""
                  }</textarea>
                </div>
              </div>
            </details>

            <!-- Collapsible: External Links -->
            ${
              initialData.isbn || initialData.title
                ? `
              <details class="form-section">
                <summary>${i18n.t('bookForm.externalLinks', { count: 10 })}</summary>
                <div class="form-section-content">
                  <div class="external-links">
                    <h3>${i18n.t('bookForm.externalLinks.search')}</h3>
                    ${this.renderExternalLinks(
                      initialData.isbn || "",
                      initialData.title
                    )}
                  </div>
                </div>
              </details>
            `
                : ""
            }

            <div class="modal-actions">
              <button type="button" class="btn-secondary" id="btn-cancel">${i18n.t('bookForm.button.cancel')}</button>
              <button type="submit" class="btn-primary">${
                isEdit ? i18n.t('bookForm.button.update') : i18n.t('bookForm.button.add')
              }</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById("modal-container")?.appendChild(this.modalElement);
    this.modalElement.style.display = "flex";
    document.body.style.overflow = "hidden";

    this.attachEventListeners();

    // Initialize CategoryTagInput
    const container = this.modalElement.querySelector('#category-tag-input-container');
    if (container) {
      this.categoryTagInput = new CategoryTagInput(initialData.categories || []);
      await this.categoryTagInput.render(container as HTMLElement);
    }
  }

  private getInitialFromSources(): Partial<Book> {
    if (this.dataSources.length === 0) {
      return {
        isbn: this.scannedIsbn,
        categories: [],
        tags: [],
        status: "want",
        recommendation: this.initialRecommendation || undefined,
        notes: "",
      };
    }

    const first = this.dataSources[0];
    return {
      isbn: this.scannedIsbn || first.isbn || "",
      title: first.title || "",
      author: first.author || "",
      publisher: first.publisher,
      publishDate: first.publishDate,
      cover: first.cover,
      categories: [],
      tags: [],
      status: "want",
      recommendation: this.initialRecommendation || undefined,
      notes: "",
    };
  }

  private renderDataSourceOptions(field: keyof BookDataSource): string {
    const sources = this.dataSources.filter((s) => s[field]);

    if (sources.length <= 1) return "";

    return `
      <div class="data-sources">
        <small>Available from:</small>
        ${sources
          .map(
            (s) => `
          <button type="button" class="btn-source" data-field="${field}" data-value="${s[field]}">
            ${s.source}: ${s[field]}
          </button>
        `
          )
          .join("")}
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
        <a href="${links.wechatRead}" target="_blank">微信读书</a>
        <a href="${links.zlibrary}" target="_blank">zlibrary</a>
        <a href="${links.annasArchive}" target="_blank">Anna's Archive</a>
      </div>
    `;
  }

  private attachEventListeners(): void {
    // Close button
    this.modalElement
      ?.querySelector("#btn-close-form")
      ?.addEventListener("click", () => {
        this.hide();
      });

    this.modalElement
      ?.querySelector("#btn-cancel")
      ?.addEventListener("click", () => {
        this.hide();
      });

    // Refresh from API buttons (edit mode only)
    this.modalElement
      ?.querySelector("#btn-refresh-isbn")
      ?.addEventListener("click", async () => {
        await this.handleRefreshFromAPI("isbn");
      });

    this.modalElement
      ?.querySelector("#btn-refresh-title")
      ?.addEventListener("click", async () => {
        await this.handleRefreshFromAPI("title");
      });

    // Enable/disable refresh buttons based on input values
    const isbnInput = this.modalElement?.querySelector(
      "#input-isbn"
    ) as HTMLInputElement;
    const titleInput = this.modalElement?.querySelector(
      "#input-title"
    ) as HTMLInputElement;
    const isbnRefreshBtn = this.modalElement?.querySelector(
      "#btn-refresh-isbn"
    ) as HTMLButtonElement;
    const titleRefreshBtn = this.modalElement?.querySelector(
      "#btn-refresh-title"
    ) as HTMLButtonElement;

    if (isbnInput && isbnRefreshBtn) {
      isbnInput.addEventListener("input", () => {
        isbnRefreshBtn.disabled = !isbnInput.value.trim();
      });
    }

    if (titleInput && titleRefreshBtn) {
      titleInput.addEventListener("input", () => {
        titleRefreshBtn.disabled = !titleInput.value.trim();
      });
    }

    // Data source selection
    this.modalElement?.querySelectorAll(".btn-source").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.target as HTMLButtonElement;
        const field = target.dataset.field!;
        const value = target.dataset.value!;

        const input = this.modalElement?.querySelector(
          `#input-${field
            .toLowerCase()
            .replace(/([A-Z])/g, "-$1")
            .toLowerCase()}`
        ) as HTMLInputElement;
        if (input) {
          input.value = value;
        }
      });
    });

    // Smart paste - rule-based parser only
    this.modalElement
      ?.querySelector("#btn-smart-paste")
      ?.addEventListener("click", async () => {
        const textarea = this.modalElement?.querySelector(
          "#smart-paste-input"
        ) as HTMLTextAreaElement;
        const text = textarea.value;

        if (!text.trim()) return;

        const button = this.modalElement?.querySelector(
          "#btn-smart-paste"
        ) as HTMLButtonElement;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "Parsing...";

        try {
          // Use rule-based parser only
          const parsed = parseSmartPaste(text);

          // Fill form fields
          if (parsed.isbn)
            (
              this.modalElement?.querySelector(
                "#input-isbn"
              ) as HTMLInputElement
            ).value = parsed.isbn;
          if (parsed.title)
            (
              this.modalElement?.querySelector(
                "#input-title"
              ) as HTMLInputElement
            ).value = parsed.title;
          if (parsed.author)
            (
              this.modalElement?.querySelector(
                "#input-author"
              ) as HTMLInputElement
            ).value = parsed.author;
          if (parsed.publisher)
            (
              this.modalElement?.querySelector(
                "#input-publisher"
              ) as HTMLInputElement
            ).value = parsed.publisher;
          if (parsed.publishDate)
            (
              this.modalElement?.querySelector(
                "#input-publish-date"
              ) as HTMLInputElement
            ).value = parsed.publishDate;
          if (parsed.cover)
            (
              this.modalElement?.querySelector(
                "#input-cover"
              ) as HTMLInputElement
            ).value = parsed.cover;
          if (parsed.notes)
            (
              this.modalElement?.querySelector(
                "#input-notes"
              ) as HTMLTextAreaElement
            ).value = parsed.notes;

          // Keep textarea content so user can try LLM parsing
        } catch (error) {
          console.error("Smart paste error:", error);
          alert("Failed to parse book information. Please check the format.");
        } finally {
          button.disabled = false;
          button.textContent = originalText;
        }
      });

    // LLM parse - separate button
    this.modalElement
      ?.querySelector("#btn-llm-parse")
      ?.addEventListener("click", async () => {
        const textarea = this.modalElement?.querySelector(
          "#smart-paste-input"
        ) as HTMLTextAreaElement;
        const text = textarea.value;

        if (!text.trim()) return;

        const button = this.modalElement?.querySelector(
          "#btn-llm-parse"
        ) as HTMLButtonElement;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "Parsing with LLM...";

        try {
          // Use LLM parser
          const parsed = await llmService.parseBookInfo(text);

          if (!parsed) {
            alert(
              "LLM failed to extract book information. Please check the text or your API configuration."
            );
            return;
          }

          // Fill form fields
          if (parsed.isbn)
            (
              this.modalElement?.querySelector(
                "#input-isbn"
              ) as HTMLInputElement
            ).value = parsed.isbn;
          if (parsed.title)
            (
              this.modalElement?.querySelector(
                "#input-title"
              ) as HTMLInputElement
            ).value = parsed.title;
          if (parsed.author)
            (
              this.modalElement?.querySelector(
                "#input-author"
              ) as HTMLInputElement
            ).value = parsed.author;
          if (parsed.publisher)
            (
              this.modalElement?.querySelector(
                "#input-publisher"
              ) as HTMLInputElement
            ).value = parsed.publisher;
          if (parsed.publishDate)
            (
              this.modalElement?.querySelector(
                "#input-publish-date"
              ) as HTMLInputElement
            ).value = parsed.publishDate;
          if (parsed.cover)
            (
              this.modalElement?.querySelector(
                "#input-cover"
              ) as HTMLInputElement
            ).value = parsed.cover;
          if (parsed.notes)
            (
              this.modalElement?.querySelector(
                "#input-notes"
              ) as HTMLTextAreaElement
            ).value = parsed.notes;

          // Keep textarea content so user can try rule-based parsing
        } catch (error) {
          console.error("LLM parse error:", error);
          alert(
            "Failed to parse with LLM. Please check your API configuration."
          );
        } finally {
          button.disabled = false;
          button.textContent = originalText;
        }
      });

    // Manual LLM button
    this.modalElement
      ?.querySelector("#btn-manual-llm")
      ?.addEventListener("click", () => {
        const textarea = this.modalElement?.querySelector(
          "#smart-paste-input"
        ) as HTMLTextAreaElement;
        const text = textarea.value.trim();

        const helper = new ManualLLMHelper({
          title: "📱 Smart Paste with Your LLM App",
          description:
            "Use ChatGPT, Claude, or any LLM app you already have to parse book information without API keys.",
          systemPrompt: MANUAL_LLM_PROMPTS.smartPaste.system,
          userPromptTemplate: MANUAL_LLM_PROMPTS.smartPaste.user,
          onResult: (result) => {
            if (Array.isArray(result)) {
              // Shouldn't happen for single book, but handle it
              result = result[0];
            }
            const parsed = result;

            // Fill form fields
            if (parsed.isbn)
              (
                this.modalElement?.querySelector(
                  "#input-isbn"
                ) as HTMLInputElement
              ).value = parsed.isbn;
            if (parsed.title)
              (
                this.modalElement?.querySelector(
                  "#input-title"
                ) as HTMLInputElement
              ).value = parsed.title;
            if (parsed.author)
              (
                this.modalElement?.querySelector(
                  "#input-author"
                ) as HTMLInputElement
              ).value = parsed.author;
            if (parsed.publisher)
              (
                this.modalElement?.querySelector(
                  "#input-publisher"
                ) as HTMLInputElement
              ).value = parsed.publisher;
            if (parsed.publishDate)
              (
                this.modalElement?.querySelector(
                  "#input-publish-date"
                ) as HTMLInputElement
              ).value = parsed.publishDate;
            if (parsed.cover)
              (
                this.modalElement?.querySelector(
                  "#input-cover"
                ) as HTMLInputElement
              ).value = parsed.cover;
            if (parsed.notes)
              (
                this.modalElement?.querySelector(
                  "#input-notes"
                ) as HTMLTextAreaElement
              ).value = parsed.notes;
          },
        });

        helper.show(text || undefined);
      });

    // Search by title button (when ISBN fails)
    this.modalElement
      ?.querySelector("#btn-search-by-title")
      ?.addEventListener("click", () => {
        if (this.onTitleSearchRequest) {
          this.hide();
          this.onTitleSearchRequest();
        }
      });

    // Form submit
    this.modalElement
      ?.querySelector("#book-form")
      ?.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleSubmit();
      });

    // Modal background click
    this.modalElement?.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).classList.contains("modal")) {
        this.hide();
      }
    });
  }

  private async handleSubmit(): Promise<void> {
    const form = this.modalElement?.querySelector(
      "#book-form"
    ) as HTMLFormElement;

    const isbn = (
      form.querySelector("#input-isbn") as HTMLInputElement
    ).value.trim();
    const title = (
      form.querySelector("#input-title") as HTMLInputElement
    ).value.trim();
    const author = (
      form.querySelector("#input-author") as HTMLInputElement
    ).value.trim();
    const publisher = (
      form.querySelector("#input-publisher") as HTMLInputElement
    ).value.trim();
    const publishDate = (
      form.querySelector("#input-publish-date") as HTMLInputElement
    ).value.trim();
    const cover = (
      form.querySelector("#input-cover") as HTMLInputElement
    ).value.trim();
    const status = (form.querySelector("#input-status") as HTMLSelectElement)
      .value as Book["status"];
    const recommendation = (
      form.querySelector("#input-recommendation") as HTMLTextAreaElement
    ).value.trim();
    const notes = (
      form.querySelector("#input-notes") as HTMLTextAreaElement
    ).value.trim();

    // Get categories from CategoryTagInput
    const categories = this.categoryTagInput?.getSelectedCategories() || [];

    // Touch all selected categories to update their lastUsedAt
    for (const category of categories) {
      await storage.touchCategory(category);
    }

    const tagsInput = (
      form.querySelector("#input-tags") as HTMLInputElement
    ).value.trim();
    const tags = tagsInput
      ? tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t)
      : [];

    if (this.book) {
      // Update existing book
      await storage.updateBook(this.book.id, {
        title,
        author,
        publisher: publisher || undefined,
        publishDate: publishDate || undefined,
        cover: cover || undefined,
        categories,
        tags,
        status,
        recommendation: recommendation || undefined,
        notes,
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
        recommendation: recommendation || undefined,
        notes,
        addedAt: Date.now(),
        updatedAt: Date.now(),
        source: this.dataSources.map((s) => s.source),
      };

      await storage.addBook(newBook);
    }

    this.hide();
    this.onSave();
  }

  private async handleRefreshFromAPI(method: "isbn" | "title"): Promise<void> {
    if (!this.book) return;

    // Get current value from form input (may be updated but not yet saved)
    const query =
      method === "isbn"
        ? (this.modalElement?.querySelector("#input-isbn") as HTMLInputElement)
            ?.value || this.book.isbn
        : (this.modalElement?.querySelector("#input-title") as HTMLInputElement)
            ?.value || this.book.title;

    if (!query) return;

    try {
      // Show loading state
      const button = this.modalElement?.querySelector(
        `#btn-refresh-${method}`
      ) as HTMLButtonElement;
      if (!button) return;

      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = "⏳ Loading...";

      // Fetch data from API
      let results: BookDataSource[] = [];
      if (method === "isbn") {
        results = await aggregateBookData(query);
      } else {
        results = await searchBookByTitle(query);
      }

      button.disabled = false;
      button.textContent = originalText;

      if (results.length === 0) {
        alert(`No results found for ${method}: ${query}`);
        return;
      }

      // Store results and show selection UI
      this.dataSources = results;
      this.showRefreshSelectionUI(results);
    } catch (error) {
      console.error("Failed to fetch from API:", error);

      // Restore button state
      const button = this.modalElement?.querySelector(
        `#btn-refresh-${method}`
      ) as HTMLButtonElement;
      if (button) {
        button.disabled = false;
        button.textContent =
          method === "isbn" ? "🔄 Refresh by ISBN" : "🔄 Refresh by Title";
      }

      // Show detailed error message
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("403") || errorMessage.includes("quota")) {
        alert(
          "API quota exceeded or permission denied.\n\nPossible solutions:\n1. Wait a few minutes and try again\n2. Check your API key configuration in Settings\n3. Try using a different API key"
        );
      } else if (errorMessage.includes("401")) {
        alert(
          "API authentication failed.\n\nPlease check your API key in Settings."
        );
      } else {
        alert(
          `Failed to fetch data from API.\n\nError: ${errorMessage}\n\nPlease try again or check your network connection.`
        );
      }
    }
  }

  private showRefreshSelectionUI(results: BookDataSource[]): void {
    if (!this.modalElement) return;

    // Create a modal overlay for field selection
    const selectionModal = document.createElement("div");
    selectionModal.className = "modal";
    selectionModal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Update Book Metadata</h2>
          <button class="btn-close" id="btn-close-selection">&times;</button>
        </div>
        <div class="modal-body">
          <div class="info-box">
            <p>Found ${results.length} result(s). Select fields to update:</p>
          </div>

          <form id="refresh-selection-form">
            ${this.renderRefreshField("isbn", results)}
            ${this.renderRefreshField("title", results)}
            ${this.renderRefreshField("author", results)}
            ${this.renderRefreshField("publisher", results)}
            ${this.renderRefreshField("publishDate", results)}
            ${this.renderRefreshField("cover", results)}
          </form>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="btn-cancel-refresh">Cancel</button>
          <button type="button" class="btn-primary" id="btn-apply-refresh">Apply Updates</button>
        </div>
      </div>
    `;

    document.body.appendChild(selectionModal);
    selectionModal.style.display = "flex";

    // Event listeners
    selectionModal
      .querySelector("#btn-close-selection")
      ?.addEventListener("click", () => {
        selectionModal.remove();
      });

    selectionModal
      .querySelector("#btn-cancel-refresh")
      ?.addEventListener("click", () => {
        selectionModal.remove();
      });

    selectionModal
      .querySelector("#btn-apply-refresh")
      ?.addEventListener("click", () => {
        this.applyRefreshUpdates(selectionModal);
        selectionModal.remove();
      });
  }

  private renderRefreshField(
    field: keyof BookDataSource,
    results: BookDataSource[]
  ): string {
    // Map to include original index, then filter
    const sources = results
      .map((s, index) => ({ data: s, index }))
      .filter((item) => item.data[field]);

    if (sources.length === 0) return "";

    const currentValue = this.book?.[field as keyof Book] || "";

    // Format field name for display
    const fieldLabel =
      field === "isbn"
        ? "ISBN"
        : field === "publishDate"
        ? "Publish Date"
        : field.charAt(0).toUpperCase() + field.slice(1);

    return `
      <div class="form-group">
        <label>${fieldLabel}</label>
        <div class="radio-group">
          <label>
            <input type="radio" name="refresh-${field}" value="keep" checked>
            Keep current: <strong>${currentValue || "(empty)"}</strong>
          </label>
          ${sources
            .map(
              (item) => `
            <label>
              <input type="radio" name="refresh-${field}" value="${item.index}">
              Update to: <strong>${item.data[field]}</strong> <span class="hint-text">(${item.data.source})</span>
            </label>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  private applyRefreshUpdates(selectionModal: HTMLElement): void {
    if (!this.modalElement || !this.book) {
      console.error("Missing modalElement or book");
      return;
    }

    const fields: (keyof BookDataSource)[] = [
      "isbn",
      "title",
      "author",
      "publisher",
      "publishDate",
      "cover",
    ];

    fields.forEach((field) => {
      const selector = `input[name="refresh-${field}"]:checked`;
      const selected = selectionModal.querySelector<HTMLInputElement>(selector);

      if (selected && selected.value !== "keep") {
        const sourceIndex = parseInt(selected.value);
        const newValue = this.dataSources[sourceIndex]?.[field];

        if (newValue) {
          // Convert field name to input ID (e.g., 'publishDate' -> 'publish-date', 'isbn' -> 'isbn')
          const inputId = `#input-${field
            .replace(/([A-Z])/g, "-$1")
            .toLowerCase()}`;
          const input = this.modalElement?.querySelector(
            inputId
          ) as HTMLInputElement;

          if (input) {
            // Temporarily remove readonly for ISBN field
            const wasReadonly = input.readOnly;
            if (wasReadonly) input.readOnly = false;
            input.value = newValue;
            // Trigger change event to ensure any listeners update
            input.dispatchEvent(new Event("change"));
            input.dispatchEvent(new Event("input"));
            if (wasReadonly) input.readOnly = true;
          }
        }
      }
    });

    alert('Fields updated! Click "Update" to save changes.');
  }

  hide(): void {
    if (this.modalElement) {
      this.categoryTagInput?.destroy();
      this.categoryTagInput = null;
      this.modalElement.remove();
      this.modalElement = null;
    }
    document.body.style.overflow = "";
  }
}
