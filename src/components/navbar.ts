import { BookListManagerModal } from './book-list-manager-modal';
import { CategoryManagerModal } from './category-manager-modal';
import { DataManagementModal } from './data-management-modal';
import { VisionUploadModal } from './vision-upload-modal';
import { exportBookLists } from '../modules/book-list-export';
import { exportAsCSV, exportAsMarkdown, downloadFile } from '../modules/export';
import { i18n } from '../modules/i18n';
import { storage } from '../modules/storage';

export class Navbar {
  private element: HTMLElement;
  private onDataChange?: () => void | Promise<void>;
  private initPromise: Promise<void>;
  private categoryManagerModal?: CategoryManagerModal;
  private bookListManagerModal?: BookListManagerModal;
  private dataManagementModal?: DataManagementModal;
  private onBookListChange?: (bookListId: string | null) => void;
  private activeBookListId: string | null = null;

  constructor(containerId: string, onDataChange?: () => void | Promise<void>) {
    this.element = document.getElementById(containerId)!;
    this.onDataChange = onDataChange;
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    await this.render();
    this.attachEventListeners();
  }

  async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  private async render(): Promise<void> {
    const currentLocale = i18n.getLocale();
    const bookLists = await storage.getBookLists();

    this.element.innerHTML = `
      <div class="navbar">
        <div class="navbar-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span>${i18n.t('navbar.title')}</span>
        </div>
        <div class="navbar-center">
          <select id="booklist-selector" class="booklist-selector">
            <option value="">${i18n.t('bookListSelector.allBooks')}</option>
            ${bookLists
              .map(
                (list) => `
              <option value="${list.id}" ${list.id === this.activeBookListId ? 'selected' : ''}>
                📚 ${this.escapeHtml(list.name)}
              </option>
            `
              )
              .join('')}
          </select>
          ${
            this.activeBookListId
              ? `
            <button id="btn-export-current-list" class="btn-icon" title="${i18n.t('navbar.exportCurrentList')}" aria-label="${i18n.t('navbar.exportCurrentList')}">
              ${i18n.t('bookListManager.export')}
            </button>
          `
              : ''
          }
        </div>
        <div class="navbar-actions">
          <button id="btn-menu" class="btn-icon" aria-label="${i18n.t('navbar.menu')}">
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
            <h2>${i18n.t('navbar.menu')}</h2>
            <button class="btn-close" id="btn-close-menu" aria-label="${i18n.t('navbar.menu.close')}">&times;</button>
          </div>
          <div class="modal-body">
            <div class="menu-section">
              <h3>${i18n.t('navbar.menu.dataManagement')}</h3>
              <button id="btn-backup-restore" class="btn-full">${i18n.t('navbar.menu.backupRestore')}</button>
              <button id="btn-export-csv" class="btn-full">${i18n.t('navbar.menu.exportCSV')}</button>
              <button id="btn-export-md" class="btn-full">${i18n.t('navbar.menu.exportMarkdown')}</button>
            </div>

            <div class="menu-section">
              <h3>${i18n.t('navbar.menu.addBooks')}</h3>
              <button id="btn-vision-upload" class="btn-full">${i18n.t('navbar.menu.addFromImage')}</button>
            </div>

            <div class="menu-section">
              <h3>${i18n.t('navbar.menu.settings')}</h3>
              <button id="btn-api-key" class="btn-full">${i18n.t('navbar.menu.apiKeys')}</button>
              <button id="btn-manage-categories" class="btn-full">${i18n.t('navbar.menu.manageCategories')}</button>
              <button id="btn-manage-booklists" class="btn-full">${i18n.t('navbar.menu.manageBookLists')}</button>
            </div>

            <div class="menu-section">
              <h3>${i18n.t('navbar.menu.language')}</h3>
              <select id="language-selector" class="input-full">
                <option value="en" ${currentLocale === 'en' ? 'selected' : ''}>English</option>
                <option value="zh-CN" ${currentLocale === 'zh-CN' ? 'selected' : ''}>简体中文</option>
              </select>
            </div>

            <div class="menu-section">
              <h3>${i18n.t('navbar.menu.dangerZone')}</h3>
              <button id="btn-clear-data" class="btn-full btn-danger">${i18n.t('navbar.menu.clearData')}</button>
            </div>
          </div>
        </div>
      </div>

      <div id="api-key-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h2>${i18n.t('apiKeys.title')}</h2>
            <button class="btn-close" id="btn-close-api-key" aria-label="${i18n.t('common.close')}">&times;</button>
          </div>
          <div class="modal-body">
            <div class="api-key-section">
              <h3>${i18n.t('apiKeys.google.title')}</h3>
              <p class="help-text">
                ${i18n.t('apiKeys.google.help')}
                <a href="https://console.cloud.google.com/apis/library/books.googleapis.com" target="_blank">${i18n.t('apiKeys.google.getKey')}</a>
              </p>
              <input type="text" id="input-google-api-key" class="input-full"
                     placeholder="Enter Google Books API key"
                     value="${(await storage.getGoogleBooksApiKey()) || ''}">">
            </div>

            <div class="api-key-section">
              <h3>${i18n.t('apiKeys.isbndb.title')}</h3>
              <p class="help-text">
                ${i18n.t('apiKeys.isbndb.help')}
                <a href="https://isbndb.com/apidocs/v2" target="_blank">${i18n.t('apiKeys.google.getKey')}</a>
              </p>
              <input type="text" id="input-isbndb-api-key" class="input-full"
                     placeholder="Enter ISBNdb API key (optional)"
                     value="${(await storage.getISBNdbApiKey()) || ''}">">
            </div>

            <div class="api-key-section">
              <h3>${i18n.t('apiKeys.llm.title')}</h3>
              <p class="help-text">
                ${i18n.t('apiKeys.llm.help')}
                <br>
                <a href="https://platform.openai.com/api-keys" target="_blank">Get OpenAI Key</a> |
                <a href="https://platform.deepseek.com/api_keys" target="_blank">Get DeepSeek Key</a>
              </p>
              <label>${i18n.t('apiKeys.llm.endpoint')}</label>
              <input type="text" id="input-llm-endpoint" class="input-full"
                     placeholder="${i18n.t('apiKeys.llm.endpointPlaceholder')}"
                     value="${(await storage.getLLMApiEndpoint()) || ''}">">
              <label>${i18n.t('apiKeys.llm.key')}</label>
              <input type="text" id="input-llm-key" class="input-full"
                     placeholder="${i18n.t('apiKeys.llm.keyPlaceholder')}"
                     value="${(await storage.getLLMApiKey()) || ''}">">
              <label>${i18n.t('apiKeys.llm.model')}</label>
              <input type="text" id="input-llm-model" class="input-full"
                     placeholder="${i18n.t('apiKeys.llm.modelPlaceholder')}"
                     value="${(await storage.getLLMModel()) || ''}">">
            </div>

            <div class="api-key-section">
              <h3>${i18n.t('apiKeys.llmText.title')}</h3>
              <p class="help-text">
                ${i18n.t('apiKeys.llmText.help')}
                <br>
                <strong>${i18n.t('apiKeys.llmText.budget')}</strong>
              </p>
              <label>${i18n.t('apiKeys.llmText.endpointOptional')}</label>
              <input type="text" id="input-llm-text-endpoint" class="input-full"
                     placeholder="${i18n.t('apiKeys.llm.endpointPlaceholder')}"
                     value="${(await storage.getLLMTextApiEndpoint()) || ''}">">
              <label>${i18n.t('apiKeys.llmText.keyOptional')}</label>
              <input type="text" id="input-llm-text-key" class="input-full"
                     placeholder="${i18n.t('apiKeys.llm.keyPlaceholder')}"
                     value="${(await storage.getLLMTextApiKey()) || ''}">">
              <label>${i18n.t('apiKeys.llmText.modelOptional')}</label>
              <input type="text" id="input-llm-text-model" class="input-full"
                     placeholder="${i18n.t('apiKeys.llm.modelPlaceholder')}"
                     value="${(await storage.getLLMTextModel()) || ''}">">
            </div>

            <div class="help-box">
              <strong>${i18n.t('apiKeys.freeAPIs')}</strong>
              <ul>
                <li>${i18n.t('apiKeys.freeAPI.openLibrary')}</li>
                <li>${i18n.t('apiKeys.freeAPI.internetArchive')}</li>
                <li>${i18n.t('apiKeys.freeAPI.crossref')}</li>
              </ul>
            </div>

            <div class="modal-actions">
              <button id="btn-save-api-keys" class="btn-primary">${i18n.t('apiKeys.save')}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    // Book list selector
    const selectorElement = document.getElementById('booklist-selector');
    console.log('[Navbar] Book list selector element:', selectorElement);
    selectorElement?.addEventListener('change', (e) => {
      void (async () => {
        const value = (e.target as HTMLSelectElement).value;
        console.log('[Navbar] Book list selector changed to:', value);
        this.activeBookListId = value || null;

        // Re-render navbar to show/hide export button
        await this.render();
        this.attachEventListeners();

        if (this.onBookListChange) {
          this.onBookListChange(this.activeBookListId);
        }
      })();
    });

    // Export current book list button
    document.getElementById('btn-export-current-list')?.addEventListener('click', () => {
      void (async () => {
        if (this.activeBookListId) {
          try {
            await exportBookLists([this.activeBookListId]);
          } catch (error) {
            console.error('Export current list failed:', error);
            alert(i18n.t('bookListManager.exportError'));
          }
        }
      })();
    });

    // Menu toggle
    document.getElementById('btn-menu')?.addEventListener('click', () => {
      this.showModal('menu-modal');
    });

    document.getElementById('btn-close-menu')?.addEventListener('click', () => {
      this.hideModal('menu-modal');
    });

    document.getElementById('btn-backup-restore')?.addEventListener('click', () => {
      this.hideModal('menu-modal');
      if (!this.dataManagementModal) {
        this.dataManagementModal = new DataManagementModal();
      }
      this.dataManagementModal.show();
    });

    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      void (async () => {
        const csv = await exportAsCSV();
        downloadFile(csv, `books-${Date.now()}.csv`, 'text/csv');
        this.hideModal('menu-modal');
      })();
    });

    document.getElementById('btn-export-md')?.addEventListener('click', () => {
      void (async () => {
        const md = await exportAsMarkdown();
        downloadFile(md, `books-${Date.now()}.md`, 'text/markdown');
        this.hideModal('menu-modal');
      })();
    });

    // Vision Upload
    document.getElementById('btn-vision-upload')?.addEventListener('click', () => {
      this.hideModal('menu-modal');
      const visionModal = new VisionUploadModal(() => {
        void this.onDataChange?.();
      });
      void visionModal.show();
    });

    // API Key
    document.getElementById('btn-api-key')?.addEventListener('click', () => {
      this.hideModal('menu-modal');
      this.showModal('api-key-modal');
    });

    document.getElementById('btn-close-api-key')?.addEventListener('click', () => {
      this.hideModal('api-key-modal');
    });

    // Category Manager
    document.getElementById('btn-manage-categories')?.addEventListener('click', () => {
      this.hideModal('menu-modal');
      // Always create a new instance to ensure callbacks are fresh
      this.categoryManagerModal = new CategoryManagerModal(
        () => {
          // Refresh data when category manager closes
          void this.onDataChange?.();
        },
        () => {
          // Refresh data immediately when categories are changed (e.g., after deletion)
          void this.onDataChange?.();
        }
      );
      void this.categoryManagerModal.show();
    });

    // Book List Manager
    const manageBtnElement = document.getElementById('btn-manage-booklists');
    console.log('[Navbar] Manage book lists button element:', manageBtnElement);
    manageBtnElement?.addEventListener('click', () => {
      console.log('[Navbar] Manage book lists button clicked');
      this.hideModal('menu-modal');
      this.bookListManagerModal = new BookListManagerModal(() => {
        void (async () => {
          console.log('[Navbar] Book list manager callback triggered');
          await this.render();
          this.attachEventListeners();
          if (this.onDataChange) {
            await this.onDataChange();
          }
        })();
      });
      console.log('[Navbar] Opening book list manager modal');
      void this.bookListManagerModal.open();
    });

    // Language switcher
    document.getElementById('language-selector')?.addEventListener('change', (e) => {
      const newLocale = (e.target as HTMLSelectElement).value as 'en' | 'zh-CN';
      i18n.setLocale(newLocale);
      // Show notification to refresh page
      alert(i18n.t('navbar.menu.languageChanged'));
    });

    document.getElementById('btn-save-api-keys')?.addEventListener('click', () => {
      void (async () => {
        const googleInput = document.getElementById('input-google-api-key') as HTMLInputElement;
        const isbndbInput = document.getElementById('input-isbndb-api-key') as HTMLInputElement;
        const llmEndpointInput = document.getElementById('input-llm-endpoint') as HTMLInputElement;
        const llmKeyInput = document.getElementById('input-llm-key') as HTMLInputElement;
        const llmModelInput = document.getElementById('input-llm-model') as HTMLInputElement;
        const llmTextEndpointInput = document.getElementById(
          'input-llm-text-endpoint'
        ) as HTMLInputElement;
        const llmTextKeyInput = document.getElementById('input-llm-text-key') as HTMLInputElement;
        const llmTextModelInput = document.getElementById(
          'input-llm-text-model'
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
          await storage.setGoogleBooksApiKey(googleKey);
        }

        if (isbndbKey) {
          await storage.setISBNdbApiKey(isbndbKey);
        }

        if (llmEndpoint) {
          await storage.setLLMApiEndpoint(llmEndpoint);
        }

        if (llmKey) {
          await storage.setLLMApiKey(llmKey);
        }

        if (llmModel) {
          await storage.setLLMModel(llmModel);
        }

        if (llmTextEndpoint) {
          await storage.setLLMTextApiEndpoint(llmTextEndpoint);
        }

        if (llmTextKey) {
          await storage.setLLMTextApiKey(llmTextKey);
        }

        if (llmTextModel) {
          await storage.setLLMTextModel(llmTextModel);
        }

        alert(i18n.t('apiKeys.saved'));
        this.hideModal('api-key-modal');
      })();
    });

    // Clear data
    document.getElementById('btn-clear-data')?.addEventListener('click', () => {
      if (confirm(i18n.t('confirm.clearData'))) {
        void storage.clear();
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

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setBookListChangeHandler(handler: (bookListId: string | null) => void): void {
    this.onBookListChange = handler;
  }

  setActiveBookList(bookListId: string | null): void {
    this.activeBookListId = bookListId;
    const selector = document.getElementById('booklist-selector') as HTMLSelectElement | null;
    if (selector) {
      selector.value = bookListId || '';
    }
  }

  getActiveBookListId(): string | null {
    return this.activeBookListId;
  }

  async refreshBookListSelector(): Promise<void> {
    await this.render();
    this.attachEventListeners();
  }
}
