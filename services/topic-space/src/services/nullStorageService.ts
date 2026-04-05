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
}

export function createNullStorageService(): StorageService {
  return new NullStorageService();
}
