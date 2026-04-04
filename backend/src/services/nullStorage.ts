import { StorageService } from './storageService';

export class NullStorageService implements StorageService {
  uploadFile(): Promise<string> {
    throw new Error('OSS not configured: call uploadFile');
  }
  uploadBuffer(): Promise<string> {
    throw new Error('OSS not configured: call uploadBuffer');
  }
  downloadToLocal(): Promise<void> {
    throw new Error('OSS not configured: call downloadToLocal');
  }
  delete(): Promise<void> {
    throw new Error('OSS not configured: call delete');
  }
  deleteDir(): Promise<void> {
    throw new Error('OSS not configured: call deleteDir');
  }
  getUrl(_key: string): string {
    throw new Error('OSS not configured: call getUrl');
  }
  getSize(): Promise<number> {
    throw new Error('OSS not configured: call getSize');
  }
  listFiles(): Promise<string[]> {
    throw new Error('OSS not configured: call listFiles');
  }
}
