import { DiffViewer, type FieldDiff } from './diff-viewer';
import { i18n } from '../modules/i18n';
import type { BookConflict, ConflictInfo, ImportStrategy } from '../modules/book-list-import';

const listActions: Array<ImportStrategy['defaultListAction']> = [
  'rename',
  'merge',
  'replace',
  'skip',
];
const bookActions: Array<ImportStrategy['defaultBookAction']> = ['merge', 'skip', 'duplicate'];
const commentMergeActions: Array<ImportStrategy['defaultCommentMerge']> = [
  'local',
  'import',
  'both',
];
const fieldMergeActions: Array<ImportStrategy['defaultFieldMerge']> = [
  'detailed',
  'non-empty',
  'local',
  'import',
];
const fieldStrategyKeys = ['isbn', 'publisher', 'publishDate', 'cover'] as const;
const fieldStrategyValues = ['unresolved', 'local', 'import', 'non-empty'] as const;

type FieldStrategyKey = (typeof fieldStrategyKeys)[number];
type FieldStrategyValue = (typeof fieldStrategyValues)[number];
type ConflictField = FieldDiff & { key: FieldStrategyKey };

const isListAction = (value: string): value is ImportStrategy['defaultListAction'] =>
  listActions.includes(value as ImportStrategy['defaultListAction']);
const isBookAction = (value: string): value is ImportStrategy['defaultBookAction'] =>
  bookActions.includes(value as ImportStrategy['defaultBookAction']);
const isCommentMergeAction = (value: string): value is ImportStrategy['defaultCommentMerge'] =>
  commentMergeActions.includes(value as ImportStrategy['defaultCommentMerge']);
const isFieldMergeAction = (value: string): value is ImportStrategy['defaultFieldMerge'] =>
  fieldMergeActions.includes(value as ImportStrategy['defaultFieldMerge']);
const isFieldStrategyKey = (value: string): value is FieldStrategyKey =>
  fieldStrategyKeys.includes(value as FieldStrategyKey);
