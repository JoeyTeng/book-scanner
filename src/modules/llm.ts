import { storage } from './storage';

export interface ParsedBookInfo {
  isbn?: string;
  title?: string;
  author?: string;
  publisher?: string;
  publishDate?: string;
  cover?: string;
  notes?: string;
  confidence?: number;
}

export class LLMService {
  /**
   * Check if LLM Vision is configured
   */
  async isConfigured(): Promise<boolean> {
    const endpoint = await storage.getLLMApiEndpoint();
    const apiKey = await storage.getLLMApiKey();
    return !!(endpoint && apiKey);
  }

  /**
   * Check if LLM Text parsing is configured
   */
  async isTextConfigured(): Promise<boolean> {
    // Check if dedicated text API is configured
    const textEndpoint = await storage.getLLMTextApiEndpoint();
    const textApiKey = await storage.getLLMTextApiKey();
    if (textEndpoint && textApiKey) {
      return true;
    }
    // Fallback to main API
    return this.isConfigured();
  }

  /**
   * Parse book information from arbitrary text using LLM
   */
  async parseBookInfo(text: string): Promise<ParsedBookInfo | null> {
    if (!(await this.isTextConfigured())) {
      return null;
    }

    // Use dedicated text API if configured, otherwise fallback to main API
    const endpoint = (await storage.getLLMTextApiEndpoint()) || (await storage.getLLMApiEndpoint());
    const apiKey = (await storage.getLLMTextApiKey()) || (await storage.getLLMApiKey());
    const model =
      (await storage.getLLMTextModel()) || (await storage.getLLMModel()) || 'gpt-4o-mini';

    if (!endpoint || !apiKey) {
      return null;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: `You are a book information extraction assistant. Extract book metadata from any text format (Douban, Amazon, WeChat Read, Xiaohongshu, etc.).

Return ONLY valid JSON with this exact structure (no markdown, no explanations):
{
  "isbn": "ISBN if found, otherwise empty string",
  "title": "Book title (cleaned, no emoji, no brackets)",
  "author": "Author name(s)",
  "publisher": "Publisher name if available",
  "publishDate": "Publication date if available (YYYY or YYYY-MM-DD format)",
  "cover": "Cover image URL if available",
  "notes": "Brief summary or description if available",
  "confidence": 0.95
}

If a field is not found, use empty string. Always include all fields.`,
            },
            {
              role: 'user',
              content: `Extract book information from this text:\n\n${text}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('LLM API error:', response.status, errorText);
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        console.error('No content in LLM response');
        return null;
      }

      const parsed = JSON.parse(content) as ParsedBookInfo;

      // Clean up empty strings
      Object.keys(parsed).forEach((key) => {
        if (parsed[key as keyof ParsedBookInfo] === '') {
          delete parsed[key as keyof ParsedBookInfo];
        }
      });

      return parsed;
    } catch (error) {
      console.error('Failed to parse book info with LLM:', error);
      return null;
    }
  }

  /**
   * Extract multiple books from an image using Vision API
   */
  async parseBooksFromImage(imageFile: File): Promise<ParsedBookInfo[] | null> {
    if (!(await this.isConfigured())) {
      return null;
    }

    const endpoint = await storage.getLLMApiEndpoint();
    const apiKey = await storage.getLLMApiKey();
    const model = (await storage.getLLMModel()) || 'gpt-4o-mini';

    if (!endpoint || !apiKey) {
      return null;
    }

    try {
      // Convert image to base64
      const base64Image = await this.fileToBase64(imageFile);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: `You are a book information extraction assistant. Extract ALL book metadata from images (screenshots from Douban, Amazon, WeChat Read, Xiaohongshu, etc.).

Return ONLY valid JSON with this exact structure (no markdown, no explanations):
{
  "books": [
    {
      "isbn": "ISBN if visible, otherwise empty string",
      "title": "Book title (cleaned, no emoji, no brackets)",
      "author": "Author name(s)",
      "publisher": "Publisher if visible",
      "publishDate": "Publication date if visible (YYYY or YYYY-MM-DD)",
      "cover": "empty string (we'll use API to fetch cover)",
      "notes": "Brief recommendation or description from the image",
      "confidence": 0.95
    }
  ]
}

Extract EVERY book mentioned or shown in the image. If a field is not visible, use empty string. Always include all fields for each book.`,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract information for ALL books shown in this image:',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: base64Image,
                  },
                },
              ],
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('LLM Vision API error:', response.status, errorText);
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        console.error('No content in Vision API response');
        return null;
      }

      const parsed = JSON.parse(content) as { books: ParsedBookInfo[] };

      if (!parsed.books || !Array.isArray(parsed.books)) {
        console.error('Invalid response format from Vision API');
        return null;
      }

      // Clean up empty strings in each book
      parsed.books.forEach((book) => {
        Object.keys(book).forEach((key) => {
          if (book[key as keyof ParsedBookInfo] === '') {
            delete book[key as keyof ParsedBookInfo];
          }
        });
      });

      return parsed.books;
    } catch (error) {
      console.error('Failed to parse books from image with Vision API:', error);
      return null;
    }
  }

  /**
   * Convert File to base64 data URL
   */
  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get LLM status for UI display
   */
  async getStatus(): Promise<{ configured: boolean; endpoint?: string; model?: string }> {
    const configured = await this.isConfigured();
    return {
      configured,
      endpoint: configured ? await storage.getLLMApiEndpoint() : undefined,
      model: configured ? (await storage.getLLMModel()) || 'gpt-4o-mini' : undefined,
    };
  }
}

export const llmService = new LLMService();
