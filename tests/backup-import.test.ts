import { beforeEach, describe, expect, it, vi } from 'vitest';
import { zipSync } from 'fflate';
import type { BackupAssetMeta, BackupPayload } from '../src/types';

const storageMock = vi.hoisted(() => ({
  replaceBackupData: vi.fn().mockResolvedValue(undefined),
  waitForInit: vi.fn().mockResolvedValue(undefined),
}));

const dbMock = vi.hoisted(() => ({
  imageCache: {
    bulkAdd: vi.fn().mockResolvedValue(undefined),
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
  importFullBackupZip,
  importMetadataBackupJson,
  packFullBackupZip,
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
});
