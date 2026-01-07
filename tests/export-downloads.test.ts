// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storageMock = vi.hoisted(() => ({
  getBooks: vi.fn(),
}));

vi.mock('../src/modules/storage', () => ({
  storage: storageMock,
}));

import { downloadBlob, downloadBytes, downloadFile } from '../src/modules/export';

describe('export downloads', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let createdAnchors: HTMLAnchorElement[] = [];

  beforeEach(() => {
    createdAnchors = [];
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:mock');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const element = originalCreateElement(tag);
      if (tag === 'a') {
        createdAnchors.push(element as HTMLAnchorElement);
        vi.spyOn(element, 'click').mockImplementation(() => {});
      }
      return element;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads a blob with provided filename', () => {
    const blob = new Blob(['data'], { type: 'text/plain' });

    downloadBlob(blob, 'file.txt');

    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
    expect(createdAnchors[0]?.download).toBe('file.txt');
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock');
  });

  it('downloads string content via downloadFile', () => {
    downloadFile('content', 'file.txt', 'text/plain');

    expect(createdAnchors[0]?.download).toBe('file.txt');
  });

  it('downloads byte content via downloadBytes', () => {
    downloadBytes(new Uint8Array([1, 2, 3]), 'file.bin', 'application/octet-stream');

    expect(createdAnchors[0]?.download).toBe('file.bin');
  });
});