const isFieldStrategyValue = (value: string): value is FieldStrategyValue =>
  fieldStrategyValues.includes(value as FieldStrategyValue);

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
  private expandedConflicts: Set<number> = new Set(); // Track expanded book conflicts by index

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
      defaultFieldMerge: 'non-empty',
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
          <div class="footer-right">
            <span class="unresolved-warning" style="display: none;"></span>
            <button class="btn-primary btn-confirm">${i18n.t('import.preview.confirmImport')}</button>
          </div>
        </div>
      </div>
    `;

    return modal;
  }

  private renderDefaultStrategies(): string {
    const hasConflicts =
      this.conflicts.listNameConflicts.length > 0 || this.conflicts.bookConflicts.length > 0;

    if (!hasConflicts) {
      return ''; // No need to show strategies if no conflicts
    }

    return `
      <div class="import-default-strategies">
        <h3>🔧 ${i18n.t('import.preview.defaultStrategies')}</h3>
        <div class="strategy-grid">
          <div class="strategy-item">
            <label for="list-action-select">${i18n.t('import.preview.listConflictAction')}:</label>
            <select id="list-action-select" class="strategy-select">
              <option value="rename" selected>${i18n.t('import.strategy.list.rename')}</option>
              <option value="merge">${i18n.t('import.strategy.list.merge')}</option>
              <option value="replace">${i18n.t('import.strategy.list.replace')}</option>
              <option value="skip">${i18n.t('import.strategy.list.skip')}</option>
            </select>
          </div>

          <div class="strategy-item">
            <label for="book-action-select">${i18n.t('import.preview.bookConflictAction')}:</label>
            <select id="book-action-select" class="strategy-select">
              <option value="merge" selected>${i18n.t('import.strategy.book.merge')}</option>
              <option value="skip">${i18n.t('import.strategy.book.skip')}</option>
              <option value="duplicate">${i18n.t('import.strategy.book.duplicate')}</option>
            </select>
          </div>

          <div class="strategy-item">
            <label for="comment-merge-select">${i18n.t('import.preview.commentMerge')}:</label>
            <select id="comment-merge-select" class="strategy-select" disabled>
              <option value="both" selected>${i18n.t('import.strategy.comment.both')}</option>
              <option value="local">${i18n.t('import.strategy.comment.local')}</option>
              <option value="import">${i18n.t('import.strategy.comment.import')}</option>
            </select>
            <span class="strategy-hint">${i18n.t(
              'import.strategy.hint.commentMergeDisabled'
            )}</span>
          </div>

          <div class="strategy-item">
            <label for="field-merge-select">${i18n.t('import.preview.fieldMerge')}:</label>
            <select id="field-merge-select" class="strategy-select" disabled>
              <option value="detailed">${i18n.t('import.strategy.field.detailed')}</option>
              <option value="non-empty" selected>${i18n.t(
                'import.strategy.field.nonEmpty'
              )}</option>
              <option value="local">${i18n.t('import.strategy.field.local')}</option>
              <option value="import">${i18n.t('import.strategy.field.import')}</option>
            </select>
            <span class="strategy-hint">${i18n.t('import.strategy.hint.fieldMergeDisabled')}</span>
          </div>
        </div>
      </div>
    `;
  }

  private updateConflictPreview(): void {
    const conflictsContainer = this.element.querySelector('.import-conflicts');
    if (conflictsContainer) {
      conflictsContainer.innerHTML = `
        <h3>${i18n.t('import.preview.conflictsDetected')}</h3>

        ${this.renderListNameConflicts()}
        ${this.renderBookConflicts()}
      `;

      // Re-attach conflict toggle event listeners after re-render
      this.attachConflictToggleListeners();

      // Re-initialize all expanded conflicts
      this.expandedConflicts.forEach((index) => {
        this.initializeExpandedConflict(index);
      });

      // Update confirm button state
      this.updateConfirmButtonState();
    }
  }

  private attachConflictToggleListeners(): void {
    this.element.querySelectorAll('[data-toggle-conflict]').forEach((toggle) => {
      toggle.addEventListener('click', (e) => {
        const index = parseInt((e.currentTarget as HTMLElement).dataset.toggleConflict || '0');
        this.toggleConflict(index);
      });
    });
  }

  private updateConfirmButtonState(): void {
    const confirmBtn = this.element.querySelector('.btn-confirm') as HTMLButtonElement;
    const warningSpan = this.element.querySelector('.unresolved-warning') as HTMLElement;

    if (!confirmBtn || !warningSpan) return;

    const unresolvedCount = this.countUnresolvedConflicts();
    const hasUnresolved = unresolvedCount > 0;
    const isDetailedMode =
      this.strategy.defaultFieldMerge === 'detailed' && this.strategy.defaultBookAction === 'merge';

    if (isDetailedMode && hasUnresolved) {
      confirmBtn.disabled = true;
      warningSpan.textContent = i18n.t('import.preview.hasUnresolved', { count: unresolvedCount });
      warningSpan.style.display = 'inline-block';
    } else {
      confirmBtn.disabled = false;
      warningSpan.style.display = 'none';
    }
  }

  private renderConflicts(): string {
    const hasConflicts =
      this.conflicts.listNameConflicts.length > 0 || this.conflicts.bookConflicts.length > 0;

    if (!hasConflicts) {
      return `
        <div class="import-no-conflicts">
          <p>✅ ${i18n.t('import.preview.noConflicts')}</p>
        </div>
      `;
    }

    return `
      <div class="import-conflicts">
        <h3>${i18n.t('import.preview.conflictsDetected')}</h3>

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
      .map((conflict) => {
        const action = this.strategy.defaultListAction;
        let resolutionText = '';

        switch (action) {
          case 'rename':
            resolutionText = i18n.t('import.preview.willRename', {
              name: this.escapeHtml(conflict.suggestedName),
            });
            break;
          case 'merge':
            resolutionText = i18n.t('import.preview.willMergeList');
            break;
          case 'replace':
            resolutionText = i18n.t('import.preview.willReplace');
            break;
          case 'skip':
            resolutionText = i18n.t('import.preview.willSkip');
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
        ? `<li class="conflict-more">... ${i18n.t('import.preview.andMore', {
            count: remaining,
          })}</li>`
        : '';

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

  private hasFieldConflicts(conflict: BookConflict): boolean {
    const { existingBook, importedBook } = conflict;
    const hasIsbn = Boolean(existingBook.isbn || importedBook.isbn);
    const hasPublisher = Boolean(existingBook.publisher || importedBook.publisher);
    const hasPublishDate = Boolean(existingBook.publishDate || importedBook.publishDate);
    const hasCover = Boolean(existingBook.cover || importedBook.coverUrl);
    return (
      (hasIsbn && existingBook.isbn !== importedBook.isbn) ||
      (hasPublisher && existingBook.publisher !== importedBook.publisher) ||
      (hasPublishDate && existingBook.publishDate !== importedBook.publishDate) ||
      (hasCover && !!existingBook.cover !== !!importedBook.coverUrl)
    );
  }

  private renderBookConflicts(): string {
    if (this.conflicts.bookConflicts.length === 0) {
      return '';
    }

    // Sort conflicts: books with actual field conflicts first
    const sortedConflicts = this.conflicts.bookConflicts
      .map((conflict, originalIndex) => ({ conflict, originalIndex }))
      .sort((a, b) => {
        const aHasConflict = this.hasFieldConflicts(a.conflict);
        const bHasConflict = this.hasFieldConflicts(b.conflict);
        if (aHasConflict && !bHasConflict) return -1;
        if (!aHasConflict && bHasConflict) return 1;
        return 0;
      });

    const conflicts = sortedConflicts
      .slice(0, 10) // Show first 10 (increased for expandable items)
      .map(({ conflict, originalIndex: index }) => {
        const matchInfo =
          conflict.matchType === 'isbn'
            ? `ISBN: ${conflict.importedBook.isbn}`
            : i18n.t('import.preview.titleAuthorMatch');

        const action = this.strategy.defaultBookAction;
        let resolutionText = '';

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

        const hasRealConflict = this.hasFieldConflicts(conflict);
        const isExpanded = this.expandedConflicts.has(index);
        const expandIcon = isExpanded ? '▼' : '▶';

        // Determine conflict status icon based on resolution state
        let conflictStatusIcon = '';
        if (hasRealConflict) {
          const unresolvedInBook = this.countUnresolvedInBook(conflict);
          const isDetailedMode = this.strategy.defaultFieldMerge === 'detailed';

          if (isDetailedMode && unresolvedInBook > 0) {
            conflictStatusIcon = '⚠️ '; // Has unresolved conflicts
          } else if (isDetailedMode && unresolvedInBook === 0) {
            conflictStatusIcon = '✅ '; // All conflicts resolved
          } else {
            conflictStatusIcon = ''; // Non-detailed mode, no icon needed
          }
        } else {
          conflictStatusIcon = '✅ '; // No real conflicts
        }

        const actionHint = isExpanded
          ? i18n.t('import.preview.hideDetails')
          : i18n.t('import.preview.viewDetails');

        return `
          <li class="conflict-item ${isExpanded ? 'expanded' : ''} ${hasRealConflict ? '' : 'no-conflict'}" data-conflict-index="${index}">
            <div class="conflict-header" data-toggle-conflict="${index}">
              <span class="conflict-expand-icon">${expandIcon}</span>
              <span class="conflict-status-icon">${conflictStatusIcon}</span>
              <div class="conflict-info">
                <span class="conflict-name">"${this.escapeHtml(conflict.importedBook.title)}"</span>
                <span class="conflict-detail">${matchInfo}</span>
              </div>
              <div class="conflict-resolution">
                → ${resolutionText}
              </div>
              <div class="conflict-action-hint">${actionHint}</div>
            </div>
            ${isExpanded ? this.renderConflictDetails(index) : ''}
          </li>
        `;
      })
      .join('');

    const remaining = this.conflicts.bookConflicts.length - 10;
    const remainingText =
      remaining > 0
        ? `<li class="conflict-more">... ${i18n.t('import.preview.andMore', {
            count: remaining,
          })}</li>`
        : '';

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

  private renderConflictDetails(index: number): string {
    const conflict = this.conflicts.bookConflicts[index];
    const showStrategies = this.strategy.defaultBookAction === 'merge';
    const isDetailedMode = this.strategy.defaultFieldMerge === 'detailed';

    // Prepare field data
    const fields: ConflictField[] = [
      {
        key: 'isbn',
        label: 'ISBN',
        local: conflict.existingBook.isbn || '',
        imported: conflict.importedBook.isbn || '',
        hasConflict:
          !!(conflict.existingBook.isbn || conflict.importedBook.isbn) &&
          conflict.existingBook.isbn !== conflict.importedBook.isbn,
      },
      {
        key: 'publisher',
        label: i18n.t('bookForm.label.publisher'),
        local: conflict.existingBook.publisher || '',
        imported: conflict.importedBook.publisher || '',
        hasConflict:
          !!(conflict.existingBook.publisher || conflict.importedBook.publisher) &&
          conflict.existingBook.publisher !== conflict.importedBook.publisher,
      },
      {
        key: 'publishDate',
        label: i18n.t('bookForm.label.publishDate'),
        local: conflict.existingBook.publishDate || '',
        imported: conflict.importedBook.publishDate || '',
        hasConflict:
          !!(conflict.existingBook.publishDate || conflict.importedBook.publishDate) &&
          conflict.existingBook.publishDate !== conflict.importedBook.publishDate,
      },
      {
        key: 'cover',
        label: i18n.t('bookForm.label.coverUrl'),
        local: conflict.existingBook.cover ? '✓ ' + i18n.t('import.preview.hasCover') : '',
        imported: conflict.importedBook.coverUrl ? '✓ ' + i18n.t('import.preview.hasCover') : '',
        hasConflict: !!conflict.existingBook.cover !== !!conflict.importedBook.coverUrl,
      },
    ];

    // Get book resolution for field strategies
    const bookKey =
      conflict.importedBook.isbn ||
      `${String(conflict.importedBook.title)}|${String(conflict.importedBook.author)}`;
    const bookResolution = this.strategy.bookResolutions?.get(bookKey);

    if (isDetailedMode && showStrategies) {
      // Detailed mode: show diff viewer and per-field strategy selectors
      const fieldsHtml = fields
        .map((field) => {
          const hasConflict = field.hasConflict;
          const fieldStrategy: FieldStrategyValue =
            bookResolution?.fieldStrategies?.[field.key] ?? 'unresolved';
          const isUnresolved = fieldStrategy === 'unresolved';

          return `
        <div class="diff-field-with-strategy ${hasConflict ? 'has-conflict' : ''} ${isUnresolved && hasConflict ? 'unresolved-conflict' : ''}">
          <div class="diff-field-header">
            <span class="diff-field-label">${field.label}${isUnresolved && hasConflict ? ' <span class="unresolved-badge">!</span>' : ''}</span>
            ${
              hasConflict
                ? `
              <select class="field-strategy-select-inline" data-conflict-index="${index}" data-field="${field.key}">
                <option value="unresolved" ${isUnresolved ? 'selected' : ''}>${i18n.t('import.strategy.field.unresolved')}</option>
                <option value="non-empty" ${fieldStrategy === 'non-empty' ? 'selected' : ''}>${i18n.t('import.strategy.field.nonEmpty')}</option>
                <option value="local" ${fieldStrategy === 'local' ? 'selected' : ''}>${i18n.t('import.strategy.field.local')}</option>
                <option value="import" ${fieldStrategy === 'import' ? 'selected' : ''}>${i18n.t('import.strategy.field.import')}</option>
              </select>
            `
                : ''
            }
          </div>
          <div class="diff-field-content">
            ${hasConflict && isUnresolved ? '<div class="diff-viewer-container" data-field="' + field.key + '"></div>' : this.renderMergeResult(field, fieldStrategy)}
          </div>
        </div>
      `;
        })
        .join('');

      return `
      <div class="conflict-details" data-conflict-index="${index}">
        <div class="conflict-fields-list">
          ${fieldsHtml}
        </div>
      </div>
    `;
    } else {
      // Non-detailed mode: show merge result preview
      const globalStrategy = this.strategy.defaultFieldMerge;

      // Map strategy value to i18n key
      const strategyI18nMap: Record<string, string> = {
        detailed: 'import.strategy.field.detailed',
        'non-empty': 'import.strategy.field.nonEmpty',
        local: 'import.strategy.field.local',
        import: 'import.strategy.field.import',
      };
      const strategyLabel = i18n.t(
        strategyI18nMap[globalStrategy] || 'import.strategy.field.nonEmpty'
      );

      const fieldsHtml = fields
        .map((field) => {
          const hasConflict = field.hasConflict;

          return `
        <div class="diff-field-with-strategy ${hasConflict ? 'has-conflict-resolved' : ''}">
          <div class="diff-field-header">
            <span class="diff-field-label">${field.label}</span>
            <span class="diff-field-strategy-label">${i18n.t(
              'import.preview.strategy'
            )}: ${strategyLabel}</span>
          </div>
          <div class="diff-field-content">
            ${this.renderMergeResult(field, globalStrategy)}
          </div>
        </div>
      `;
        })
        .join('');

      return `
      <div class="conflict-details" data-conflict-index="${index}">
        <div class="conflict-fields-list">
          ${fieldsHtml}
        </div>
      </div>
    `;
    }
  }

  private renderMergeResult(
    field: { local: string; imported: string; hasConflict: boolean },
    strategy: string
  ): string {
    if (!field.hasConflict) {
      const value = field.local || field.imported;
      return `<div class="merge-result-preview">${value || '<span class="empty-field-value">' + i18n.t('import.preview.fieldEmpty') + '</span>'}</div>`;
    }

    let result = '';
    switch (strategy) {
      case 'non-empty':
        result = field.local || field.imported;
        break;
      case 'local':
        result = field.local;
        break;
      case 'import':
        result = field.imported;
        break;
      default:
        result = '';
    }

    return `<div class="merge-result-preview">${result || '<span class="empty-field-value">' + i18n.t('import.preview.fieldEmpty') + '</span>'}</div>`;
  }

  private attachEventListeners(): void {
    const closeBtn = this.element.querySelector('.btn-close');
    const cancelBtn = this.element.querySelector('.btn-cancel');
    const confirmBtn = this.element.querySelector('.btn-confirm');

    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());
    confirmBtn?.addEventListener('click', () => {
      if (this.validateResolutions()) {
        this.confirm();
      } else {
        alert(
          i18n
            .t('import.preview.hasUnresolved')
            .replace('{count}', String(this.countUnresolvedConflicts()))
        );
      }
    });

    // Strategy selectors
    const listActionSelect = this.element.querySelector('#list-action-select') as HTMLSelectElement;
    const bookActionSelect = this.element.querySelector('#book-action-select') as HTMLSelectElement;
    const commentMergeSelect = this.element.querySelector(
      '#comment-merge-select'
    ) as HTMLSelectElement;
    const fieldMergeSelect = this.element.querySelector('#field-merge-select') as HTMLSelectElement;

    // Initialize disabled state based on current default values
    if (commentMergeSelect) {
      commentMergeSelect.disabled = this.strategy.defaultListAction !== 'merge';
      const hintSpan = commentMergeSelect.parentElement?.querySelector('.strategy-hint');
      if (hintSpan) {
        hintSpan.textContent = commentMergeSelect.disabled
          ? i18n.t('import.strategy.hint.commentMergeDisabled')
          : '';
      }
    }
    if (fieldMergeSelect) {
      fieldMergeSelect.disabled = this.strategy.defaultBookAction !== 'merge';
      const hintSpan = fieldMergeSelect.parentElement?.querySelector('.strategy-hint');
      if (hintSpan) {
        hintSpan.textContent = fieldMergeSelect.disabled
          ? i18n.t('import.strategy.hint.fieldMergeDisabled')
          : '';
      }
    }

    listActionSelect?.addEventListener('change', (e) => {
      const action = (e.target as HTMLSelectElement).value;
      if (!isListAction(action)) return;
      this.strategy.defaultListAction = action;
      this.updateConflictPreview();
    });

    bookActionSelect?.addEventListener('change', (e) => {
      const action = (e.target as HTMLSelectElement).value;
      if (!isBookAction(action)) return;
      this.strategy.defaultBookAction = action;
      this.updateConflictPreview();
    });

    // Enable/disable comment merge selector based on list action
    listActionSelect?.addEventListener('change', (e) => {
      const action = (e.target as HTMLSelectElement).value;
      if (commentMergeSelect) {
        commentMergeSelect.disabled = action !== 'merge';
        const hintSpan = commentMergeSelect.parentElement?.querySelector('.strategy-hint');
        if (hintSpan) {
          hintSpan.textContent =
            action !== 'merge' ? i18n.t('import.strategy.hint.commentMergeDisabled') : '';
        }
      }
    });

    // Enable/disable field merge selector based on book action
    bookActionSelect?.addEventListener('change', (e) => {
      const action = (e.target as HTMLSelectElement).value;
      if (!isBookAction(action)) return;
      this.strategy.defaultBookAction = action;
      if (fieldMergeSelect) {
        fieldMergeSelect.disabled = action !== 'merge';
        const hintSpan = fieldMergeSelect.parentElement?.querySelector('.strategy-hint');
        if (hintSpan) {
          hintSpan.textContent =
            action !== 'merge' ? i18n.t('import.strategy.hint.fieldMergeDisabled') : '';
        }
      }
      // Update conflicts preview and button state
      this.updateConflictPreview();
    });

    commentMergeSelect?.addEventListener('change', (e) => {
      const action = (e.target as HTMLSelectElement).value;
      if (isCommentMergeAction(action)) {
        this.strategy.defaultCommentMerge = action;
      }
    });

    fieldMergeSelect?.addEventListener('change', (e) => {
      const action = (e.target as HTMLSelectElement).value;
      if (!isFieldMergeAction(action)) return;
      this.strategy.defaultFieldMerge = action;
      // Re-render to update conflict details based on new strategy
      this.updateConflictPreview();
    });

    // Conflict expand/collapse toggles (initial binding)
    this.attachConflictToggleListeners();

    // Initial button state update
    this.updateConfirmButtonState();

    // Field strategy selectors
    this.element.querySelectorAll('.field-strategy-select').forEach((select) => {
      select.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        const conflictIndex = parseInt(target.dataset.conflictIndex || '0');
        const field = target.dataset.field;
        const value = target.value;
        if (!field || !isFieldStrategyKey(field) || !isFieldStrategyValue(value)) {
          return;
        }

        // Initialize bookResolutions if not exists
        if (!this.strategy.bookResolutions) {
          this.strategy.bookResolutions = new Map();
        }

        const conflict = this.conflicts.bookConflicts[conflictIndex];
        const key = `${conflict.existingBook.id}`;

        // Get or create resolution for this book
        let resolution = this.strategy.bookResolutions.get(key);
        if (!resolution) {
          resolution = {
            action: this.strategy.defaultBookAction,
            fieldMergeStrategy: this.strategy.defaultFieldMerge,
            fieldStrategies: {},
          };
          this.strategy.bookResolutions.set(key, resolution);
        }

        // Update field strategy
        if (!resolution.fieldStrategies) {
          resolution.fieldStrategies = {};
        }
        resolution.fieldStrategies[field] = value;
      });
    });

    // Do NOT close on overlay click (desktop protection)
    // Overlay click is disabled to prevent accidental data loss

    // Close on Escape key (with confirmation in future)
    document.addEventListener('keydown', this.handleEscape);
  }

  private toggleConflict(index: number): void {
    if (this.expandedConflicts.has(index)) {
      this.expandedConflicts.delete(index);
    } else {
      this.expandedConflicts.add(index);
    }

    // Re-render conflicts section
    this.updateConflictPreview();
  }

  private initializeExpandedConflict(index: number): void {
    const isDetailedMode = this.strategy.defaultFieldMerge === 'detailed';

    if (isDetailedMode) {
      const conflict = this.conflicts.bookConflicts[index];

      // Prepare field diffs
      const fields: FieldDiff[] = [
        {
          label: 'ISBN',
          local: conflict.existingBook.isbn || '',
          imported: conflict.importedBook.isbn || '',
          hasConflict:
            !!(conflict.existingBook.isbn || conflict.importedBook.isbn) &&
            conflict.existingBook.isbn !== conflict.importedBook.isbn,
        },
        {
          label: i18n.t('bookForm.label.publisher'),
          local: conflict.existingBook.publisher || '',
          imported: conflict.importedBook.publisher || '',
          hasConflict:
            !!(conflict.existingBook.publisher || conflict.importedBook.publisher) &&
            conflict.existingBook.publisher !== conflict.importedBook.publisher,
        },
        {
          label: i18n.t('bookForm.label.publishDate'),
          local: conflict.existingBook.publishDate || '',
          imported: conflict.importedBook.publishDate || '',
          hasConflict:
            !!(conflict.existingBook.publishDate || conflict.importedBook.publishDate) &&
            conflict.existingBook.publishDate !== conflict.importedBook.publishDate,
        },
        {
          label: i18n.t('bookForm.label.coverUrl'),
          local: conflict.existingBook.cover ? '✓ ' + i18n.t('import.preview.hasCover') : '',
          imported: conflict.importedBook.coverUrl ? '✓ ' + i18n.t('import.preview.hasCover') : '',
          hasConflict: !!conflict.existingBook.cover !== !!conflict.importedBook.coverUrl,
        },
      ];

      const fieldKeyMap: Record<string, FieldStrategyKey> = {
        ISBN: 'isbn',
        [i18n.t('bookForm.label.publisher')]: 'publisher',
        [i18n.t('bookForm.label.publishDate')]: 'publishDate',
        [i18n.t('bookForm.label.coverUrl')]: 'cover',
      };

      // Get book resolution to check which fields are unresolved
      const bookKey =
        conflict.importedBook.isbn ||
        `${String(conflict.importedBook.title)}|${String(conflict.importedBook.author)}`;
      const bookResolution = this.strategy.bookResolutions?.get(bookKey);

      // Initialize DiffViewer for each unresolved conflict field
      fields.forEach((field) => {
        if (!field.hasConflict) return;

        const fieldKey = fieldKeyMap[field.label];
        const fieldStrategy = bookResolution?.fieldStrategies?.[fieldKey] || 'unresolved';

        // Only initialize DiffViewer for unresolved fields
        if (fieldStrategy === 'unresolved') {
          const container = this.element.querySelector(
            `.conflict-details[data-conflict-index="${index}"] .diff-viewer-container[data-field="${fieldKey}"]`
          ) as HTMLElement;

          if (container) {
            container.innerHTML = '';
            new DiffViewer(container, {
              mode: 'inline',
              fields: [field],
            });
          }
        }
      });
    }

    // Attach field strategy listeners
    this.element
      .querySelectorAll(`.field-strategy-select-inline[data-conflict-index="${index}"]`)
      .forEach((select) => {
        select.addEventListener('change', (e) => {
          const target = e.target as HTMLSelectElement;
          const field = target.dataset.field;
          const value = target.value;
          if (!field || !isFieldStrategyKey(field) || !isFieldStrategyValue(value)) {
            return;
          }

          if (!this.strategy.bookResolutions) {
            this.strategy.bookResolutions = new Map();
          }

          const conflict = this.conflicts.bookConflicts[index];
          // Use same key format as executeImport: ISBN or title|author
          const key =
            conflict.importedBook.isbn ||
            `${String(conflict.importedBook.title)}|${String(conflict.importedBook.author)}`;

          let resolution = this.strategy.bookResolutions.get(key);
          if (!resolution) {
            resolution = {
              action: this.strategy.defaultBookAction,
              fieldMergeStrategy: this.strategy.defaultFieldMerge,
              fieldStrategies: {},
            };
            this.strategy.bookResolutions.set(key, resolution);
          }

          if (!resolution.fieldStrategies) {
            resolution.fieldStrategies = {};
          }
          resolution.fieldStrategies[field] = value;

          // Re-render this conflict to update diff/preview based on strategy
          this.updateConflictPreview();
        });
      });
  }

  private handleEscape = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.close();
    }
  };

  private validateResolutions(): boolean {
    // If not in detailed mode or not merging, no validation needed
    if (
      this.strategy.defaultFieldMerge !== 'detailed' ||
      this.strategy.defaultBookAction !== 'merge'
    ) {
      return true;
    }

    return this.countUnresolvedConflicts() === 0;
  }

  private countUnresolvedInBook(conflict: BookConflict): number {
    let count = 0;
    const bookKey =
      conflict.importedBook.isbn ||
      `${String(conflict.importedBook.title)}|${String(conflict.importedBook.author)}`;
    const bookResolution = this.strategy.bookResolutions?.get(bookKey);

    const fields: Array<{
      key: FieldStrategyKey;
      local?: string;
      imported?: string;
    }> = [
      { key: 'isbn', local: conflict.existingBook.isbn, imported: conflict.importedBook.isbn },
      {
        key: 'publisher',
        local: conflict.existingBook.publisher,
        imported: conflict.importedBook.publisher,
      },
      {
        key: 'publishDate',
        local: conflict.existingBook.publishDate,
        imported: conflict.importedBook.publishDate,
      },
      {
        key: 'cover',
        local: conflict.existingBook.cover,
        imported: conflict.importedBook.coverUrl,
      },
    ];

    fields.forEach((field) => {
      const hasConflict = (field.local || field.imported) && field.local !== field.imported;
      if (hasConflict) {
        const strategy = bookResolution?.fieldStrategies?.[field.key];
        if (!strategy || strategy === 'unresolved') {
          count++;
        }
      }
    });

    return count;
  }

  private countUnresolvedConflicts(): number {
    let count = 0;

    this.conflicts.bookConflicts.forEach((conflict) => {
      const bookKey =
        conflict.importedBook.isbn ||
        `${String(conflict.importedBook.title)}|${String(conflict.importedBook.author)}`;
      const bookResolution = this.strategy.bookResolutions?.get(bookKey);

      // Check each field for conflicts
      const fields: Array<{ key: FieldStrategyKey; local: string; imported: string }> = [
        {
          key: 'isbn',
          local: conflict.existingBook.isbn || '',
          imported: conflict.importedBook.isbn || '',
        },
        {
          key: 'publisher',
          local: conflict.existingBook.publisher || '',
          imported: conflict.importedBook.publisher || '',
        },
        {
          key: 'publishDate',
          local: conflict.existingBook.publishDate || '',
          imported: conflict.importedBook.publishDate || '',
        },
        {
          key: 'cover',
          local: conflict.existingBook.cover || '',
          imported: conflict.importedBook.coverUrl || '',
        },
      ];

      fields.forEach((field) => {
        const hasConflict = (field.local || field.imported) && field.local !== field.imported;
        if (hasConflict) {
          const strategy = bookResolution?.fieldStrategies?.[field.key];
          if (!strategy || strategy === 'unresolved') {
            count++;
          }
        }
      });
    });

    return count;
  }

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
