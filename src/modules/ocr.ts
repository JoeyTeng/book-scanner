import { createWorker, Worker } from 'tesseract.js';

export interface ParsedOCRResult {
  bookTitle?: string;
  recommendation?: string;
}

export class OCRService {
  private worker: Worker | null = null;
  private isInitialized = false;

  /**
   * Initialize OCR worker
   */
  async initialize(onProgress?: (progress: number) => void): Promise<void> {
    if (this.isInitialized && this.worker) {
      return;
    }

    try {
      this.worker = await createWorker('chi_sim+eng', 1, {
        logger: (m) => {
          if (
            m.status === "loading tesseract core" ||
            m.status === "initializing tesseract" ||
            m.status === "loading language traineddata" ||
            m.status === "initializing api"
          ) {
            const progress = m.progress || 0;
            if (onProgress) {
              onProgress(progress);
            }
          }
        }
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw new Error('Failed to initialize OCR service');
    }
  }

  /**
   * Recognize text from image
   */
  async recognizeImage(
    imageFile: File,
    _onProgress?: (progress: number) => void
  ): Promise<string> {
    if (!this.worker || !this.isInitialized) {
      throw new Error('OCR worker not initialized');
    }

    try {
      const { data } = await this.worker.recognize(imageFile);

      return data.text;
    } catch (error) {
      console.error('OCR recognition error:', error);
      throw new Error('Failed to recognize text from image');
    }
  }

  /**
   * Parse Xiaohongshu screenshot content
   * Extract book title and recommendation from OCR text
   */
  parseXiaohongshuContent(text: string): ParsedOCRResult {
    // Split into lines and clean
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      // Filter out noise
      .filter(line => !line.includes('小红书'))
      .filter(line => !line.includes('Xiaohongshu'))
      .filter(line => !line.match(/^\d+\s*(赞|收藏|评论|like|favorite|comment)/i))
      .filter(line => !line.match(/^@/))
      .filter(line => !line.match(/^\d+\s*分钟前/))
      .filter(line => !line.match(/^[\d:]+$/)); // Time stamps

    if (lines.length === 0) {
      return {};
    }

    // Extract book title (first meaningful line)
    let bookTitle = lines[0];

    // Remove book title marks if exists
    if (bookTitle.includes('《') && bookTitle.includes('》')) {
      const match = bookTitle.match(/《(.+?)》/);
      if (match) {
        bookTitle = match[1];
      }
    }

    // Remove hashtag if exists
    bookTitle = bookTitle.replace(/^#/, '').trim();

    // Extract recommendation (remaining text)
    const recommendation = lines.slice(1).join('\n').trim();

    return {
      bookTitle: bookTitle || undefined,
      recommendation: recommendation || undefined
    };
  }

  /**
   * Cleanup worker
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}
