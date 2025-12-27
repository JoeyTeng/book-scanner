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
   * Check if LLM is configured
   */
  isConfigured(): boolean {
    const endpoint = storage.getLLMApiEndpoint();
    const apiKey = storage.getLLMApiKey();
    return !!(endpoint && apiKey);
  }

  /**
   * Parse book information from arbitrary text using LLM
   */
  async parseBookInfo(text: string): Promise<ParsedBookInfo | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const endpoint = storage.getLLMApiEndpoint()!;
    const apiKey = storage.getLLMApiKey()!;
    const model = storage.getLLMModel() || 'gpt-4o-mini';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{
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

If a field is not found, use empty string. Always include all fields.`
          }, {
            role: 'user',
            content: `Extract book information from this text:\n\n${text}`
          }],
          response_format: { type: 'json_object' },
          temperature: 0.3
        })
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
      Object.keys(parsed).forEach(key => {
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
   * Get LLM status for UI display
   */
  getStatus(): { configured: boolean; endpoint?: string; model?: string } {
    const configured = this.isConfigured();
    return {
      configured,
      endpoint: configured ? storage.getLLMApiEndpoint() : undefined,
      model: configured ? storage.getLLMModel() || 'gpt-4o-mini' : undefined
    };
  }
}

export const llmService = new LLMService();
