import { Html5Qrcode } from 'html5-qrcode';
import { BARCODE_FORMATS } from '../config';

export class BarcodeScanner {
  private html5QrCode: Html5Qrcode | null = null;
  private isScanning = false;

  /**
   * Start scanning
   */
  async start(
    elementId: string,
    onSuccess: (decodedText: string) => void,
    onError?: (error: string) => void
  ): Promise<void> {
    if (this.isScanning) {
      console.warn('Scanner is already running');
      return;
    }

    try {
      this.html5QrCode = new Html5Qrcode(elementId);

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        formatsToSupport: BARCODE_FORMATS
      };

      await this.html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          onSuccess(decodedText);
        },
        (errorMessage) => {
          // Ignore common scanning errors (too noisy)
          if (!errorMessage.includes('No MultiFormat Readers')) {
            console.debug('Scan error:', errorMessage);
          }
        }
      );

      this.isScanning = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start scanner';
      console.error('Scanner error:', error);
      if (onError) {
        onError(message);
      }
      throw error;
    }
  }

  /**
   * Stop scanning
   */
  async stop(): Promise<void> {
    if (!this.html5QrCode || !this.isScanning) {
      return;
    }

    try {
      await this.html5QrCode.stop();
      this.html5QrCode.clear();
      this.isScanning = false;
    } catch (error) {
      console.error('Failed to stop scanner:', error);
    }
  }

  /**
   * Check if scanner is running
   */
  getIsScanning(): boolean {
    return this.isScanning;
  }
}
