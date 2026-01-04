import { i18n } from '../modules/i18n';

export type DiffMode = 'side-by-side' | 'inline';

export interface FieldDiff {
  label: string;
  local: string;
  imported: string;
  hasConflict: boolean; // True if values differ
}

export interface DiffViewerOptions {
  mode: DiffMode;
  fields: FieldDiff[];
  onModeToggle?: (newMode: DiffMode) => void;
}

interface DiffPart {
  value: string;
  type: 'equal' | 'delete' | 'insert';
  charDiff?: string[]; // For character-level highlighting within the part
}

/**
 * Compute character-level diff between two strings
 * Returns word-level diff with character-level highlighting for changed words
 */
function computeDiff(oldStr: string, newStr: string): { old: DiffPart[]; new: DiffPart[] } {
  if (oldStr === newStr) {
    return {
      old: [{ value: oldStr, type: 'equal' }],
      new: [{ value: newStr, type: 'equal' }],
    };
  }

  const oldParts: DiffPart[] = [];
  const newParts: DiffPart[] = [];

  // Split by whitespace but keep the whitespace
  const oldWords = oldStr.split(/(\s+)/);
  const newWords = newStr.split(/(\s+)/);

  // Use Myers diff algorithm for better word matching
  const changes = myersDiff(oldWords, newWords);

  for (const change of changes) {
    if (change.type === 'equal') {
      oldParts.push({ value: change.value, type: 'equal' });
      newParts.push({ value: change.value, type: 'equal' });
    } else if (change.type === 'delete') {
      oldParts.push({ value: change.value, type: 'delete' });
    } else if (change.type === 'insert') {
      newParts.push({ value: change.value, type: 'insert' });
    } else {
      // For replaced words, do character-level diff
      const charDiff = characterDiff(change.oldValue!, change.newValue!);
      oldParts.push({
        value: change.oldValue!,
        type: 'delete',
        charDiff: charDiff.old,
      });
      newParts.push({
        value: change.newValue!,
        type: 'insert',
        charDiff: charDiff.new,
      });
    }
  }

  return { old: oldParts, new: newParts };
}

interface DiffChange {
  type: 'equal' | 'delete' | 'insert' | 'replace';
  value: string;
  oldValue?: string;
  newValue?: string;
}

/**
 * Myers diff algorithm for word-level comparison
 */
