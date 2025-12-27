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
    let lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Filter out first line if it starts with time (phone UI)
    if (lines.length > 0 && lines[0].match(/^\d{1,2}:\d{2}/)) {
      lines = lines.slice(1);
    }

    // Filter out noise
    lines = lines
      .filter((line) => !line.includes("小红书"))
      .filter((line) => !line.includes("Xiaohongshu"))
      .filter(
        (line) => !line.match(/^\d+\s*(赞|收藏|评论|like|favorite|comment)/i)
      )
      .filter((line) => !line.match(/^@/))
      .filter((line) => !line.match(/^\d+\s*分钟前/))
      .filter((line) => !line.match(/^[\d:]+$/)) // Time stamps like 12:34
      .filter((line) => !line.match(/^(上午|下午|今天|昨天)/)) // Chinese time indicators
      .filter((line) => !line.match(/^\d{1,2}:\d{2}$/)); // HH:MM format

    if (lines.length === 0) {
      return {};
    }

    // Try to extract book title with priority
    let bookTitle = "";
    let titleLineIndex = 0;

    // Priority 1: Find text with book title marks 《》 (may span multiple lines)
    const fullText = lines.join("");
    const bookMarkMatch = fullText.match(/《([^》]+)》/);
    if (bookMarkMatch) {
      bookTitle = bookMarkMatch[1].trim();

      // Find which line contains the closing 》
      for (let i = 0; i < lines.length; i++) {
        if (
          lines
            .slice(0, i + 1)
            .join("")
            .includes("》")
        ) {
          titleLineIndex = i;
          break;
        }
      }
    }

    // Priority 2: Use first line if no book marks found
    if (!bookTitle) {
      bookTitle = lines[0];
      titleLineIndex = 0;

      // Clean up hashtag if exists
      bookTitle = bookTitle.replace(/^#/, "").trim();
    }

    // Remove unnecessary spaces in book title
    bookTitle = this.cleanSpaces(bookTitle);

    // Extract recommendation (remaining text after title)
    const recommendation = lines
      .slice(titleLineIndex + 1)
      .join("\n")
      .trim();

    return {
      bookTitle: bookTitle || undefined,
      recommendation: recommendation || undefined
    };
  }

  /**
   * Remove spaces between Chinese characters, keep spaces around English words
   */
  private cleanSpaces(text: string): string {
    // Remove spaces between Chinese characters
    return text.replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, "$1$2");
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
