// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config', () => ({
  GOOGLE_DRIVE_CLIENT_ID: 'client-id',
}));

import {
  downloadLatestFullBackupFromDrive,
  requestAccessToken,
  resetGoogleDriveAuthForTests,
  syncFullBackupToDrive,
} from '../src/modules/google-drive';

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

const createJsonResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
});

const createBinaryResponse = (bytes: Uint8Array, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  arrayBuffer: async () => bytes.buffer,
  text: async () => '',
});

describe('google drive integration', () => {
  let tokenClient: TokenClient;
  let initTokenClient: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetGoogleDriveAuthForTests();
    tokenClient = {
      requestAccessToken: vi.fn(() => {
        if (tokenClient.callback) {
          tokenClient.callback({ access_token: 'token-1', expires_in: 3600 });
        }
      }),
    };
    initTokenClient = vi.fn(() => tokenClient);
    (globalThis as { google?: unknown }).google = {
      accounts: {
        oauth2: {
          initTokenClient,
        },
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetGoogleDriveAuthForTests();
    delete (globalThis as { google?: unknown }).google;
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it('caches access token until expiry', async () => {
    const first = await requestAccessToken();
    const second = await requestAccessToken();

    expect(first).toBe('token-1');
    expect(second).toBe('token-1');
    expect(tokenClient.requestAccessToken).toHaveBeenCalledTimes(1);
  });

  it('syncs a full backup to Drive', async () => {
    const fetchMock = vi.fn();
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ files: [] }))
      .mockResolvedValueOnce(createJsonResponse({ id: 'file-1', name: 'backup.zip' }))
      .mockResolvedValueOnce(
        createJsonResponse({ id: 'file-1', name: 'backup.zip', modifiedTime: 'now' })
      );

    const result = await syncFullBackupToDrive(new Uint8Array([1, 2, 3]), {
      fileName: 'backup.zip',
    });

    expect(result.fileId).toBe('file-1');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [listUrl, listOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(listUrl).toContain('/drive/v3/files?');
    expect(listOptions?.method).toBeUndefined();

    const [createUrl, createOptions] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(createUrl).toContain('/drive/v3/files');
    expect(createOptions?.method).toBe('POST');

    const [uploadUrl, uploadOptions] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(uploadUrl).toContain('/upload/drive/v3/files/file-1');
    expect(uploadOptions?.method).toBe('PATCH');
  });

  it('downloads the latest full backup from Drive', async () => {
    const fetchMock = vi.fn();
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

    const bytes = new Uint8Array([9, 8, 7]);
    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ files: [{ id: 'file-1', name: 'backup.zip' }] }))
      .mockResolvedValueOnce(createBinaryResponse(bytes));

    const result = await downloadLatestFullBackupFromDrive({ fileName: 'backup.zip' });

    expect(result.fileId).toBe('file-1');
    expect(result.bytes).toEqual(bytes);
  });
});
