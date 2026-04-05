export interface StorageService {
  uploadFile(localPath: string, ossKey: string): Promise<string>;
  uploadBuffer(buffer: Buffer, ossKey: string): Promise<string>;
  downloadToLocal(ossKey: string, localPath: string): Promise<void>;
  delete(ossKey: string): Promise<void>;
  deleteDir(prefix: string): Promise<void>;
  getUrl(ossKey: string): string;
  getSize(ossKey: string): Promise<number>;
  listFiles(prefix: string): Promise<string[]>;
}

let storageService: StorageService | null = null;

export function initStorageService(service: StorageService): void {
  storageService = service;
}

export function getStorageService(): StorageService {
  if (!storageService) {
    throw new Error(
      'StorageService has not been initialized. Call initStorageService() before using storage.'
    );
  }
  return storageService;
}
