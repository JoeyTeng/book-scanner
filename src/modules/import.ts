import type { ExportData, StorageData } from '../types';
import { APP_VERSION } from '../config';
import { migrateData } from '../utils/migration';
import { storage } from './storage';

/**
 * Import data from JSON file
 */
export async function importFromJSON(
  file: File,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ success: boolean; message: string }> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate structure
    if (!data.version || !data.books || !Array.isArray(data.books)) {
      return {
        success: false,
        message: 'Invalid file format. Missing required fields.'
      };
    }

    // Check if it's ExportData or StorageData format
    let storageData: StorageData;

    if ('exportedAt' in data) {
      // ExportData format
      const exportData = data as ExportData;
      storageData = {
        version: exportData.version,
        books: exportData.books,
        settings: {
          categories: exportData.categories || [],
          googleBooksApiKey: await storage.getGoogleBooksApiKey(),
          isbndbApiKey: await storage.getISBNdbApiKey(),
        },
      };
    } else {
      // StorageData format
      storageData = data as StorageData;
    }

    // Migrate if needed
    if (storageData.version !== APP_VERSION) {
      storageData = migrateData(storageData);
    }

    // Import
    await storage.importData(storageData, mode);

    return {
      success: true,
      message: `Successfully imported ${storageData.books.length} books.`
    };
  } catch (error) {
    console.error('Import error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to import file.'
    };
  }
}
