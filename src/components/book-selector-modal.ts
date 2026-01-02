import { i18n } from '../modules/i18n';
import type { BookDataSource } from '../types';

export class BookSelectorModal {
  private modal: HTMLElement;
  private results: BookDataSource[] = [];
  private onSelect?: (result: BookDataSource) => void;

  constructor() {
    this.modal = this.createModal();
    document.body.appendChild(this.modal);
    this.attachEventListeners();
  }

  private createModal(): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'book-selector-modal';
    modal.innerHTML = `
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>${i18n.t('selector.title')}</h2>
          <button class="btn-close" id="selector-close">&times;</button>
        </div>
        <div class="modal-body">
          <div id="selector-loading" class="loading-message" style="display: none;">
            <p>${i18n.t('selector.loading')}</p>
          </div>
          <div id="selector-results" class="selector-results"></div>
          <div id="selector-empty" class="empty-message" style="display: none;">
            <p>${i18n.t('selector.empty')}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button id="selector-cancel" class="btn btn-secondary">${i18n.t('selector.button.cancel')}</button>
        </div>
      </div>
    `;
    return modal;
  }

  private attachEventListeners(): void {
    // Close button
    this.modal.querySelector('#selector-close')?.addEventListener('click', () => this.close());

    // Cancel button
    this.modal.querySelector('#selector-cancel')?.addEventListener('click', () => this.close());

    // Close on backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
  }

  private renderResults(): void {
    const resultsContainer = this.modal.querySelector('#selector-results') as HTMLElement;

    if (this.results.length === 0) {
      resultsContainer.innerHTML = '';
      return;
    }

    resultsContainer.innerHTML = this.results
      .map(
        (result, index) => `
      <div class="selector-item" data-index="${index}">
        <div class="selector-item-cover">
          ${
            result.cover
              ? `<img src="${result.cover}" alt="${result.title}">`
              : '<div class="no-cover">No Cover</div>'
          }
        </div>
        <div class="selector-item-info">
          <h3>${result.title}</h3>
          <p class="author">${result.author || 'Unknown Author'}</p>
          ${result.publisher ? `<p class="publisher">${result.publisher}</p>` : ''}
          ${result.publishDate ? `<p class="date">${result.publishDate}</p>` : ''}
          ${result.isbn ? `<p class="isbn">ISBN: ${result.isbn}</p>` : ''}
          <p class="source">Source: ${result.source}</p>
        </div>
        <div class="selector-item-action">
          <button class="btn btn-primary btn-select" data-index="${index}">${i18n.t('selector.button.select')}</button>
        </div>
      </div>
    `
      )
      .join('');

    // Attach click handlers to select buttons
    resultsContainer.querySelectorAll('.btn-select').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const index = parseInt((e.target as HTMLElement).dataset.index || '0');
        this.handleSelect(index);
      });
    });
  }

  private handleSelect(index: number): void {
    const selected = this.results[index];
    if (selected && this.onSelect) {
      this.onSelect(selected);
    }
    this.close();
  }

  async open(results: BookDataSource[], onSelect: (result: BookDataSource) => void): Promise<void> {
    this.results = results;
    this.onSelect = onSelect;

    // Show modal
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Show/hide elements based on results
    const loadingEl = this.modal.querySelector('#selector-loading') as HTMLElement;
    const resultsEl = this.modal.querySelector('#selector-results') as HTMLElement;
    const emptyEl = this.modal.querySelector('#selector-empty') as HTMLElement;

    loadingEl.style.display = 'none';

    if (results.length === 0) {
      resultsEl.style.display = 'none';
      emptyEl.style.display = 'block';
    } else {
      resultsEl.style.display = 'block';
      emptyEl.style.display = 'none';
      this.renderResults();
    }
  }

  showLoading(): void {
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    const loadingEl = this.modal.querySelector('#selector-loading') as HTMLElement;
    const resultsEl = this.modal.querySelector('#selector-results') as HTMLElement;
    const emptyEl = this.modal.querySelector('#selector-empty') as HTMLElement;

    loadingEl.style.display = 'block';
    resultsEl.style.display = 'none';
    emptyEl.style.display = 'none';
  }

  close(): void {
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
    this.results = [];
  }
}
