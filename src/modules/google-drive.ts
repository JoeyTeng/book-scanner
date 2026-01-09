import { GOOGLE_DRIVE_CLIENT_ID } from '../config';

export const DEFAULT_DRIVE_BACKUP_NAME = 'book-scanner-full-backup-latest.zip';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const DRIVE_FILE_FIELDS = 'id,name,modifiedTime';
const TOKEN_EXPIRY_SKEW_MS = 30_000;

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type TokenClient = {
  callback?: (response: TokenResponse) => void;
  requestAccessToken: (options?: { prompt?: string }) => void;
};

type GoogleIdentity = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
      }) => TokenClient;
    };
  };
};

type TokenCache = {
  token: string;
  expiresAt: number;
};

type DriveFile = {
  id: string;
  name: string;
  modifiedTime?: string;
};

export type DriveSyncResult = {
  fileId: string;
  fileName: string;
  modifiedTime?: string;
};

export type DriveDownloadResult = {
  fileId: string;
  fileName: string;
  modifiedTime?: string;
  bytes: Uint8Array;
};

let tokenCache: TokenCache | null = null;
let tokenClient: TokenClient | null = null;
let gisLoadPromise: Promise<void> | null = null;

function getGoogleIdentity(): GoogleIdentity | undefined {
  return (globalThis as { google?: GoogleIdentity }).google;
}

function requireClientId(): string {
  if (!GOOGLE_DRIVE_CLIENT_ID) {
    throw new Error('missing-client-id');
  }
  return GOOGLE_DRIVE_CLIENT_ID;
}

export async function loadGoogleIdentity(): Promise<void> {
  if (getGoogleIdentity()?.accounts?.oauth2) {
    return;
  }
  if (gisLoadPromise) {
    return gisLoadPromise;
  }
  if (typeof document === 'undefined') {
    throw new Error('google-identity-unavailable');
  }

  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-identity="true"]'
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('google-identity-load-failed')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('google-identity-load-failed'));
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

async function getTokenClient(): Promise<TokenClient> {
  await loadGoogleIdentity();
  if (tokenClient) {
    return tokenClient;
  }

  const googleIdentity = getGoogleIdentity();
  if (!googleIdentity?.accounts?.oauth2) {
    throw new Error('google-identity-unavailable');
  }

  tokenClient = googleIdentity.accounts.oauth2.initTokenClient({
    client_id: requireClientId(),
    scope: DRIVE_SCOPE,
    callback: () => {},
  });

  return tokenClient;
}

function isTokenValid(): boolean {
  if (!tokenCache) {
    return false;
  }
  return tokenCache.expiresAt > Date.now();
}

function cacheToken(token: string, expiresIn?: number): void {
  const ttlSeconds = typeof expiresIn === 'number' && expiresIn > 0 ? expiresIn : 300;
  const ttlMs = Math.max(ttlSeconds * 1000 - TOKEN_EXPIRY_SKEW_MS, 0);
  tokenCache = {
    token,
    expiresAt: Date.now() + ttlMs,
  };
}

export async function requestAccessToken(options?: { prompt?: string }): Promise<string> {
  if (isTokenValid()) {
    return tokenCache!.token;
  }

  const client = await getTokenClient();

  return new Promise((resolve, reject) => {
    client.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error));
        return;
      }
      if (!response.access_token) {
        reject(new Error('missing-access-token'));
        return;
      }
      cacheToken(response.access_token, response.expires_in);
      resolve(response.access_token);
    };

    client.requestAccessToken({ prompt: options?.prompt ?? '' });
  });
}

class DriveApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function assertOk(response: Response, context: string): Promise<void> {
  if (response.ok) {
    return;
  }
  let details = '';
  try {
    details = await response.text();
  } catch {
    details = '';
  }
  throw new DriveApiError(
    `drive-${context}-failed:${response.status}${details ? `:${details}` : ''}`,
    response.status
  );
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof DriveApiError && error.status === 404;
}

function escapeQueryValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

