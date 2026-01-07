import { beforeEach, describe, expect, it, vi } from 'vitest';
import { zipSync } from 'fflate';
import type { BackupAssetMeta, BackupPayload } from '../src/types';

const storageMock = vi.hoisted(() => ({
  exportBackupPayload: vi.fn().mockResolvedValue({ books: [], bookLists: [], settings: {} }),
  replaceBackupData: vi.fn().mockResolvedValue(undefined),
  waitForInit: vi.fn().mockResolvedValue(undefined),
}));

const dbMock = vi.hoisted(() => ({
  imageCache: {
    bulkAdd: vi.fn().mockResolvedValue(undefined),
    toArray: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../src/modules/storage', () => ({
  storage: storageMock,
}));

vi.mock('../src/modules/db', () => ({
  db: dbMock,
}));

import {
  buildBackupData,
  exportFullBackupZip,
  exportMetadataBackupJson,
  importFullBackupZip,
  importMetadataBackupJson,
  packFullBackupZip,
  unpackFullBackupZip,
} from '../src/modules/backup';

function makeJsonFile(text: string): File {
  return new File([text], 'backup.json', { type: 'application/json' });
}

function makeZipFile(bytes: Uint8Array): File {
  return new File([bytes], 'backup.zip', { type: 'application/zip' });
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(digest);
}

function basePayload(): BackupPayload {
  return {
    books: [],
    bookLists: [],
    settings: { categories: [] },
  };
}

function makeBook(id: string): BackupPayload['books'][number] {
  return {
    id,
    isbn: `isbn-${id}`,
    title: `Title ${id}`,
    author: 'Author',
    categories: [],
    tags: [],
    status: 'read',
    notes: '',
    addedAt: 1,
    updatedAt: 2,
    source: [],
  };
}

function makeBookList(id: string, bookId: string): BackupPayload['bookLists'][number] {
  return {
    id,
    name: `List ${id}`,
    description: 'Desc',
    books: [
      {
        bookId,
        addedAt: 3,
      },
    ],
    createdAt: 4,
    updatedAt: 5,
  };
}

describe('backup import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores metadata backup', async () => {
    const payload = basePayload();
    const backup = await buildBackupData('metadata', payload, { createdAt: 123 });
    const file = makeJsonFile(JSON.stringify(backup));

    const result = await importMetadataBackupJson(file);

    expect(result).toEqual({
      success: true,
      format: 'metadata',
      summary: {
        books: 0,
        bookLists: 0,
        settings: 1,
        assets: 0,
      },
    });
    expect(storageMock.replaceBackupData).toHaveBeenCalledWith(payload, { clearCache: true });
  });

  it('rejects invalid metadata json', async () => {
    const result = await importMetadataBackupJson(makeJsonFile('{bad-json'));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('invalid-json');
    }
    expect(storageMock.replaceBackupData).not.toHaveBeenCalled();
  });

  it('rejects unsupported schema version', async () => {
    const payload = basePayload();
    const backup = await buildBackupData('metadata', payload);
    backup.schemaVersion = 999;
    const result = await importMetadataBackupJson(makeJsonFile(JSON.stringify(backup)));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('unsupported-schema');
    }
  });

  it('rejects checksum mismatch', async () => {
    const payload = basePayload();
    const backup = await buildBackupData('metadata', payload);
    backup.data.settings = { categories: [], mutated: true };

    const result = await importMetadataBackupJson(makeJsonFile(JSON.stringify(backup)));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('checksum-mismatch');
    }
  });

  it('rejects metadata import for full backup', async () => {
    const payload = basePayload();
    const backup = await buildBackupData('full', payload, { assets: [] });
    const result = await importMetadataBackupJson(makeJsonFile(JSON.stringify(backup)));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('invalid-format');
    }
  });

  it('restores full backup with assets', async () => {
    const payload = basePayload();
    const assetBytes = new Uint8Array([1, 2, 3, 4]);
    const sha256 = await sha256Hex(assetBytes);
    const path = `assets/${sha256}.bin`;
    const assets: BackupAssetMeta[] = [
      {
        path,
        url: 'https://example.com/asset',
        sha256,
        bytes: assetBytes.byteLength,
        timestamp: 100,
      },
    ];

    const backup = await buildBackupData('full', payload, { assets, createdAt: 123 });
    const zipBytes = packFullBackupZip(backup, { [path]: assetBytes });
    const result = await importFullBackupZip(makeZipFile(zipBytes));

    expect(result).toEqual({
      success: true,
      format: 'full',
      summary: {
        books: 0,
        bookLists: 0,
        settings: 1,
        assets: 1,
      },
    });
    expect(storageMock.replaceBackupData).toHaveBeenCalledWith(payload, { clearCache: true });
    expect(dbMock.imageCache.bulkAdd).toHaveBeenCalledTimes(1);
  });

  it('rejects archive missing backup.json', async () => {
    const zipBytes = zipSync({ 'assets/only.bin': new Uint8Array([1]) });
    const result = await importFullBackupZip(makeZipFile(zipBytes));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('archive-missing');
    }
  });

  it('rejects missing asset bytes', async () => {
    const payload = basePayload();
    const assetBytes = new Uint8Array([9, 8, 7]);
    const sha256 = await sha256Hex(assetBytes);
    const path = `assets/${sha256}.bin`;
    const assets: BackupAssetMeta[] = [
      {
        path,
        url: 'https://example.com/missing',
        sha256,
        bytes: assetBytes.byteLength,
        timestamp: 200,
      },
    ];

    const backup = await buildBackupData('full', payload, { assets });
    const zipBytes = packFullBackupZip(backup, {});
    const result = await importFullBackupZip(makeZipFile(zipBytes));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('assets-missing');
    }
  });

  it('rejects asset checksum mismatch', async () => {
    const payload = basePayload();
    const assetBytes = new Uint8Array([5, 6, 7]);
    const sha256 = await sha256Hex(new Uint8Array([1, 2, 3]));
    const path = `assets/${sha256}.bin`;
    const assets: BackupAssetMeta[] = [
      {
        path,
        url: 'https://example.com/bad',
        sha256,
        bytes: assetBytes.byteLength,
        timestamp: 300,
      },
    ];

    const backup = await buildBackupData('full', payload, { assets });
    const zipBytes = packFullBackupZip(backup, { [path]: assetBytes });
    const result = await importFullBackupZip(makeZipFile(zipBytes));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('assets-checksum-mismatch');
    }
  });

  it('rejects full import for metadata backup', async () => {
    const payload = basePayload();
    const backup = await buildBackupData('metadata', payload);
    const zipBytes = packFullBackupZip(backup, {});
    const result = await importFullBackupZip(makeZipFile(zipBytes));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('invalid-format');
    }
  });

  it('rejects invalid archive bytes', async () => {
    const result = await importFullBackupZip(makeZipFile(new Uint8Array([1, 2, 3])));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('archive-invalid');
    }
  });

  it('rejects invalid backup.json content', async () => {
    const zipBytes = zipSync({
      'backup.json': new TextEncoder().encode('not-json'),
    });
    const result = await importFullBackupZip(makeZipFile(zipBytes));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('archive-invalid');
    }
  });

  it('rejects invalid backup structure', async () => {
    const invalidBackup = {
      format: 'full',
      schemaVersion: 1,
      appVersion: '1.0.0',
      createdAt: 1,
      checksum: {
        algorithm: 'sha256',
        dataHash: 'hash',
        assetsHash: 'assets',
      },
      data: {
        books: [],
      },
      assets: {
        version: 1,
        items: [],
      },
    };
    const zipBytes = zipSync({
      'backup.json': new TextEncoder().encode(JSON.stringify(invalidBackup)),
    });
    const result = await importFullBackupZip(makeZipFile(zipBytes));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('invalid-structure');
    }
  });

  it('rejects assets hash mismatch', async () => {
    const payload = basePayload();
    const assetBytes = new Uint8Array([9, 9, 9]);
    const sha256 = await sha256Hex(assetBytes);
    const path = `assets/${sha256}.bin`;
    const assets: BackupAssetMeta[] = [
      {
        path,
        url: 'https://example.com/original',
        sha256,
        bytes: assetBytes.byteLength,
        timestamp: 123,
      },
    ];

    const backup = await buildBackupData('full', payload, { assets });
    if (!backup.assets) {
      throw new Error('Missing assets block');
    }
    backup.assets.items.push({
      path: 'assets/extra.bin',
      url: 'https://example.com/extra',
      sha256: 'extra',
      bytes: 1,
      timestamp: 456,
    });

    const zipBytes = packFullBackupZip(backup, { [path]: assetBytes });
    const result = await importFullBackupZip(makeZipFile(zipBytes));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('assets-hash-mismatch');
    }
  });
});

