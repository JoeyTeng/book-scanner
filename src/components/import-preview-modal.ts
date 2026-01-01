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

          ${this.renderDefaultStrategies()}
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

  private renderDefaultStrategies(): string {
    const hasConflicts =
      this.conflicts.listNameConflicts.length > 0 ||
      this.conflicts.bookConflicts.length > 0;

    if (!hasConflicts) {
      return ''; // No need to show strategies if no conflicts
    }

    return `
      <div class="import-default-strategies">
        <h3>🔧 ${i18n.t("import.preview.defaultStrategies")}</h3>
        <div class="strategy-grid">
          <div class="strategy-item">
            <label for="list-action-select">${i18n.t(
              "import.preview.listConflictAction"
            )}:</label>
            <select id="list-action-select" class="strategy-select">
              <option value="rename" selected>${i18n.t(
                "import.strategy.list.rename"
              )}</option>
              <option value="merge">${i18n.t(
                "import.strategy.list.merge"
              )}</option>
              <option value="replace">${i18n.t(
                "import.strategy.list.replace"
              )}</option>
              <option value="skip">${i18n.t(
                "import.strategy.list.skip"
              )}</option>
            </select>
          </div>

          <div class="strategy-item">
            <label for="book-action-select">${i18n.t(
              "import.preview.bookConflictAction"
            )}:</label>
            <select id="book-action-select" class="strategy-select">
              <option value="merge" selected>${i18n.t(
                "import.strategy.book.merge"
              )}</option>
              <option value="skip">${i18n.t(
                "import.strategy.book.skip"
              )}</option>
              <option value="duplicate">${i18n.t(
                "import.strategy.book.duplicate"
              )}</option>
            </select>
          </div>

          <div class="strategy-item">
            <label for="comment-merge-select">${i18n.t(
              "import.preview.commentMerge"
            )}:</label>
            <select id="comment-merge-select" class="strategy-select" disabled>
              <option value="both" selected>${i18n.t(
                "import.strategy.comment.both"
              )}</option>
              <option value="local">${i18n.t(
                "import.strategy.comment.local"
              )}</option>
              <option value="import">${i18n.t(
                "import.strategy.comment.import"
              )}</option>
            </select>
            <span class="strategy-hint">${i18n.t(
              "import.strategy.hint.commentMergeDisabled"
            )}</span>
          </div>

          <div class="strategy-item">
            <label for="field-merge-select">${i18n.t(
              "import.preview.fieldMerge"
            )}:</label>
            <select id="field-merge-select" class="strategy-select" disabled>
              <option value="non-empty" selected>${i18n.t(
                "import.strategy.field.nonEmpty"
              )}</option>
              <option value="local">${i18n.t(
                "import.strategy.field.local"
              )}</option>
              <option value="import">${i18n.t(
                "import.strategy.field.import"
              )}</option>
            </select>
            <span class="strategy-hint">${i18n.t(
              "import.strategy.hint.fieldMergeDisabled"
            )}</span>
          </div>
        </div>
      </div>
    `;
  }

  private updateConflictPreview(): void {
    const conflictsContainer = this.element.querySelector('.import-conflicts');
    if (conflictsContainer) {
      conflictsContainer.innerHTML = `
        <h3>${i18n.t("import.preview.conflictsDetected")}</h3>

        ${this.renderListNameConflicts()}
        ${this.renderBookConflicts()}
      `;
    }
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
      .map(conflict => {
        const action = this.strategy.defaultListAction;
        let resolutionText = '';

        switch (action) {
          case "rename":
            resolutionText = i18n.t("import.preview.willRename", {
              name: this.escapeHtml(conflict.suggestedName),
            });
            break;
          case "merge":
            resolutionText = i18n.t("import.preview.willMergeList");
            break;
          case "replace":
            resolutionText = i18n.t("import.preview.willReplace");
            break;
          case "skip":
            resolutionText = i18n.t("import.preview.willSkip");
            break;
        }

        return `
          <li class="conflict-item">
            <div class="conflict-info">
              <span class="conflict-name">"${this.escapeHtml(conflict.importedName)}"</span>
              <span class="conflict-detail">${i18n.t('import.preview.listExists')}</span>
            </div>
            <div class="conflict-resolution">
              → ${resolutionText}
            </div>
          </li>
        `;
      })
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

        const action = this.strategy.defaultBookAction;
        let resolutionText = "";

        switch (action) {
          case 'merge':
            resolutionText = i18n.t('import.preview.willMerge');
            break;
          case 'skip':
            resolutionText = i18n.t('import.preview.willSkipBook');
            break;
          case 'duplicate':
            resolutionText = i18n.t('import.preview.willDuplicate');
            break;
        }

        return `
          <li class="conflict-item">
            <div class="conflict-info">
              <span class="conflict-name">"${this.escapeHtml(conflict.importedBook.title)}"</span>
              <span class="conflict-detail">${matchInfo}</span>
            </div>
            <div class="conflict-resolution">
              → ${resolutionText}
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
    const closeBtn = this.element.querySelector(".btn-close");
    const cancelBtn = this.element.querySelector(".btn-cancel");
    const confirmBtn = this.element.querySelector(".btn-confirm");

    closeBtn?.addEventListener("click", () => this.close());
    cancelBtn?.addEventListener("click", () => this.close());
    confirmBtn?.addEventListener("click", () => this.confirm());

    // Strategy selectors
    const listActionSelect = this.element.querySelector(
      "#list-action-select"
    ) as HTMLSelectElement;
    const bookActionSelect = this.element.querySelector(
      "#book-action-select"
    ) as HTMLSelectElement;
    const commentMergeSelect = this.element.querySelector(
      "#comment-merge-select"
    ) as HTMLSelectElement;
    const fieldMergeSelect = this.element.querySelector(
      "#field-merge-select"
    ) as HTMLSelectElement;

    // Initialize disabled state based on current default values
    if (commentMergeSelect) {
      commentMergeSelect.disabled = this.strategy.defaultListAction !== "merge";
      const hintSpan = commentMergeSelect.parentElement?.querySelector(".strategy-hint");
      if (hintSpan) {
        hintSpan.textContent = commentMergeSelect.disabled
          ? i18n.t("import.strategy.hint.commentMergeDisabled")
          : "";
      }
    }
    if (fieldMergeSelect) {
      fieldMergeSelect.disabled = this.strategy.defaultBookAction !== "merge";
      const hintSpan = fieldMergeSelect.parentElement?.querySelector(".strategy-hint");
      if (hintSpan) {
        hintSpan.textContent = fieldMergeSelect.disabled
          ? i18n.t("import.strategy.hint.fieldMergeDisabled")
          : "";
      }
    }

    listActionSelect?.addEventListener("change", (e) => {
      this.strategy.defaultListAction = (e.target as HTMLSelectElement)
        .value as any;
      this.updateConflictPreview();
    });

    bookActionSelect?.addEventListener("change", (e) => {
      this.strategy.defaultBookAction = (e.target as HTMLSelectElement)
        .value as any;
      this.updateConflictPreview();
    });

    // Enable/disable comment merge selector based on list action
    listActionSelect?.addEventListener("change", (e) => {
      const action = (e.target as HTMLSelectElement).value;
      if (commentMergeSelect) {
        commentMergeSelect.disabled = action !== "merge";
        const hintSpan =
          commentMergeSelect.parentElement?.querySelector(".strategy-hint");
        if (hintSpan) {
          hintSpan.textContent =
            action !== "merge"
              ? i18n.t("import.strategy.hint.commentMergeDisabled")
              : "";
        }
      }
    });

    // Enable/disable field merge selector based on book action
    bookActionSelect?.addEventListener("change", (e) => {
      const action = (e.target as HTMLSelectElement).value;
      if (fieldMergeSelect) {
        fieldMergeSelect.disabled = action !== "merge";
        const hintSpan =
          fieldMergeSelect.parentElement?.querySelector(".strategy-hint");
        if (hintSpan) {
          hintSpan.textContent =
            action !== "merge"
              ? i18n.t("import.strategy.hint.fieldMergeDisabled")
              : "";
        }
      }
    });

    commentMergeSelect?.addEventListener("change", (e) => {
      this.strategy.defaultCommentMerge = (e.target as HTMLSelectElement)
        .value as any;
    });

    fieldMergeSelect?.addEventListener("change", (e) => {
      this.strategy.defaultFieldMerge = (e.target as HTMLSelectElement)
        .value as any;
    });

    // Do NOT close on overlay click (desktop protection)
    // Overlay click is disabled to prevent accidental data loss

    // Close on Escape key (with confirmation in future)
    document.addEventListener("keydown", this.handleEscape);
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