function myersDiff(oldWords: string[], newWords: string[]): DiffChange[] {
  const m = oldWords.length;
  const n = newWords.length;
  const changes: DiffChange[] = [];

  // Build edit graph
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build changes
  let i = m,
    j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      changes.unshift({ type: 'equal', value: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      changes.unshift({ type: 'insert', value: newWords[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
      changes.unshift({ type: 'delete', value: oldWords[i - 1] });
      i--;
    }
  }

  // Merge consecutive delete+insert into replace for better char-level diff
  const merged: DiffChange[] = [];
  for (let k = 0; k < changes.length; k++) {
    const curr = changes[k];
    const next = changes[k + 1] as DiffChange | undefined;

    if (
      curr.type === 'delete' &&
      next?.type === 'insert' &&
      !/\s/.test(curr.value) &&
      !/\s/.test(next.value)
    ) {
      // Both are non-whitespace words, treat as replacement
      merged.push({
        type: 'replace',
        value: '',
        oldValue: curr.value,
        newValue: next.value,
      });
      k++; // Skip next
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

interface CharDiff {
  old: string[];
  new: string[];
}

/**
 * Character-level diff for highlighting within changed words
 */
function characterDiff(oldWord: string, newWord: string): CharDiff {
  const oldChars = oldWord.split('');
  const newChars = newWord.split('');

  const m = oldChars.length;
  const n = newChars.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldChars[i - 1] === newChars[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const oldResult: string[] = [];
  const newResult: string[] = [];

  let i = m,
    j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldChars[i - 1] === newChars[j - 1]) {
      oldResult.unshift(escapeHtml(oldChars[i - 1]));
      newResult.unshift(escapeHtml(newChars[j - 1]));
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      newResult.unshift(`<mark class="diff-char-insert">${escapeHtml(newChars[j - 1])}</mark>`);
      j--;
    } else if (i > 0) {
      oldResult.unshift(`<mark class="diff-char-delete">${escapeHtml(oldChars[i - 1])}</mark>`);
      i--;
    }
  }

  return { old: oldResult, new: newResult };
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Render diff parts with highlighting
 */
function renderDiffParts(parts: DiffPart[]): string {
  return parts
    .map((part) => {
      if (part.type === 'equal') {
        return escapeHtml(part.value);
      } else if (part.type === 'delete') {
        if (part.charDiff) {
          // Has character-level diff, use it (already HTML-escaped in characterDiff)
          return `<mark class="diff-delete">${part.charDiff.join('')}</mark>`;
        } else {
          // No character-level diff, highlight entire part
          return `<mark class="diff-delete">${escapeHtml(part.value)}</mark>`;
        }
      } else {
        if (part.charDiff) {
          // Has character-level diff, use it (already HTML-escaped in characterDiff)
          return `<mark class="diff-insert">${part.charDiff.join('')}</mark>`;
        } else {
          // No character-level diff, highlight entire part
          return `<mark class="diff-insert">${escapeHtml(part.value)}</mark>`;
        }
      }
    })
    .join('');
}

/**
 * DiffViewer component for displaying field-level differences
 * Supports side-by-side (desktop) and inline (mobile) modes
 */
export class DiffViewer {
  private container: HTMLElement;
  private options: DiffViewerOptions;

  constructor(container: HTMLElement, options: DiffViewerOptions) {
    this.container = container;
    this.options = options;
    this.render();
  }

  public setMode(mode: DiffMode): void {
    this.options.mode = mode;
    this.render();
  }

  public updateFields(fields: FieldDiff[]): void {
    this.options.fields = fields;
    this.render();
  }

  private render(): void {
    const conflictCount = this.options.fields.filter((f) => f.hasConflict).length;
    const noConflicts = conflictCount === 0;

    this.container.innerHTML = `
      <div class="diff-viewer" data-mode="${this.options.mode}">
        <div class="diff-header">
          <span class="diff-conflict-count">
            ${
              noConflicts
                ? `✅ ${i18n.t('diff.noConflicts')}`
                : `⚠️ ${i18n.t('diff.conflictCount', { count: conflictCount })}`
            }
          </span>
          <div class="diff-mode-toggle">
            <button
              class="diff-mode-btn ${this.options.mode === 'side-by-side' ? 'active' : ''}"
              data-mode="side-by-side"
              title="${i18n.t('diff.sideBySide')}"
            >
              <span class="diff-mode-icon">⬌</span>
            </button>
            <button
              class="diff-mode-btn ${this.options.mode === 'inline' ? 'active' : ''}"
              data-mode="inline"
              title="${i18n.t('diff.inline')}"
            >
              <span class="diff-mode-icon">☰</span>
            </button>
          </div>
        </div>

        <div class="diff-body">
          ${this.options.mode === 'side-by-side' ? this.renderSideBySide() : this.renderInline()}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private renderSideBySide(): string {
    return `
      <div class="diff-side-by-side">
        <div class="diff-column diff-local">
          <div class="diff-column-header">📍 ${i18n.t('diff.localVersion')}</div>
          ${this.options.fields
            .map((field) => {
              const diff = field.hasConflict ? computeDiff(field.local, field.imported) : null;

              const localValue = field.local
                ? diff
                  ? renderDiffParts(diff.old)
                  : escapeHtml(field.local)
                : `<span class="diff-empty">${i18n.t('diff.empty')}</span>`;

              return `
                <div class="diff-field ${field.hasConflict ? 'diff-conflict' : ''}">
                  <div class="diff-field-label">${field.label}</div>
                  <div class="diff-field-value">${localValue}</div>
                </div>
              `;
            })
            .join('')}
        </div>

        <div class="diff-column diff-imported">
          <div class="diff-column-header">📥 ${i18n.t('diff.importedVersion')}</div>
          ${this.options.fields
            .map((field) => {
              const diff = field.hasConflict ? computeDiff(field.local, field.imported) : null;

              const importedValue = field.imported
                ? diff
                  ? renderDiffParts(diff.new)
                  : escapeHtml(field.imported)
                : `<span class="diff-empty">${i18n.t('diff.empty')}</span>`;

              return `
                <div class="diff-field ${field.hasConflict ? 'diff-conflict' : ''}">
                  <div class="diff-field-label">${field.label}</div>
                  <div class="diff-field-value">${importedValue}</div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  private renderInline(): string {
    return `
      <div class="diff-inline">
        ${this.options.fields
          .map((field) => {
            const diff = field.hasConflict ? computeDiff(field.local, field.imported) : null;

            const localValue = field.local
              ? diff
                ? renderDiffParts(diff.old)
                : escapeHtml(field.local)
              : `<span class="diff-empty">${i18n.t('diff.empty')}</span>`;

            const importedValue = field.imported
              ? diff
                ? renderDiffParts(diff.new)
                : escapeHtml(field.imported)
              : `<span class="diff-empty">${i18n.t('diff.empty')}</span>`;

            // GitHub-style inline: show conflict as two lines (delete + insert)
            if (field.hasConflict) {
              return `
                <div class="diff-field diff-conflict">
                  <div class="diff-field-label">${field.label}</div>
                  <div class="diff-inline-line diff-inline-delete">
                    <span class="diff-inline-marker">📍</span>
                    <span class="diff-inline-content">${localValue}</span>
                  </div>
                  <div class="diff-inline-line diff-inline-insert">
                    <span class="diff-inline-marker">📥</span>
                    <span class="diff-inline-content">${importedValue}</span>
                  </div>
                </div>
              `;
            } else {
              // No conflict: show as single line
              const value =
                field.local ||
                field.imported ||
                `<span class="diff-empty">${i18n.t('diff.empty')}</span>`;
              return `
                <div class="diff-field">
                  <div class="diff-field-label">${field.label}</div>
                  <div class="diff-inline-line diff-inline-equal">
                    <span class="diff-inline-marker"> </span>
                    <span class="diff-inline-content">${escapeHtml(value)}</span>
                  </div>
                </div>
              `;
            }
          })
          .join('')}
      </div>
    `;
  }

  private attachEventListeners(): void {
    const modeButtons = this.container.querySelectorAll('.diff-mode-btn');
    modeButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const newMode = target.dataset.mode as DiffMode;
        this.setMode(newMode);
        this.options.onModeToggle?.(newMode);
      });
    });
  }
}
