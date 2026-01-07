import { GOOGLE_DRIVE_CLIENT_ID } from '../config';
import {
  exportFullBackupZip,
  exportMetadataBackupJson,
  importFullBackupZip,
  importMetadataBackupJson,
  type BackupErrorCode,
} from '../modules/backup';
import { downloadBytes, downloadFile } from '../modules/export';
import {
  DEFAULT_DRIVE_BACKUP_NAME,
  downloadLatestFullBackupFromDrive,
  requestAccessToken,
  syncFullBackupToDrive,
} from '../modules/google-drive';
import { i18n } from '../modules/i18n';
import { storage } from '../modules/storage';

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
            <h3>${i18n.t('dataManagement.googleDrive.title')}</h3>
            <p class="help-text">${i18n.t('dataManagement.googleDrive.description')}</p>
            <button id="btn-google-drive-connect" class="btn-full">${i18n.t('dataManagement.googleDrive.connect')}</button>
            <button id="btn-google-drive-backup" class="btn-full">${i18n.t('dataManagement.googleDrive.sync')}</button>
            <button id="btn-google-drive-restore" class="btn-full btn-danger">${i18n.t('dataManagement.googleDrive.restore')}</button>
            <p id="google-drive-status" class="help-text" style="margin-top: var(--spacing-sm);"></p>
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

    const driveConnectButton = this.modalElement?.querySelector<HTMLButtonElement>(
      '#btn-google-drive-connect'
    );
    const driveBackupButton = this.modalElement?.querySelector<HTMLButtonElement>(
      '#btn-google-drive-backup'
    );
    const driveRestoreButton = this.modalElement?.querySelector<HTMLButtonElement>(
      '#btn-google-drive-restore'
    );
    const driveStatus = this.modalElement?.querySelector<HTMLElement>('#google-drive-status');

    const setDriveStatus = (text: string) => {
      if (driveStatus) {
        driveStatus.textContent = text;
      }
    };

    const setDriveButtonsDisabled = (disabled: boolean) => {
      if (driveConnectButton) driveConnectButton.disabled = disabled;
      if (driveBackupButton) driveBackupButton.disabled = disabled;
      if (driveRestoreButton) driveRestoreButton.disabled = disabled;
    };

    const formatTimestamp = (timestamp: number) => new Date(timestamp).toLocaleString();
    const isMissingClientIdError = (error: unknown) =>
      error instanceof Error && error.message === 'missing-client-id';
    const isNoBackupFoundError = (error: unknown) =>
      error instanceof Error && error.message === 'no-backup-found';

    const refreshDriveStatus = async () => {
      const state = await storage.getGoogleDriveSyncState();
      if (state?.lastSyncAt) {
        setDriveStatus(
          i18n.t('dataManagement.googleDrive.status.lastSync', {
            time: formatTimestamp(state.lastSyncAt),
          })
        );
        return;
      }
      setDriveStatus(i18n.t('dataManagement.googleDrive.status.disconnected'));
    };

    if (!GOOGLE_DRIVE_CLIENT_ID) {
      setDriveStatus(i18n.t('dataManagement.googleDrive.status.missingClientId'));
      setDriveButtonsDisabled(true);
      return;
    }

    void refreshDriveStatus();

    driveConnectButton?.addEventListener('click', () => {
      void (async () => {
        setDriveButtonsDisabled(true);
        try {
          await requestAccessToken({ prompt: 'consent' });
          setDriveStatus(i18n.t('dataManagement.googleDrive.status.connected'));
        } catch (error) {
          console.error('Google Drive auth failed:', error);
          alert(i18n.t('dataManagement.googleDrive.error.authFailed'));
        } finally {
          setDriveButtonsDisabled(false);
        }
      })();
    });

    driveBackupButton?.addEventListener('click', () => {
      void (async () => {
        setDriveButtonsDisabled(true);
        try {
          const zipBytes = await exportFullBackupZip();
          const state = await storage.getGoogleDriveSyncState();
          const result = await syncFullBackupToDrive(zipBytes, {
            fileId: state?.fileId,
            fileName: DEFAULT_DRIVE_BACKUP_NAME,
          });
          await storage.setGoogleDriveSyncState({
            fileId: result.fileId,
            lastSyncAt: Date.now(),
          });
          await refreshDriveStatus();
          alert(i18n.t('dataManagement.googleDrive.syncSuccess'));
        } catch (error) {
          if (isMissingClientIdError(error)) {
            alert(i18n.t('dataManagement.googleDrive.status.missingClientId'));
          } else {
            console.error('Google Drive sync failed:', error);
            alert(i18n.t('dataManagement.googleDrive.error.syncFailed'));
          }
        } finally {
          setDriveButtonsDisabled(false);
        }
      })();
    });

    driveRestoreButton?.addEventListener('click', () => {
      void (async () => {
        if (!confirm(i18n.t('confirm.restoreFull'))) {
          return;
        }

        setDriveButtonsDisabled(true);
        try {
          const state = await storage.getGoogleDriveSyncState();
          const result = await downloadLatestFullBackupFromDrive({
            fileId: state?.fileId,
            fileName: DEFAULT_DRIVE_BACKUP_NAME,
          });
          const file = new File([result.bytes.slice().buffer], DEFAULT_DRIVE_BACKUP_NAME, {
            type: 'application/zip',
          });
          const restoreResult = await importFullBackupZip(file);

          if (restoreResult.success) {
            await storage.setGoogleDriveSyncState({
              fileId: result.fileId,
              lastSyncAt: Date.now(),
            });
            alert(
              i18n.t('dataManagement.restore.success', {
                books: restoreResult.summary.books,
                lists: restoreResult.summary.bookLists,
                assets: restoreResult.summary.assets,
              })
            );
            window.location.reload();
            return;
          }

          if (restoreResult.details) {
            console.error('Google Drive restore error:', restoreResult.details);
          }
          alert(this.formatError(restoreResult.error));
        } catch (error) {
          if (isNoBackupFoundError(error)) {
            alert(i18n.t('dataManagement.googleDrive.error.noBackupFound'));
          } else if (isMissingClientIdError(error)) {
            alert(i18n.t('dataManagement.googleDrive.status.missingClientId'));
          } else {
            console.error('Google Drive restore failed:', error);
            alert(i18n.t('dataManagement.googleDrive.error.restoreFailed'));
          }
        } finally {
          setDriveButtonsDisabled(false);
        }
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
