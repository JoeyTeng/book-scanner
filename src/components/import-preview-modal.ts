import { i18n } from '../modules/i18n';
import type { ConflictInfo, ImportStrategy } from '../modules/book-list-import';

/**
 * Import Preview Modal
 * Shows import summary and detected conflicts before execution
 */
export class ImportPreviewModal {
  private element: HTMLDivElement;
  private conflicts: ConflictInfo;
  private strategy: ImportStrategy;
  private onConfirm: (strategy: ImportStrategy) => void;
  private onCancel: () => void;

  constructor(
    conflicts: ConflictInfo,
    totalLists: number,
    totalBooks: number,
    onConfirm: (strategy: ImportStrategy) => void,
    onCancel: () => void
  ) {
    this.conflicts = conflicts;
    this.strategy = {
      defaultListAction: 'rename',
      defaultBookAction: 'merge',
      defaultCommentMerge: 'both',
      defaultFieldMerge: 'non-empty'
    };
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
    this.element = this.createModalElement(totalLists, totalBooks);
    this.attachEventListeners();
  }

  private createModalElement(totalLists: number, totalBooks: number): HTMLDivElement {
    const modal = document.createElement('div');
    modal.className = 'modal'; // Use 'modal' instead of 'modal-overlay'

    const newBooksCount = totalBooks - this.conflicts.bookConflicts.length;
    const mergedBooksCount = this.conflicts.bookConflicts.length;

    modal.innerHTML = `
      <div class="modal-content import-preview-modal">
        <div class="modal-header">
          <h2>${i18n.t('import.preview.title')}</h2>
          <button class="btn-close">✕</button>
        </div>
        <div class="modal-body">
          <div class="import-summary">
            <h3>${i18n.t('import.preview.summary')}</h3>
            <ul>
              <li>${i18n.t('import.preview.totalLists', { count: totalLists })}</li>
              <li>${i18n.t('import.preview.totalBooks', { total: totalBooks, new: newBooksCount, merged: mergedBooksCount })}</li>
            </ul>
          </div>

          ${this.renderConflicts()}
        </div>
        <div class="modal-footer">
          <button class="btn-secondary btn-cancel">${i18n.t('common.cancel')}</button>
          <button class="btn-primary btn-confirm">${i18n.t('import.preview.confirmImport')}</button>
        </div>
      </div>
    `;

    return modal;
  }

  private renderConflicts(): string {
    const hasConflicts =
      this.conflicts.listNameConflicts.length > 0 ||
      this.conflicts.bookConflicts.length > 0;

    if (!hasConflicts) {
      return `
        <div class="import-no-conflicts">
          <p>✅ ${i18n.t("import.preview.noConflicts")}</p>
        </div>
      `;
    }

    return `
      <div class="import-conflicts">
        <h3>${i18n.t("import.preview.conflictsDetected")}</h3>

        ${this.renderListNameConflicts()}
        ${this.renderBookConflicts()}
      </div>
    `;
  }

  private renderListNameConflicts(): string {
    if (this.conflicts.listNameConflicts.length === 0) {
      return '';
    }

    const conflicts = this.conflicts.listNameConflicts
      .slice(0, 3) // Show first 3
      .map(conflict => `
        <li class="conflict-item">
          <div class="conflict-info">
            <span class="conflict-name">"${this.escapeHtml(conflict.importedName)}"</span>
            <span class="conflict-detail">${i18n.t('import.preview.listExists')}</span>
          </div>
          <div class="conflict-resolution">
            → ${i18n.t('import.preview.willRename', { name: this.escapeHtml(conflict.suggestedName) })}
          </div>
        </li>
      `)
      .join('');

    const remaining = this.conflicts.listNameConflicts.length - 3;
    const remainingText =
      remaining > 0
        ? `<li class="conflict-more">... ${i18n.t("import.preview.andMore", {
            count: remaining,
          })}</li>`
        : "";

    return `
      <div class="conflict-section">
        <h4>📋 ${i18n.t('import.preview.listNameConflicts', { count: this.conflicts.listNameConflicts.length })}</h4>
        <ul class="conflict-list">
          ${conflicts}
          ${remainingText}
        </ul>
      </div>
    `;
  }

  private renderBookConflicts(): string {
    if (this.conflicts.bookConflicts.length === 0) {
      return '';
    }

    const conflicts = this.conflicts.bookConflicts
      .slice(0, 3) // Show first 3
      .map(conflict => {
        const matchInfo = conflict.matchType === 'isbn'
          ? `ISBN: ${conflict.importedBook.isbn}`
          : i18n.t('import.preview.titleAuthorMatch');

        return `
          <li class="conflict-item">
            <div class="conflict-info">
              <span class="conflict-name">"${this.escapeHtml(conflict.importedBook.title)}"</span>
              <span class="conflict-detail">${matchInfo}</span>
            </div>
            <div class="conflict-resolution">
              → ${i18n.t('import.preview.willMerge')}
            </div>
          </li>
        `;
      })
      .join('');

    const remaining = this.conflicts.bookConflicts.length - 3;
    const remainingText =
      remaining > 0
        ? `<li class="conflict-more">... ${i18n.t("import.preview.andMore", {
            count: remaining,
          })}</li>`
        : "";

    return `
      <div class="conflict-section">
        <h4>📖 ${i18n.t('import.preview.bookConflicts', { count: this.conflicts.bookConflicts.length })}</h4>
        <ul class="conflict-list">
          ${conflicts}
          ${remainingText}
        </ul>
      </div>
    `;
  }

  private attachEventListeners(): void {
    const closeBtn = this.element.querySelector('.btn-close');
    const cancelBtn = this.element.querySelector('.btn-cancel');
    const confirmBtn = this.element.querySelector('.btn-confirm');

    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());
    confirmBtn?.addEventListener('click', () => this.confirm());

    // Close on overlay click
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.close();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', this.handleEscape);
  }

  private handleEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.close();
    }
  };

  private confirm(): void {
    this.onConfirm(this.strategy);
    this.element.remove();
    document.removeEventListener('keydown', this.handleEscape);
  }

  private close(): void {
    this.onCancel();
    this.element.remove();
    document.removeEventListener('keydown', this.handleEscape);
  }

  public show(): void {
    document.body.appendChild(this.element);
    // Modal uses 'active' class to display
    this.element.classList.add('active');
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
