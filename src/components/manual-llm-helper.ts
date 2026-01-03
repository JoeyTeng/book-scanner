import { i18n } from '../modules/i18n';
import { ParsedBookInfo } from '../modules/llm';

interface ManualLLMConfig {
  title: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
  onResult: (result: ParsedBookInfo | ParsedBookInfo[]) => void;
}

export class ManualLLMHelper {
  private modalElement: HTMLDivElement | null = null;
  private config: ManualLLMConfig;
  private userContent: string | null = null;

  constructor(config: ManualLLMConfig) {
    this.config = config;
  }

  show(content?: string): void {
    this.userContent = content || null;
    this.render();
  }

  hide(): void {
    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
      document.body.style.overflow = '';
    }
  }

  private render(): void {
    this.modalElement = document.createElement('div');
    this.modalElement.className = 'modal';

    const promptText = this.generatePrompt();

    this.modalElement.innerHTML = `
      <div class="modal-content manual-llm-modal">
        <div class="modal-header">
          <h2>${i18n.t('manualLLM.title')}</h2>
          <button class="btn-close" id="manual-llm-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="manual-llm-steps">
            <div class="step-item">
              <div class="step-number">1</div>
              <div class="step-content">
                <h4>${i18n.t('manualLLM.step1')}</h4>
                <div class="prompt-box">
                  <pre id="manual-prompt-text">${this.escapeHtml(promptText)}</pre>
                  <button id="btn-copy-prompt" class="btn-primary btn-small">
                    ${i18n.t('manualLLM.button.copy')}
                  </button>
                </div>
              </div>
            </div>

            <div class="step-item">
              <div class="step-number">2</div>
              <div class="step-content">
                <h4>${i18n.t('manualLLM.step2')}</h4>
                <p>${i18n.t('manualLLM.step2.apps')}</p>
                <p>${i18n.t('manualLLM.step2.paste')}</p>
              </div>
            </div>

            <div class="step-item">
              <div class="step-number">3</div>
              <div class="step-content">
                <h4>${i18n.t('manualLLM.step3')}</h4>
                <p>${i18n.t('manualLLM.step3.paste')}</p>
                <textarea id="manual-result-input" class="textarea-full" rows="8"
                          placeholder='{ "isbn": "...", "title": "...", "author": "..." }'></textarea>
                <button id="btn-parse-result" class="btn-primary">
                  ${i18n.t('manualLLM.button.parse')}
                </button>
              </div>
            </div>
          </div>

          <div class="help-box">
            <h4>${i18n.t('manualLLM.tips.title')}</h4>
            <ul>
              <li>${i18n.t('manualLLM.tips.chatgpt')}</li>
              <li>${i18n.t('manualLLM.tips.claude')}</li>
              <li>${i18n.t('manualLLM.tips.other')}</li>
              <li>${i18n.t('manualLLM.tips.copyJSON')}</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-container')?.appendChild(this.modalElement);
    this.modalElement.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    this.attachEventListeners();
  }

  private generatePrompt(): string {
    let prompt = this.config.systemPrompt + '\n\n';
    prompt += this.config.userPromptTemplate.replace('{content}', this.userContent || '');
    return prompt;
  }

  private attachEventListeners(): void {
    // Close button
    this.modalElement?.querySelector('#manual-llm-close')?.addEventListener('click', () => {
      this.hide();
    });

    // Copy prompt button
    this.modalElement?.querySelector('#btn-copy-prompt')?.addEventListener('click', () => {
      void (async () => {
        const promptText =
          this.modalElement?.querySelector('#manual-prompt-text')?.textContent || '';
        try {
          await navigator.clipboard.writeText(promptText);
          const btn = this.modalElement?.querySelector('#btn-copy-prompt') as HTMLButtonElement;
          const originalText = btn.textContent;
          btn.textContent = '✅ Copied!';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        } catch (error) {
          alert('Failed to copy to clipboard. Please select and copy manually.');
        }
      })();
    });

    // Parse result button
    this.modalElement?.querySelector('#btn-parse-result')?.addEventListener('click', () => {
      this.parseResult();
    });

    // Close on backdrop click
    this.modalElement?.addEventListener('click', (e) => {
      if (e.target === this.modalElement) {
        this.hide();
      }
    });
  }

  private parseResult(): void {
    const textarea = this.modalElement?.querySelector(
      '#manual-result-input'
    ) as HTMLTextAreaElement;
    const resultText = textarea.value.trim();

    if (!resultText) {
      alert('Please paste the JSON result from your LLM.');
      return;
    }

    try {
      // Try to extract JSON from markdown code blocks if present
      let jsonText = resultText;
      const codeBlockMatch = resultText.match(/```(?:json)?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      }

      const parsed = JSON.parse(jsonText) as unknown;

      // Handle both single book and multiple books response
      let result: ParsedBookInfo | ParsedBookInfo[];

      if (this.isBookListResult(parsed)) {
        // Multiple books format
        result = parsed.books as ParsedBookInfo[];
      } else if (Array.isArray(parsed)) {
        // Array of books
        result = parsed as ParsedBookInfo[];
      } else if (this.isRecord(parsed)) {
        // Single book
        result = parsed as ParsedBookInfo;
      } else {
        throw new Error('Invalid result format');
      }

      // Clean up empty strings
      if (Array.isArray(result)) {
        result.forEach((book) => this.cleanupBook(book));
      } else {
        this.cleanupBook(result);
      }

      this.config.onResult(result);
      this.hide();
    } catch (error) {
      console.error('Failed to parse JSON:', error);
      alert(
        'Failed to parse the result. Please make sure you copied the complete JSON response from your LLM.\n\nThe response should start with { or [ and end with } or ].'
      );
    }
  }

  private cleanupBook(book: ParsedBookInfo): void {
    Object.keys(book).forEach((key) => {
      if (book[key as keyof ParsedBookInfo] === '') {
        delete book[key as keyof ParsedBookInfo];
      }
    });
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private isBookListResult(value: unknown): value is { books: unknown[] } {
    return this.isRecord(value) && Array.isArray(value.books);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Predefined prompts for common use cases
export const MANUAL_LLM_PROMPTS = {
  smartPaste: {
    system: `You are a book information extraction assistant. Extract book metadata from any text format.

IMPORTANT RULES:
- Do NOT translate anything. Use the original language from the text.
- Keep book titles, author names, and publisher names in their original language.
- Book titles may be marked with 《》 (Chinese book title marks) as a hint.
- If a field is not found in the text, use empty string. Do NOT guess or make up information.

Return ONLY valid JSON with this structure:
{
  "isbn": "ISBN if found",
  "title": "Book title in original language (cleaned, no emoji, no extra brackets)",
  "author": "Author name(s) in original language",
  "publisher": "Publisher name if available",
  "publishDate": "Publication date (YYYY or YYYY-MM-DD)",
  "cover": "Cover image URL if available",
  "notes": "Brief summary or description",
  "confidence": 0.95
}

Always include all fields. Use empty string for missing information.`,
    user: 'Extract book information from this text:\n\n{content}',
  },

  visionMultiBook: {
    system: `You are a book information extraction assistant. Extract ALL books from the uploaded image.

IMPORTANT RULES:
- The image is likely a screenshot from social media (Xiaohongshu/小红书, Douban/豆瓣, WeChat Read/微信读书, etc.)
- Do NOT translate anything. Use the original language from the image.
- Book titles may be marked with 《》 (Chinese book title marks) - use this as a hint.
- ONLY extract books that are explicitly mentioned or shown in the image.
- Do NOT include any books that are not in the image.
- If author information is not visible in the image, use empty string. Do NOT guess.
- If a field is not visible, use empty string. Do NOT make up information.

Return ONLY valid JSON with this structure:
{
  "books": [
    {
      "isbn": "ISBN if visible",
      "title": "Book title in original language",
      "author": "Author name(s) in original language (empty if not shown)",
      "publisher": "Publisher if visible",
      "publishDate": "Date if visible (YYYY or YYYY-MM-DD)",
      "cover": "",
      "notes": "Brief recommendation text from the image",
      "confidence": 0.95
    }
  ]
}

Extract EVERY book mentioned in the image. Always include all fields for each book.`,
    user: 'Extract information for ALL books shown in the uploaded image.',
  },
};
