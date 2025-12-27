import { BarcodeScanner } from '../modules/scanner';
import { normalizeISBN } from '../utils/isbn';

export class ScannerModal {
  private scanner: BarcodeScanner;
  private modalElement: HTMLDivElement | null = null;
  private onScanSuccess: (isbn: string) => void;

  constructor(onScanSuccess: (isbn: string) => void) {
    this.scanner = new BarcodeScanner();
    this.onScanSuccess = onScanSuccess;
  }

  async show(onOCRClick?: () => void): Promise<void> {
    // Create modal
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal';
    this.modalElement.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Scan Barcode</h2>
          <button class="btn-close" id="btn-close-scanner" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <div id="scanner-reader" style="width: 100%;"></div>
          <div class="scanner-tips">
            <p>Position the barcode in the center of the frame</p>
            <p>Or enter ISBN manually:</p>
            <input type="text" id="manual-isbn" class="input-full" placeholder="Enter ISBN">
            <div class="scanner-actions">
              <button id="btn-manual-submit" class="btn-primary">Submit</button>
              <button id="btn-ocr-scan" class="btn btn-secondary">📸 Recognize Screenshot</button>
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
      this.hide();
    });

    this.modalElement.querySelector('#btn-manual-submit')?.addEventListener('click', () => {
      const input = this.modalElement?.querySelector('#manual-isbn') as HTMLInputElement;
      const isbn = input.value.trim();
      if (isbn) {
        this.handleScanSuccess(isbn);
      }
    });

    // OCR button
    if (onOCRClick) {
      this.modalElement.querySelector('#btn-ocr-scan')?.addEventListener('click', () => {
        this.hide();
        onOCRClick();
      });
    }

    this.modalElement.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('modal')) {
        this.hide();
      }
    });

    // Start scanner
    try {
      await this.scanner.start(
        'scanner-reader',
        (decodedText) => {
          this.handleScanSuccess(decodedText);
        },
        (error) => {
          console.error('Scanner error:', error);
          alert(`Camera error: ${error}`);
        }
      );
    } catch (error) {
      console.error('Failed to start scanner:', error);
      alert('Failed to access camera. Please check permissions.');
    }
  }

  private handleScanSuccess(isbn: string): void {
    const normalized = normalizeISBN(isbn);
    this.hide();
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
