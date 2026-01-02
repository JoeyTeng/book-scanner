import { Html5Qrcode } from 'html5-qrcode';
import { BARCODE_FORMATS } from '../config';

export class BarcodeScanner {
  private html5QrCode: Html5Qrcode | null = null;
  private isScanning = false;
  private availableCameras: { id: string; label: string }[] = [];

  /**
   * Get available cameras
   */
  async getCameras(): Promise<{ id: string; label: string }[]> {
    try {
      const devices = await Html5Qrcode.getCameras();
      this.availableCameras = devices.map((device) => ({
        id: device.id,
        label: device.label || `Camera ${device.id.substring(0, 8)}`,
      }));
      return this.availableCameras;
    } catch (error) {
      console.error('Failed to get cameras:', error);
      return [];
    }
  }

  /**
   * Start scanning
   */
  async start(
    elementId: string,
    onSuccess: (decodedText: string) => void,
    onError?: (error: string) => void,
    cameraId?: string
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
        disableFlip: false,
      };

      // Use specific camera ID if provided, otherwise use environment-facing camera
      const cameraConstraints: MediaTrackConstraints = cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: 'environment' };

      await this.html5QrCode.start(
        cameraConstraints,
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
      void this.applyAdvancedConstraints();
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
      type ExtendedMediaTrackCapabilities = MediaTrackCapabilities & {
        focusMode?: string[];
        focusDistance?: { min?: number; max?: number };
        width?: { min?: number; max?: number };
        height?: { min?: number; max?: number };
      };
      const capabilities: ExtendedMediaTrackCapabilities = videoTrack.getCapabilities();
      const constraints: MediaTrackConstraints & {
        focusMode?: string;
        focusDistance?: number;
      } = {};

      // Enable autofocus if supported
      if (capabilities.focusMode?.includes('continuous')) {
        constraints.focusMode = 'continuous';
      }

      // Enable macro/close-up mode if supported (iPhone 13 Pro and later)
      if (capabilities.focusDistance?.min !== undefined) {
        constraints.focusDistance = capabilities.focusDistance.min || 0.1;
      }

      // Request higher resolution
      if (capabilities.width?.max !== undefined && capabilities.height?.max !== undefined) {
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
