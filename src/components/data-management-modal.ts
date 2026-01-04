import {
  exportFullBackupZip,
  exportMetadataBackupJson,
  importFullBackupZip,
  importMetadataBackupJson,
  type BackupErrorCode,
} from '../modules/backup';
import { downloadBytes, downloadFile } from '../modules/export';
import { i18n } from '../modules/i18n';

export class DataManagementModal {
  private modalElement: HTMLDivElement | null = null;

  show(): void {
    if (this.modalElement) return;
    this.render();
  }

  private hide(): void {
    if (!this.modalElement) return;
    this.modalElement.remove();
    this.modalElement = null;
    document.body.style.overflow = '';
  }

  private render(): void {
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal';
    this.modalElement.innerHTML = `
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>${i18n.t('dataManagement.title')}</h2>
          <button class="btn-close" id="btn-close-data-management" aria-label="${i18n.t('common.close')}">&times;</button>
        </div>
        <div class="modal-body">
          <div class="menu-section">
            <h3>${i18n.t('dataManagement.metadata.title')}</h3>
            <p class="help-text">${i18n.t('dataManagement.metadata.description')}</p>
            <button id="btn-backup-metadata" class="btn-full">${i18n.t('dataManagement.metadata.backup')}</button>
            <button id="btn-restore-metadata" class="btn-full btn-danger">${i18n.t('dataManagement.metadata.restore')}</button>
            <input type="file" id="file-restore-metadata" accept=".json" style="display: none;">
            <button class="btn-full" disabled>${i18n.t('dataManagement.mergeTodo')}</button>
            <p class="hint-text">${i18n.t('dataManagement.mergeHint')}</p>
          </div>

          <div class="menu-section">
            <h3>${i18n.t('dataManagement.full.title')}</h3>
            <p class="help-text">${i18n.t('dataManagement.full.description')}</p>
            <button id="btn-backup-full" class="btn-full">${i18n.t('dataManagement.full.backup')}</button>
            <button id="btn-restore-full" class="btn-full btn-danger">${i18n.t('dataManagement.full.restore')}</button>
            <input type="file" id="file-restore-full" accept=".zip" style="display: none;">
            <div class="warning-box" style="margin-top: var(--spacing-md);">
              <strong>${i18n.t('dataManagement.restore.warningTitle')}</strong>
              <p style="margin: 0;">${i18n.t('dataManagement.restore.warningBody')}</p>
            </div>
          </div>

          <div class="menu-section">
            <h3>${i18n.t('dataManagement.future.title')}</h3>
            <p class="help-text">${i18n.t('dataManagement.future.description')}</p>
            <button class="btn-full" disabled>${i18n.t('dataManagement.future.zotero')}</button>
            <button class="btn-full" disabled>${i18n.t('dataManagement.future.googleDrive')}</button>
            <button class="btn-full" disabled>${i18n.t('dataManagement.future.github')}</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-container')?.appendChild(this.modalElement);
    this.modalElement.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    this.modalElement
      ?.querySelector('#btn-close-data-management')
      ?.addEventListener('click', () => {
        this.hide();
      });

    this.modalElement?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) {
        this.hide();
      }
    });

    this.modalElement?.querySelector('#btn-backup-metadata')?.addEventListener('click', () => {
      void (async () => {
        try {
          const json = await exportMetadataBackupJson();
          downloadFile(json, `book-scanner-metadata-backup-${Date.now()}.json`, 'application/json');
          this.hide();
        } catch (error) {
          console.error('Metadata backup failed:', error);
          alert(i18n.t('dataManagement.backup.failed'));
        }
      })();
    });

    const metadataInput =
      this.modalElement?.querySelector<HTMLInputElement>('#file-restore-metadata');

    this.modalElement?.querySelector('#btn-restore-metadata')?.addEventListener('click', () => {
      if (!confirm(i18n.t('confirm.restoreMetadata'))) {
        return;
      }
      metadataInput?.click();
    });

    metadataInput?.addEventListener('change', (e) => {
      void (async () => {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        const result = await importMetadataBackupJson(file);
        if (result.success) {
          alert(
            i18n.t('dataManagement.restore.success', {
              books: result.summary.books,
              lists: result.summary.bookLists,
              assets: result.summary.assets,
            })
          );
          window.location.reload();
          return;
        }

        if (result.details) {
          console.error('Metadata restore error:', result.details);
        }
        alert(this.formatError(result.error));
        input.value = '';
      })();
    });

    this.modalElement?.querySelector('#btn-backup-full')?.addEventListener('click', () => {
      void (async () => {
        try {
          const zipBytes = await exportFullBackupZip();
          downloadBytes(zipBytes, `book-scanner-full-backup-${Date.now()}.zip`, 'application/zip');
          this.hide();
        } catch (error) {
          console.error('Full backup failed:', error);
          alert(i18n.t('dataManagement.backup.failed'));
        }
      })();
    });

    const fullInput = this.modalElement?.querySelector<HTMLInputElement>('#file-restore-full');

    this.modalElement?.querySelector('#btn-restore-full')?.addEventListener('click', () => {
      if (!confirm(i18n.t('confirm.restoreFull'))) {
        return;
      }
      fullInput?.click();
    });

    fullInput?.addEventListener('change', (e) => {
      void (async () => {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        const result = await importFullBackupZip(file);
        if (result.success) {
          alert(
            i18n.t('dataManagement.restore.success', {
              books: result.summary.books,
              lists: result.summary.bookLists,
              assets: result.summary.assets,
            })
          );
          window.location.reload();
          return;
        }

        if (result.details) {
          console.error('Full restore error:', result.details);
        }
        alert(this.formatError(result.error));
        input.value = '';
      })();
    });
  }

  private formatError(error: BackupErrorCode): string {
    const mapping: Record<BackupErrorCode, string> = {
      'invalid-json': i18n.t('dataManagement.error.invalidJson'),
      'invalid-structure': i18n.t('dataManagement.error.invalidStructure'),
      'unsupported-schema': i18n.t('dataManagement.error.unsupportedSchema'),
      'invalid-format': i18n.t('dataManagement.error.invalidFormat'),
      'checksum-mismatch': i18n.t('dataManagement.error.checksumMismatch'),
      'assets-missing': i18n.t('dataManagement.error.assetsMissing'),
      'assets-hash-mismatch': i18n.t('dataManagement.error.assetsHashMismatch'),
      'assets-checksum-mismatch': i18n.t('dataManagement.error.assetsChecksumMismatch'),
      'archive-missing': i18n.t('dataManagement.error.archiveMissing'),
      'archive-invalid': i18n.t('dataManagement.error.archiveInvalid'),
      'restore-failed': i18n.t('dataManagement.error.restoreFailed'),
    };

    return mapping[error];
  }
}
