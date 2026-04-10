import { StorageService } from './storageService';

export class NullStorageService implements StorageService {
  async uploadFile(): Promise<string> {
    throw new Error('Storage not configured');
  }
  async uploadBuffer(): Promise<string> {
    throw new Error('Storage not configured');
  }
  async downloadToLocal(): Promise<void> {
    throw new Error('Storage not configured');
  }
  async delete(): Promise<void> {
    throw new Error('Storage not configured');
  }
  async deleteDir(): Promise<void> {
    // Null implementation - no-op for deleteDir to allow topic deletion even without storage
    return Promise.resolve();
  }
  getUrl(): string {
    throw new Error('Storage not configured');
  }
  async getSize(): Promise<number> {
    throw new Error('Storage not configured');
  }
  async listFiles(): Promise<string[]> {
    throw new Error('Storage not configured');
  }
  async getPresignedUrl(
    ossKey: string,
    method: 'GET' | 'PUT',
    _contentType?: string,
  ): Promise<{ url: string; method: string }> {
    // Dev fallback: return a local URL. Frontend uploads will fail but the route works.
    const base = 'http://localhost:3002/storage/dev';
    return {
      url: `${base}/${encodeURIComponent(ossKey)}`,
      method,
    };
  }
}

export function createNullStorageService(): StorageService {
  return new NullStorageService();
}
