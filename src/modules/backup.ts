import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { APP_VERSION } from '../config';
import { db } from './db';
import type {
  BackupAssetMeta,
  BackupData,
  BackupFormat,
  BackupPayload,
  BackupChecksum,
} from '../types';

const BACKUP_SCHEMA_VERSION = 1;
const BACKUP_JSON_FILENAME = 'backup.json';

export type HashProvider = (data: Uint8Array) => Promise<string>;

export type BackupErrorCode =
  | 'invalid-json'
  | 'invalid-structure'
  | 'unsupported-schema'
  | 'invalid-format'
  | 'checksum-mismatch'
  | 'assets-missing'
  | 'assets-hash-mismatch'
  | 'assets-checksum-mismatch'
  | 'archive-missing'
  | 'archive-invalid'
  | 'restore-failed';

export type BackupSummary = {
  books: number;
  bookLists: number;
  settings: number;
  assets: number;
};

export type BackupImportResult =
  | { success: true; format: BackupFormat; summary: BackupSummary }
  | { success: false; error: BackupErrorCode; details?: string };

async function getStorage() {
  const module = await import('./storage');
  return module.storage;
}

type ParsedBackupData =
  | { success: true; data: BackupData }
  | { success: false; error: BackupErrorCode; details?: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isBackupFormat = (value: unknown): value is BackupFormat =>
  value === 'metadata' || value === 'full';

const isBackupPayload = (value: unknown): value is BackupPayload =>
  isRecord(value) &&
  Array.isArray(value.books) &&
  Array.isArray(value.bookLists) &&
  isRecord(value.settings);

const isBackupAssetMeta = (value: unknown): value is BackupAssetMeta =>
  isRecord(value) &&
  isString(value.path) &&
  isString(value.url) &&
  isString(value.sha256) &&
  isNumber(value.bytes) &&
  isNumber(value.timestamp);

const isBackupAssetsBlock = (value: unknown): value is BackupData['assets'] =>
  isRecord(value) &&
  isNumber(value.version) &&
  Array.isArray(value.items) &&
  value.items.every(isBackupAssetMeta);

const isBackupChecksum = (value: unknown): value is BackupChecksum =>
  isRecord(value) &&
  value.algorithm === 'sha256' &&
  isString(value.dataHash) &&
  (value.assetsHash === undefined || isString(value.assetsHash));

export function stableStringify(value: unknown): string {
  if (value === undefined) {
    return 'null';
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => stableStringify(item));
    return `[${items.join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(',')}}`;
}

function normalizeJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function getWebCrypto(): SubtleCrypto {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (!cryptoApi?.subtle) {
    throw new Error('Web Crypto API is not available');
  }
  return cryptoApi.subtle;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.slice().buffer;
}

async function defaultHashProvider(data: Uint8Array): Promise<string> {
  const digest = await getWebCrypto().digest('SHA-256', toArrayBuffer(data));
  return toHex(digest);
}

async function hashJson(value: unknown, hashProvider: HashProvider): Promise<string> {
  const normalized = normalizeJson(value);
  const encoded = new TextEncoder().encode(stableStringify(normalized));
  return hashProvider(encoded);
}

function normalizeBackupPayload(payload: BackupPayload): BackupPayload {
  const books = [...payload.books].sort((a, b) => a.id.localeCompare(b.id));
  const bookLists = [...payload.bookLists].sort((a, b) => a.id.localeCompare(b.id));
  const settingsEntries = Object.entries(payload.settings).sort(([a], [b]) => a.localeCompare(b));
  const settings = Object.fromEntries(settingsEntries);
  return {
    books,
    bookLists,
    settings,
  };
}

export async function buildBackupData(
  format: BackupFormat,
  payload: BackupPayload,
  options?: {
    assets?: BackupAssetMeta[];
    createdAt?: number;
    hashProvider?: HashProvider;
  }
): Promise<BackupData> {
  const hashProvider = options?.hashProvider ?? defaultHashProvider;
  const createdAt = options?.createdAt ?? Date.now();
  const dataHash = await hashJson(payload, hashProvider);

  if (format === 'full') {
    const assets = options?.assets ?? [];
    const assetsHash = await hashJson(assets, hashProvider);
    return {
      format,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      createdAt,
      checksum: {
        algorithm: 'sha256',
        dataHash,
        assetsHash,
      },
      data: payload,
      assets: {
        version: 1,
        items: assets,
      },
    };
  }

  return {
    format,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    createdAt,
    checksum: {
      algorithm: 'sha256',
      dataHash,
    },
    data: payload,
  };
}

export async function verifyBackupData(
  backup: BackupData,
  options?: { hashProvider?: HashProvider }
): Promise<{ valid: true } | { valid: false; error: BackupErrorCode; details?: string }> {
  const hashProvider = options?.hashProvider ?? defaultHashProvider;
  const dataHash = await hashJson(backup.data, hashProvider);

  if (dataHash !== backup.checksum.dataHash) {
    return { valid: false, error: 'checksum-mismatch' };
  }

  if (backup.format === 'full') {
    if (!backup.assets || !backup.checksum.assetsHash) {
      return { valid: false, error: 'assets-missing' };
    }
    const assetsHash = await hashJson(backup.assets.items, hashProvider);
    if (assetsHash !== backup.checksum.assetsHash) {
      return { valid: false, error: 'assets-hash-mismatch' };
    }
  }

  return { valid: true };
}

export function packFullBackupZip(
  backup: BackupData,
  assets: Record<string, Uint8Array>
): Uint8Array {
  const backupText = JSON.stringify(backup);
  if (!backupText) {
    throw new Error('Failed to serialize backup');
  }

  const files: Record<string, Uint8Array> = {
    [BACKUP_JSON_FILENAME]: strToU8(backupText),
  };

  for (const [path, data] of Object.entries(assets)) {
    files[path] = data;
  }

  return zipSync(files, { level: 6 });
}

export function unpackFullBackupZip(bytes: Uint8Array): {
  backup: BackupData;
  assets: Partial<Record<string, Uint8Array>>;
} {
  const files = unzipSync(bytes);
  const backupFile = files[BACKUP_JSON_FILENAME] as Uint8Array | undefined;

  if (!backupFile) {
    throw new Error('Missing backup.json in archive');
  }

  const backup = JSON.parse(strFromU8(backupFile)) as BackupData;
  const assets: Partial<Record<string, Uint8Array>> = {};

  for (const [path, data] of Object.entries(files)) {
    if (path === BACKUP_JSON_FILENAME) continue;
    assets[path] = data;
  }

  return { backup, assets };
}

function parseBackupData(text: string): ParsedBackupData {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch (error) {
    return { success: false, error: 'invalid-json', details: String(error) };
  }

  if (!isRecord(parsed)) {
    return { success: false, error: 'invalid-structure' };
  }

  const format = parsed.format;
  const schemaVersion = parsed.schemaVersion;
  const appVersion = parsed.appVersion;
  const createdAt = parsed.createdAt;
  const checksum = parsed.checksum;
  const data = parsed.data;
  const assets = parsed.assets;

  if (!isBackupFormat(format)) {
    return { success: false, error: 'invalid-structure' };
  }
  if (!isNumber(schemaVersion) || !isString(appVersion) || !isNumber(createdAt)) {
    return { success: false, error: 'invalid-structure' };
  }
  if (!isBackupChecksum(checksum) || !isBackupPayload(data)) {
    return { success: false, error: 'invalid-structure' };
  }
  if (schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return {
      success: false,
      error: 'unsupported-schema',
      details: `schemaVersion=${schemaVersion}`,
    };
  }

  if (format === 'full') {
    if (!checksum.assetsHash || !isBackupAssetsBlock(assets)) {
      return { success: false, error: 'assets-missing' };
    }
  } else if (assets !== undefined) {
    return { success: false, error: 'invalid-structure' };
  }

  return { success: true, data: parsed as unknown as BackupData };
}

function summarizeBackup(backup: BackupData, assetCount: number): BackupSummary {
  return {
    books: backup.data.books.length,
    bookLists: backup.data.bookLists.length,
    settings: Object.keys(backup.data.settings).length,
    assets: assetCount,
  };
}

export async function exportMetadataBackupJson(): Promise<string> {
  const storage = await getStorage();
  await storage.waitForInit();
  const payload = normalizeBackupPayload(await storage.exportBackupPayload());
  const backup = await buildBackupData('metadata', payload);
  const backupText = JSON.stringify(backup, null, 2);
  if (!backupText) {
    throw new Error('Failed to serialize backup');
  }
  return backupText;
}

export async function exportFullBackupZip(): Promise<Uint8Array> {
  const storage = await getStorage();
  await storage.waitForInit();
  const payload = normalizeBackupPayload(await storage.exportBackupPayload());
  const cacheEntries = await db.imageCache.toArray();
  const sortedEntries = [...cacheEntries].sort((a, b) => a.url.localeCompare(b.url));
  const assets: BackupAssetMeta[] = [];
  const files: Record<string, Uint8Array> = {};

  for (const entry of sortedEntries) {
    const bytes = new Uint8Array(await entry.blob.arrayBuffer());
    const sha256 = await defaultHashProvider(bytes);
    const path = `assets/${sha256}.bin`;

    files[path] = bytes;

    assets.push({
      path,
      url: entry.url,
      sha256,
      bytes: bytes.byteLength,
      timestamp: entry.timestamp,
    });
  }

  const backup = await buildBackupData('full', payload, { assets });
  return packFullBackupZip(backup, files);
}

export async function importMetadataBackupJson(file: File): Promise<BackupImportResult> {
  try {
    const text = await file.text();
    const parsed = parseBackupData(text);

    if (!parsed.success) {
      return parsed;
    }

    if (parsed.data.format !== 'metadata') {
      return { success: false, error: 'invalid-format' };
    }

    const verified = await verifyBackupData(parsed.data);
    if (!verified.valid) {
      return { success: false, error: verified.error, details: verified.details };
    }

    const storage = await getStorage();
    await storage.replaceBackupData(parsed.data.data, { clearCache: true });

    return {
      success: true,
      format: parsed.data.format,
      summary: summarizeBackup(parsed.data, 0),
    };
  } catch (error) {
    return { success: false, error: 'restore-failed', details: String(error) };
  }
}

export async function importFullBackupZip(file: File): Promise<BackupImportResult> {
  let unpacked: ReturnType<typeof unpackFullBackupZip>;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    unpacked = unpackFullBackupZip(bytes);
  } catch (error) {
    const message = String(error);
    if (message.includes('backup.json')) {
      return { success: false, error: 'archive-missing' };
    }
    return { success: false, error: 'archive-invalid', details: message };
  }

  const backupText = JSON.stringify(unpacked.backup);
  if (!backupText) {
    return { success: false, error: 'invalid-json' };
  }
  const parsed = parseBackupData(backupText);

  if (!parsed.success) {
    return parsed;
  }

  if (parsed.data.format !== 'full') {
    return { success: false, error: 'invalid-format' };
  }

  const verified = await verifyBackupData(parsed.data);
  if (!verified.valid) {
    return { success: false, error: verified.error, details: verified.details };
  }

  if (!parsed.data.assets) {
    return { success: false, error: 'assets-missing' };
  }

  for (const asset of parsed.data.assets.items) {
    const fileBytes = unpacked.assets[asset.path];
    if (!fileBytes) {
      return { success: false, error: 'assets-missing', details: asset.path };
    }
    const sha256 = await defaultHashProvider(fileBytes);
    if (sha256 !== asset.sha256 || fileBytes.byteLength !== asset.bytes) {
      return { success: false, error: 'assets-checksum-mismatch', details: asset.path };
    }
  }

  try {
    const storage = await getStorage();
    await storage.replaceBackupData(parsed.data.data, { clearCache: true });

    if (parsed.data.assets.items.length > 0) {
      const cacheRecords = parsed.data.assets.items.map((asset) => {
        const fileBytes = unpacked.assets[asset.path];
        if (!fileBytes) {
          throw new Error(`Missing asset bytes for ${asset.path}`);
        }
        return {
          url: asset.url,
          blob: new Blob([toArrayBuffer(fileBytes)]),
          timestamp: asset.timestamp,
        };
      });
      await db.imageCache.bulkAdd(cacheRecords);
    }
  } catch (error) {
    return { success: false, error: 'restore-failed', details: String(error) };
  }

  return {
    success: true,
    format: parsed.data.format,
    summary: summarizeBackup(parsed.data, parsed.data.assets.items.length),
  };
}
