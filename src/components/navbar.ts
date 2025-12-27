import { storage } from '../modules/storage';
import { exportAsJSON, exportAsCSV, exportAsMarkdown, downloadFile } from '../modules/export';
import { importFromJSON } from '../modules/import';
import { VisionUploadModal } from './vision-upload-modal';

export class Navbar {
  private element: HTMLElement;
  private onDataChange?: () => void;

  constructor(containerId: string, onDataChange?: () => void) {
    this.element = document.getElementById(containerId)!;
    this.onDataChange = onDataChange;
    this.render();
    this.attachEventListeners();
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="navbar">
        <div class="navbar-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span>Book Scanner</span>
        </div>
        <div class="navbar-actions">
          <button id="btn-menu" class="btn-icon" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <div id="menu-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Menu</h2>
            <button class="btn-close" id="btn-close-menu" aria-label="Close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="menu-section">
              <h3>Data Management</h3>
              <button id="btn-export-json" class="btn-full">Export as JSON</button>
              <button id="btn-export-csv" class="btn-full">Export as CSV</button>
              <button id="btn-export-md" class="btn-full">Export as Markdown</button>
              <button id="btn-import" class="btn-full">Import JSON</button>
              <input type="file" id="file-import" accept=".json" style="display: none;">
            </div>

            <div class="menu-section">
              <h3>Add Books</h3>
              <button id="btn-vision-upload" class="btn-full">📸 Add from Image (Vision)</button>
            </div>

            <div class="menu-section">
              <h3>Settings</h3>
              <button id="btn-api-key" class="btn-full">API Keys Settings</button>
            </div>

            <div class="menu-section">
              <h3>Danger Zone</h3>
              <button id="btn-clear-data" class="btn-full btn-danger">Clear All Data</button>
            </div>
          </div>
        </div>
      </div>

      <div id="api-key-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h2>API Keys Settings</h2>
            <button class="btn-close" id="btn-close-api-key" aria-label="Close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="api-key-section">
              <h3>Google Books API</h3>
              <p class="help-text">
                Free API with quota limits. Required for most book lookups.
                <a href="https://console.cloud.google.com/apis/library/books.googleapis.com" target="_blank">Get API Key →</a>
              </p>
              <input type="text" id="input-google-api-key" class="input-full"
                     placeholder="Enter Google Books API key"
                     value="${storage.getGoogleBooksApiKey() || ""}">
            </div>

            <div class="api-key-section">
              <h3>ISBNdb API (Optional)</h3>
              <p class="help-text">
                Enhanced book data coverage. Requires paid subscription.
                <a href="https://isbndb.com/apidocs/v2" target="_blank">Get API Key →</a>
              </p>
              <input type="text" id="input-isbndb-api-key" class="input-full"
                     placeholder="Enter ISBNdb API key (optional)"
                     value="${storage.getISBNdbApiKey() || ""}">
            </div>

            <div class="api-key-section">
              <h3>LLM Vision API (Optional)</h3>
              <p class="help-text">
                For Vision-based book extraction from images. Requires vision-capable models.
                <br>
                <strong>Recommended:</strong> gpt-4o, gpt-4o-mini (OpenAI) or deepseek-chat (DeepSeek)
                <br>
                <a href="https://platform.openai.com/api-keys" target="_blank">Get OpenAI Key</a> |
                <a href="https://platform.deepseek.com/api_keys" target="_blank">Get DeepSeek Key</a>
              </p>
              <label>API Endpoint:</label>
              <input type="text" id="input-llm-endpoint" class="input-full"
                     placeholder="https://api.openai.com/v1/chat/completions"
                     value="${storage.getLLMApiEndpoint() || ""}">
              <label>API Key:</label>
              <input type="text" id="input-llm-key" class="input-full"
                     placeholder="sk-..."
                     value="${storage.getLLMApiKey() || ""}">
              <label>Model:</label>
              <input type="text" id="input-llm-model" class="input-full"
                     placeholder="gpt-4o-mini"
                     value="${storage.getLLMModel() || ""}">
            </div>

            <div class="api-key-section">
              <h3>LLM Text API (Optional)</h3>
              <p class="help-text">
                For Smart Paste text parsing only. Use a cheaper model to save costs.
                <br>
                <strong>Budget-friendly:</strong> gpt-4o-mini, deepseek-chat, or leave empty to use Vision API
              </p>
              <label>API Endpoint (optional, fallback to Vision API if empty):</label>
              <input type="text" id="input-llm-text-endpoint" class="input-full"
                     placeholder="https://api.openai.com/v1/chat/completions"
                     value="${storage.getLLMTextApiEndpoint() || ""}">
              <label>API Key (optional):</label>
              <input type="text" id="input-llm-text-key" class="input-full"
                     placeholder="sk-..."
                     value="${storage.getLLMTextApiKey() || ""}">
              <label>Model (optional):</label>
              <input type="text" id="input-llm-text-model" class="input-full"
                     placeholder="gpt-4o-mini"
                     value="${storage.getLLMTextModel() || ""}">
            </div>

            <div class="help-box">
              <strong>Free APIs (no key required):</strong>
              <ul>
                <li>Open Library - General books database</li>
                <li>Internet Archive - Large collection including rare books</li>
                <li>Crossref - Academic publications and textbooks</li>
              </ul>
            </div>

            <div class="modal-actions">
              <button id="btn-save-api-keys" class="btn-primary">Save All Keys</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    // Menu toggle
    document.getElementById('btn-menu')?.addEventListener('click', () => {
      this.showModal('menu-modal');
    });

    document.getElementById('btn-close-menu')?.addEventListener('click', () => {
      this.hideModal('menu-modal');
    });

    // Export
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      const json = exportAsJSON();
      downloadFile(json, `books-${Date.now()}.json`, 'application/json');
      this.hideModal('menu-modal');
    });

    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      const csv = exportAsCSV();
      downloadFile(csv, `books-${Date.now()}.csv`, 'text/csv');
      this.hideModal('menu-modal');
    });

    document.getElementById('btn-export-md')?.addEventListener('click', () => {
      const md = exportAsMarkdown();
      downloadFile(md, `books-${Date.now()}.md`, 'text/markdown');
      this.hideModal('menu-modal');
    });

    // Import
    document.getElementById('btn-import')?.addEventListener('click', () => {
      document.getElementById('file-import')?.click();
    });

    document.getElementById('file-import')?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const result = await importFromJSON(file, 'merge');
      alert(result.message);

      if (result.success) {
        window.location.reload();
      }
    });

    // Vision Upload
    document.getElementById('btn-vision-upload')?.addEventListener('click', () => {
      this.hideModal('menu-modal');
      const visionModal = new VisionUploadModal(() => {
        if (this.onDataChange) {
          this.onDataChange();
        }
      });
      visionModal.show();
    });

    // API Key
    document.getElementById('btn-api-key')?.addEventListener('click', () => {
      this.hideModal('menu-modal');
      this.showModal('api-key-modal');
    });

    document.getElementById('btn-close-api-key')?.addEventListener('click', () => {
      this.hideModal('api-key-modal');
    });

    document
      .getElementById("btn-save-api-keys")
      ?.addEventListener("click", () => {
        const googleInput = document.getElementById(
          "input-google-api-key"
        ) as HTMLInputElement;
        const isbndbInput = document.getElementById(
          "input-isbndb-api-key"
        ) as HTMLInputElement;
        const llmEndpointInput = document.getElementById(
          "input-llm-endpoint"
        ) as HTMLInputElement;
        const llmKeyInput = document.getElementById(
          "input-llm-key"
        ) as HTMLInputElement;
        const llmModelInput = document.getElementById(
          "input-llm-model"
        ) as HTMLInputElement;
        const llmTextEndpointInput = document.getElementById(
          "input-llm-text-endpoint"
        ) as HTMLInputElement;
        const llmTextKeyInput = document.getElementById(
          "input-llm-text-key"
        ) as HTMLInputElement;
        const llmTextModelInput = document.getElementById(
          "input-llm-text-model"
        ) as HTMLInputElement;

        const googleKey = googleInput.value.trim();
        const isbndbKey = isbndbInput.value.trim();
        const llmEndpoint = llmEndpointInput.value.trim();
        const llmKey = llmKeyInput.value.trim();
        const llmModel = llmModelInput.value.trim();
        const llmTextEndpoint = llmTextEndpointInput.value.trim();
        const llmTextKey = llmTextKeyInput.value.trim();
        const llmTextModel = llmTextModelInput.value.trim();

        if (googleKey) {
          storage.setGoogleBooksApiKey(googleKey);
        }

        if (isbndbKey) {
          storage.setISBNdbApiKey(isbndbKey);
        }

        if (llmEndpoint) {
          storage.setLLMApiEndpoint(llmEndpoint);
        }

        if (llmKey) {
          storage.setLLMApiKey(llmKey);
        }

        if (llmModel) {
          storage.setLLMModel(llmModel);
        }

        if (llmTextEndpoint) {
          storage.setLLMTextApiEndpoint(llmTextEndpoint);
        }

        if (llmTextKey) {
          storage.setLLMTextApiKey(llmTextKey);
        }

        if (llmTextModel) {
          storage.setLLMTextModel(llmTextModel);
        }

        alert("API keys saved successfully!");
        this.hideModal("api-key-modal");
      });

    // Clear data
    document.getElementById('btn-clear-data')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to delete all data? This action cannot be undone.')) {
        storage.clear();
        this.hideModal('menu-modal');
        window.location.reload();
      }
    });

    // Close modals on background click
    document.getElementById('menu-modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) {
        this.hideModal('menu-modal');
      }
    });

    document.getElementById('api-key-modal')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) {
        this.hideModal('api-key-modal');
      }
    });
  }

  private showModal(id: string): void {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  private hideModal(id: string): void {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }
}
