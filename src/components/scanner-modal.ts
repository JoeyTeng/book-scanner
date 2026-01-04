import { i18n } from '../modules/i18n';
import { BarcodeScanner } from '../modules/scanner';
import { normalizeISBN } from '../utils/isbn';

export class ScannerModal {
  private scanner: BarcodeScanner;
  private modalElement: HTMLDivElement | null = null;
  private onScanSuccess: (isbn: string) => void;
  private onTitleSearch?: (title: string) => void;
  private cameras: { id: string; label: string }[] = [];
  private selectedCameraId?: string;

  constructor(onScanSuccess: (isbn: string) => void) {
    this.scanner = new BarcodeScanner();
    this.onScanSuccess = onScanSuccess;
  }

  async show(onOCRClick?: () => void, onTitleSearch?: (title: string) => void): Promise<void> {
    this.onTitleSearch = onTitleSearch;

    // Get available cameras
    this.cameras = await this.scanner.getCameras();

    // Create modal
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal';
    this.modalElement.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>${i18n.t('scanner.title')}</h2>
          <button class="btn-close" id="btn-close-scanner" aria-label="${i18n.t('common.close')}">&times;</button>
        </div>
        <div class="modal-body">
          ${
            this.cameras.length > 1
              ? `
            <div class="camera-selector">
              <label for="camera-select">${i18n.t('scanner.selectCamera')}</label>
              <select id="camera-select" class="input-full">
                ${this.cameras
                  .map(
                    (cam, idx) => `
                  <option value="${cam.id}" ${idx === 0 ? 'selected' : ''}>
                    ${cam.label}
                  </option>
                `
                  )
                  .join('')}
              </select>
            </div>
          `
              : ''
          }
          <div id="scanner-reader" style="width: 100%;"></div>
          <div class="scanner-tips">
            <p>${i18n.t('scanner.tips')}</p>
            <p>${i18n.t('scanner.orEnter')}</p>
            <input type="text" id="manual-isbn" class="input-full" placeholder="${i18n.t('scanner.placeholder')}">
            <p class="hint-text">${i18n.t('scanner.hint')}</p>
            <div class="scanner-actions">
              <button id="btn-manual-submit" class="btn-primary">${i18n.t('scanner.submit')}</button>
              <button id="btn-ocr-scan" class="btn btn-secondary">${i18n.t('scanner.recognizeScreenshot')}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-container')?.appendChild(this.modalElement);
    this.modalElement.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Attach event listeners
    this.modalElement.querySelector('#btn-close-scanner')?.addEventListener('click', () => {
      void this.hide();
    });

    this.modalElement.querySelector('#btn-manual-submit')?.addEventListener('click', () => {
      const input = this.modalElement?.querySelector('#manual-isbn') as HTMLInputElement;
      const value = input.value.trim();
      if (value) {
        // Detect if input is ISBN (only digits and hyphens) or title
        if (/^[\d-]+$/.test(value)) {
          // ISBN
          this.handleScanSuccess(value);
        } else if (this.onTitleSearch) {
          // Book title
          void this.hide();
          this.onTitleSearch(value);
        } else {
          // Fallback: treat as ISBN
          this.handleScanSuccess(value);
        }
      }
    });

    // OCR button
    if (onOCRClick) {
      this.modalElement.querySelector('#btn-ocr-scan')?.addEventListener('click', () => {
        void (async () => {
          await this.hide();
          onOCRClick();
        })();
      });
    }

    // Camera selector change handler
    if (this.cameras.length > 1) {
      const cameraSelect = this.modalElement.querySelector<HTMLSelectElement>('#camera-select');
      cameraSelect?.addEventListener('change', () => {
        void (async () => {
          this.selectedCameraId = cameraSelect.value;
          await this.restartScanner();
        })();
      });
    }

    this.modalElement.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) {
        void this.hide();
      }
    });

    // Start scanner
    await this.startScanner();
  }

  private async startScanner(): Promise<void> {
    try {
      await this.scanner.start(
        'scanner-reader',
        (decodedText) => {
          this.handleScanSuccess(decodedText);
        },
        (error) => {
          console.error('Scanner error:', error);
          alert(`Camera error: ${error}`);
        },
        this.selectedCameraId
      );
    } catch (error) {
      console.error('Failed to start scanner:', error);
      alert('Failed to access camera. Please check permissions.');
    }
  }

  private async restartScanner(): Promise<void> {
    await this.scanner.stop();
    await this.startScanner();
  }

  private handleScanSuccess(isbn: string): void {
    const normalized = normalizeISBN(isbn);
    void this.hide();
    this.onScanSuccess(normalized);
  }

  async hide(): Promise<void> {
    if (this.scanner.getIsScanning()) {
      await this.scanner.stop();
    }

    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
    }

    document.body.style.overflow = '';
  }
}
