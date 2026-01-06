// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { ParsedBookInfo } from '../src/modules/llm';

vi.mock('../src/modules/api/aggregator', () => ({
  searchBookByTitle: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/modules/llm', () => ({
  llmService: {
    isConfigured: vi.fn().mockResolvedValue(true),
    parseBooksFromImage: vi.fn(),
  },
}));

vi.mock('../src/modules/storage', () => ({
  storage: {
    getBooks: vi.fn().mockResolvedValue([]),
    getLLMApiEndpoint: vi.fn().mockResolvedValue(undefined),
    getLLMApiKey: vi.fn().mockResolvedValue(undefined),
  },
}));

import { VisionUploadModal } from '../src/components/vision-upload-modal';

describe('VisionUploadModal preview rendering', () => {
  it('does not interpret HTML in book fields', async () => {
    document.body.innerHTML = '<div id="modal-container"></div>';

    const modal = new VisionUploadModal();
    await modal.show();

    const maliciousTitle = '<img src=x onerror=alert(1)>';
    const books: ParsedBookInfo[] = [
      {
        title: maliciousTitle,
        author: 'Alice',
      },
    ];

    const modalInternal = modal as unknown as {
      showBooksPreview: (items: ParsedBookInfo[]) => Promise<void>;
    };

    await modalInternal.showBooksPreview(books);

    const list = document.querySelector('#books-list') as HTMLElement | null;
    expect(list).not.toBeNull();
    expect(list?.querySelector('img')).toBeNull();
    expect(list?.textContent).toContain(maliciousTitle);
  });
});
