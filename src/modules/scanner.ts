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
        formatsToSupport: BARCODE_FORMATS,
        // Additional configuration for better scanning
        aspectRatio: 1.0,
        disableFlip: false
      };

      // Advanced camera constraints for better focus and resolution
      const cameraConstraints = {
        facingMode: 'environment',
        advanced: [
          // Request autofocus with continuous mode
          { focusMode: 'continuous' },
          // Enable torch/flash if available
          { torch: false },
          // Request higher resolution for better barcode detection
          { width: { min: 1280, ideal: 1920, max: 3840 } },
          { height: { min: 720, ideal: 1080, max: 2160 } },
          // Enable zoom capabilities
          { zoom: { ideal: 1.0 } }
        ]
      };

      await this.html5QrCode.start(
        cameraConstraints as any,
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

      // Try to apply additional constraints after camera starts
      // This helps with macro/close-up focus on iPhone
      this.applyAdvancedConstraints();
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
   * Apply advanced camera constraints for better close-up focus
   * Particularly helpful for iPhone macro mode
   */
  private async applyAdvancedConstraints(): Promise<void> {
    try {
      // Get the video element created by html5-qrcode
      const videoElement = document.querySelector('#scanner-reader video') as HTMLVideoElement;
      
      if (!videoElement || !videoElement.srcObject) {
        return;
      }

      const stream = videoElement.srcObject as MediaStream;
      const videoTrack = stream.getVideoTracks()[0];

      if (!videoTrack) {
        return;
      }

      // Get supported capabilities
      const capabilities = videoTrack.getCapabilities() as any;
      const constraints: any = {};

      // Enable autofocus if supported
      if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        constraints.focusMode = 'continuous';
      }

      // Enable macro/close-up mode if supported (iPhone 13 Pro and later)
      if (capabilities.focusDistance) {
        constraints.focusDistance = capabilities.focusDistance.min || 0.1;
      }

      // Request higher resolution
      if (capabilities.width && capabilities.height) {
        constraints.width = { ideal: capabilities.width.max || 1920 };
        constraints.height = { ideal: capabilities.height.max || 1080 };
      }

      // Apply constraints
      if (Object.keys(constraints).length > 0) {
        await videoTrack.applyConstraints(constraints);
        console.log('Applied advanced camera constraints:', constraints);
      }
    } catch (error) {
      // Not critical if this fails, scanner can still work
      console.debug('Could not apply advanced constraints:', error);
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
