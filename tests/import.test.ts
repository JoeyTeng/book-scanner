import { describe, expect, it, vi } from 'vitest';

const backupMock = vi.hoisted(() => ({
  importMetadataBackupJson: vi.fn(),
}));

vi.mock('../src/modules/backup', () => ({
  importMetadataBackupJson: backupMock.importMetadataBackupJson,
}));

import { importFromJSON } from '../src/modules/import';

describe('importFromJSON', () => {
  it('rejects merge mode', async () => {
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });

    const result = await importFromJSON(file, 'merge');

    expect(result).toEqual({
      success: false,
      message: 'Merge restore is not supported yet.',
    });
    expect(backupMock.importMetadataBackupJson).not.toHaveBeenCalled();
  });

  it('reports success message on restore', async () => {
    backupMock.importMetadataBackupJson.mockResolvedValue({
      success: true,
      format: 'metadata',
      summary: {
        books: 2,
        bookLists: 0,
        settings: 0,
        assets: 0,
      },
    });

    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    const result = await importFromJSON(file, 'replace');

    expect(result).toEqual({
      success: true,
      message: 'Successfully restored 2 books.',
    });
  });

  it('reports failure message on restore errors', async () => {
    backupMock.importMetadataBackupJson.mockResolvedValue({
      success: false,
      error: 'invalid-json',
    });

    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    const result = await importFromJSON(file, 'replace');

    expect(result).toEqual({
      success: false,
      message: 'Restore failed: invalid-json',
    });
  });
});
