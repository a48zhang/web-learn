import { config } from './utils/config';
import { AliOSSStorage } from './services/aliOSSStorage';
import { NullStorageService } from './services/nullStorage';
import { initStorageService } from './services/storageService';

export { getStorageService } from './services/storageService';
export { initStorageService } from './services/storageService';

export async function initStorage(): Promise<void> {
  const cfg = config;
  if (cfg.storage?.provider === 'oss') {
    initStorageService(
      new AliOSSStorage({
        bucket: cfg.storage.bucket!,
        region: cfg.storage.region!,
        accessKeyId: cfg.storage.accessKeyId!,
        accessKeySecret: cfg.storage.accessKeySecret!,
        cdnBase: cfg.storage.cdnBase || undefined,
      })
    );
  } else {
    // Development mode: use NullStorageService so that any accidental OSS call
    // throws an informative error rather than crashing with a cryptic NPE.
    initStorageService(new NullStorageService());
    console.warn('[storage] OSS not configured, using NullStorageService');
  }
}
