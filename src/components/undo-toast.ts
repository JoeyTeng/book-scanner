import { i18n } from '../modules/i18n';

/**
 * Persistent dismissible toast component for undo operations
 * Inspired by Google Drive's undo mechanism
 *
 * Features:
 * - Fixed position at top of page
 * - Manual dismiss only (no auto-hide)
 * - Separated Undo and Dismiss buttons to prevent mis-clicks
 * - Reusable for any undo operation
 */
export class UndoToast {
  private element: HTMLDivElement;
  private onUndo: () => void;
  private onDismiss: () => void;

  constructor(message: string, onUndo: () => void, onDismiss?: () => void) {
    this.onUndo = onUndo;
    this.onDismiss = onDismiss || (() => this.hide());
    this.element = this.createToastElement(message);
    this.attachEventListeners();
  }

  private createToastElement(message: string): HTMLDivElement {
    const toast = document.createElement('div');
    toast.className = 'undo-toast';
    toast.innerHTML = `
      <div class="undo-toast-content">
        <span class="undo-toast-icon">✅</span>
        <span class="undo-toast-message">${this.escapeHtml(message)}</span>
      </div>
      <div class="undo-toast-actions">
        <button class="btn-undo">${i18n.t('common.undo')}</button>
        <button class="btn-dismiss" title="${i18n.t('common.dismiss')}">✕</button>
      </div>
    `;
    return toast;
  }

  private attachEventListeners(): void {
    const undoBtn = this.element.querySelector('.btn-undo');
    const dismissBtn = this.element.querySelector('.btn-dismiss');

    undoBtn?.addEventListener('click', () => {
      this.onUndo();
      this.hide();
    });

    dismissBtn?.addEventListener('click', () => {
      this.onDismiss();
    });
  }

  public show(): void {
    // Remove any existing toast
    const existing = document.querySelector('.undo-toast');
    if (existing) {
      existing.remove();
    }

    // Add to body at top
    document.body.insertBefore(this.element, document.body.firstChild);

    // Trigger animation
    requestAnimationFrame(() => {
      this.element.classList.add('visible');
    });
  }

  public hide(): void {
    this.element.classList.remove('visible');
    setTimeout(() => {
      this.element.remove();
    }, 300); // Match CSS transition duration
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
