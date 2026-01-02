import { APP_VERSION } from '../config';
import type { StorageData } from '../types';

type MigrationFunction = (data: any) => any;

const migrations: Record<string, MigrationFunction> = {
  '1.0.0': (data: any) => {
    // Initial version, no migration needed
    return data;
  },
  '1.1.0': (data: any) => {
    // Add recommendation field to books (optional, defaults to undefined)
    // Add Wishlist category if not exists
    if (!data.settings.categories.includes('Wishlist')) {
      data.settings.categories.push('Wishlist');
    }
    return data;
  },
};

/**
 * Get all version numbers in order
 */
function getVersions(): string[] {
  return Object.keys(migrations).sort((a, b) => {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (aParts[i] !== bParts[i]) {
        return aParts[i] - bParts[i];
      }
    }
    return 0;
  });
}

/**
 * Get the next version after current
 */
function getNextVersion(current: string): string | null {
  const versions = getVersions();
  const currentIndex = versions.indexOf(current);

  if (currentIndex === -1 || currentIndex === versions.length - 1) {
    return null;
  }

  return versions[currentIndex + 1];
}

/**
 * Migrate data from old version to current version
 */
export function migrateData(data: any): StorageData {
  let currentVersion = data.version || '1.0.0';

  // If already at current version, return as-is
  if (currentVersion === APP_VERSION) {
    return data as StorageData;
  }

  // Apply migrations sequentially
  while (currentVersion !== APP_VERSION) {
    const nextVersion = getNextVersion(currentVersion);

    if (!nextVersion) {
      console.warn(`Cannot migrate from ${String(currentVersion)} to ${APP_VERSION}`);
      break;
    }

    if (migrations[nextVersion]) {
      data = migrations[nextVersion](data);
      data.version = nextVersion;
      currentVersion = nextVersion;
    } else {
      console.warn(`Migration function for ${nextVersion} not found`);
      break;
    }
  }

  return data as StorageData;
}

/**
 * Check if data needs migration
 */
export function needsMigration(data: any): boolean {
  return !data.version || data.version !== APP_VERSION;
}
