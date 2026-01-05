import { importMetadataBackupJson } from './backup';

/**
 * Import metadata backup from JSON file
 */
export async function importFromJSON(
  file: File,
  mode: 'merge' | 'replace' = 'replace'
): Promise<{ success: boolean; message: string }> {
  if (mode === 'merge') {
    return {
      success: false,
      message: 'Merge restore is not supported yet.',
    };
  }

  const result = await importMetadataBackupJson(file);
  if (result.success) {
    return {
      success: true,
      message: `Successfully restored ${result.summary.books} books.`,
    };
  }

  return {
    success: false,
    message: `Restore failed: ${result.error}`,
  };
}