async function listBackupFiles(token: string, fileName: string): Promise<DriveFile[]> {
  const query = encodeURIComponent(`name = '${escapeQueryValue(fileName)}' and trashed = false`);
  const url = `${DRIVE_API_BASE}/files?spaces=appDataFolder&q=${query}&orderBy=modifiedTime desc&fields=files(${DRIVE_FILE_FIELDS})`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  await assertOk(response, 'list');
  const payload = (await response.json()) as { files?: DriveFile[] };
  return payload.files ?? [];
}

async function getDriveFile(token: string, fileId: string): Promise<DriveFile> {
  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?fields=${DRIVE_FILE_FIELDS}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  await assertOk(response, 'get');
  return (await response.json()) as DriveFile;
}

async function createDriveFile(token: string, fileName: string): Promise<DriveFile> {
  const response = await fetch(`${DRIVE_API_BASE}/files?fields=${DRIVE_FILE_FIELDS}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: fileName,
      parents: ['appDataFolder'],
      mimeType: 'application/zip',
    }),
  });
  await assertOk(response, 'create');
  return (await response.json()) as DriveFile;
}

async function uploadDriveFileContent(
  token: string,
  fileId: string,
  bytes: Uint8Array
): Promise<DriveFile> {
  const body = bytes.slice().buffer;
  const response = await fetch(
    `${DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=media&fields=${DRIVE_FILE_FIELDS}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/zip',
      },
      body,
    }
  );
  await assertOk(response, 'upload');
  return (await response.json()) as DriveFile;
}

async function downloadDriveFileContent(token: string, fileId: string): Promise<Uint8Array> {
  const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  await assertOk(response, 'download');
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

async function findLatestBackupFile(
  token: string,
  fileName: string
): Promise<DriveFile | undefined> {
  const files = await listBackupFiles(token, fileName);
  return files[0];
}

export async function syncFullBackupToDrive(
  bytes: Uint8Array,
  options?: { fileId?: string; fileName?: string; prompt?: string }
): Promise<DriveSyncResult> {
  const token = await requestAccessToken({ prompt: options?.prompt });
  const fileName = options?.fileName ?? DEFAULT_DRIVE_BACKUP_NAME;

  if (options?.fileId) {
    try {
      const uploaded = await uploadDriveFileContent(token, options.fileId, bytes);
      return {
        fileId: uploaded.id,
        fileName: uploaded.name,
        modifiedTime: uploaded.modifiedTime,
      };
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }

  const existing = await findLatestBackupFile(token, fileName);
  if (existing) {
    const uploaded = await uploadDriveFileContent(token, existing.id, bytes);
    return {
      fileId: uploaded.id,
      fileName: uploaded.name,
      modifiedTime: uploaded.modifiedTime,
    };
  }

  const created = await createDriveFile(token, fileName);
  const uploaded = await uploadDriveFileContent(token, created.id, bytes);
  return {
    fileId: uploaded.id,
    fileName: uploaded.name,
    modifiedTime: uploaded.modifiedTime,
  };
}

export async function downloadLatestFullBackupFromDrive(options?: {
  fileId?: string;
  fileName?: string;
  prompt?: string;
}): Promise<DriveDownloadResult> {
  const token = await requestAccessToken({ prompt: options?.prompt });
  const fileName = options?.fileName ?? DEFAULT_DRIVE_BACKUP_NAME;

  let target: DriveFile | undefined;
  if (options?.fileId) {
    try {
      target = await getDriveFile(token, options.fileId);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
  }

  if (!target) {
    target = await findLatestBackupFile(token, fileName);
  }

  if (!target) {
    throw new Error('no-backup-found');
  }

  const bytes = await downloadDriveFileContent(token, target.id);
  return {
    fileId: target.id,
    fileName: target.name,
    modifiedTime: target.modifiedTime,
    bytes,
  };
}

export function resetGoogleDriveAuthForTests(): void {
  tokenCache = null;
  tokenClient = null;
  gisLoadPromise = null;
}
