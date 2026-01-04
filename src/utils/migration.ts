import { APP_VERSION } from '../config';
import type { CategoryMetadata, StorageData } from '../types';

type CategoryEntry = string | CategoryMetadata;

type MigrationInput = {
  version?: string;
  settings?: {
    categories?: CategoryEntry[];
  };
};

type MigrationFunction = (data: MigrationInput) => MigrationInput;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const migrations: Partial<Record<string, MigrationFunction>> = {
  '1.0.0': (data) => {
    // Initial version, no migration needed
    return data;
  },
  '1.1.0': (data) => {
    // Add recommendation field to books (optional, defaults to undefined)
    // Add Wishlist category if not exists
    const categories = data.settings?.categories;
    if (isStringArray(categories) && !categories.includes('Wishlist')) {
      categories.push('Wishlist');
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
export function migrateData(data: MigrationInput): StorageData {
  let currentVersion = data.version || '1.0.0';

  // If already at current version, return as-is
  if (currentVersion === APP_VERSION) {
    return data as unknown as StorageData;
  }

  // Apply migrations sequentially
  while (currentVersion !== APP_VERSION) {
    const nextVersion = getNextVersion(currentVersion);

    if (!nextVersion) {
      console.warn(`Cannot migrate from ${String(currentVersion)} to ${APP_VERSION}`);
      break;
    }

    const migration = migrations[nextVersion];
    if (migration) {
      data = migration(data);
      data.version = nextVersion;
      currentVersion = nextVersion;
    } else {
      console.warn(`Migration function for ${nextVersion} not found`);
      break;
    }
  }

  return data as unknown as StorageData;
}

/**
 * Check if data needs migration
 */
export function needsMigration(data: MigrationInput): boolean {
  return !data.version || data.version !== APP_VERSION;
}
