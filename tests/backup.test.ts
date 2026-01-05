import { describe, expect, it } from 'vitest';
import {
  buildBackupData,
  packFullBackupZip,
  stableStringify,
  unpackFullBackupZip,
  verifyBackupData,
  type HashProvider,
} from '../src/modules/backup';
import type { BackupAssetMeta, BackupPayload } from '../src/types';

const fakeHash: HashProvider = async (data) => {
  let sum = 0;
  for (const byte of data) {
    sum = (sum + byte) % 65536;
  }
  return `hash-${data.length}-${sum}`;
};

describe('backup helpers', () => {
  it('stableStringify sorts object keys', () => {
    const value = { b: 1, a: 2 };
    expect(stableStringify(value)).toBe('{"a":2,"b":1}');
  });

  it('verifies metadata backup checksum', async () => {
    const payload: BackupPayload = {
      books: [],
      bookLists: [],
      settings: { categories: [] },
    };

    const backup = await buildBackupData('metadata', payload, {
      createdAt: 123,
      hashProvider: fakeHash,
    });

    const verified = await verifyBackupData(backup, { hashProvider: fakeHash });
    expect(verified).toEqual({ valid: true });

    backup.data.settings.changed = true;
    const tampered = await verifyBackupData(backup, { hashProvider: fakeHash });
    expect(tampered).toEqual({ valid: false, error: 'checksum-mismatch' });
  });

  it('roundtrips full backup zip', async () => {
    const note = '中文 ✓';
    const payload: BackupPayload = {
      books: [],
      bookLists: [],
      settings: { categories: [], note },
    };

    const assets: BackupAssetMeta[] = [
      {
        path: 'assets/demo.bin',
        url: 'https://example.com/demo',
        sha256: 'demo',
        bytes: 3,
        timestamp: 1000,
      },
    ];

    const backup = await buildBackupData('full', payload, {
      assets,
      createdAt: 123,
      hashProvider: fakeHash,
    });

    const files = {
      'assets/demo.bin': new Uint8Array([1, 2, 3]),
    };

    const zipped = packFullBackupZip(backup, files);
    const unpacked = unpackFullBackupZip(zipped);

    expect(unpacked.backup.format).toBe('full');
    expect(unpacked.backup.assets?.items).toHaveLength(1);
    expect(unpacked.assets['assets/demo.bin']).toEqual(files['assets/demo.bin']);
    expect((unpacked.backup.data.settings.note as string) || '').toBe(note);
  });
});