describe('backup export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports metadata backup with normalized payload', async () => {
    const payload: BackupPayload = {
      books: [makeBook('b'), makeBook('a')],
      bookLists: [makeBookList('b', 'b'), makeBookList('a', 'a')],
      settings: {
        llmApiKey: 'k',
        categories: [],
        isbndbApiKey: 'a',
      },
    };
    storageMock.exportBackupPayload.mockResolvedValue(payload);

    const json = await exportMetadataBackupJson();
    const parsed = JSON.parse(json) as { data: BackupPayload; format: string };

    expect(parsed.format).toBe('metadata');
    expect(parsed.data.books.map((book) => book.id)).toEqual(['a', 'b']);
    expect(parsed.data.bookLists.map((list) => list.id)).toEqual(['a', 'b']);
    expect(Object.keys(parsed.data.settings)).toEqual(['categories', 'isbndbApiKey', 'llmApiKey']);
    expect(storageMock.waitForInit).toHaveBeenCalledTimes(1);
    expect(storageMock.exportBackupPayload).toHaveBeenCalledTimes(1);
  });

  it('exports full backup zip with assets and utf8 metadata', async () => {
    const note = '中文 ✓';
    const payload: BackupPayload = {
      books: [],
      bookLists: [],
      settings: { categories: [], note },
    };
    const bytesA = new Uint8Array([1, 2]);
    const bytesB = new Uint8Array([3, 4, 5]);
    const entryB = {
      url: 'https://example.com/b',
      blob: new Blob([bytesB]),
      timestamp: 200,
    };
    const entryA = {
      url: 'https://example.com/a',
      blob: new Blob([bytesA]),
      timestamp: 100,
    };

    storageMock.exportBackupPayload.mockResolvedValue(payload);
    dbMock.imageCache.toArray.mockResolvedValue([entryB, entryA]);

    const zipBytes = await exportFullBackupZip();
    const unpacked = unpackFullBackupZip(zipBytes);

    expect(unpacked.backup.format).toBe('full');
    expect(unpacked.backup.data.settings.note).toBe(note);

    const assets = unpacked.backup.assets?.items ?? [];
    expect(assets.map((item) => item.url)).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);

    const shaA = await sha256Hex(bytesA);
    const shaB = await sha256Hex(bytesB);
    const pathA = `assets/${shaA}.bin`;
    const pathB = `assets/${shaB}.bin`;

    expect(assets.map((item) => item.path)).toEqual([pathA, pathB]);
    expect(unpacked.assets[pathA]).toEqual(bytesA);
    expect(unpacked.assets[pathB]).toEqual(bytesB);
    expect(assets[0]?.bytes).toBe(bytesA.byteLength);
    expect(assets[0]?.timestamp).toBe(entryA.timestamp);
    expect(assets[1]?.bytes).toBe(bytesB.byteLength);
    expect(assets[1]?.timestamp).toBe(entryB.timestamp);
    expect(storageMock.waitForInit).toHaveBeenCalledTimes(1);
    expect(storageMock.exportBackupPayload).toHaveBeenCalledTimes(1);
    expect(dbMock.imageCache.toArray).toHaveBeenCalledTimes(1);
  });
});
