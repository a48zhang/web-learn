import { config } from './utils/config';
import { AliOSSStorage } from './services/aliOSSStorage';
import { S3Storage } from './services/s3Storage';
import { AzureBlobStorage } from './services/azureBlobStorage';
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
  } else if (cfg.storage?.provider === 's3') {
    initStorageService(
      new S3Storage({
        bucket: cfg.storage.bucket!,
        region: cfg.storage.region || 'auto',
        accessKeyId: cfg.storage.accessKeyId!,
        accessKeySecret: cfg.storage.accessKeySecret!,
        cdnBase: cfg.storage.cdnBase || undefined,
        endpoint: cfg.storage.endpoint || undefined,
        forcePathStyle: cfg.storage.forcePathStyle ?? false,
      })
    );
    console.log('[storage] S3 storage initialized');
  } else if (cfg.storage?.provider === 'azure') {
    initStorageService(
      new AzureBlobStorage({
        accountName: cfg.storage.accountName!,
        accountKey: cfg.storage.accountKey!,
        containerName: cfg.storage.bucket!,
        cdnBase: cfg.storage.cdnBase || undefined,
      })
    );
    console.log('[storage] Azure Blob Storage initialized');
  } else {
    // Development mode: use NullStorageService so that any accidental OSS call
    // throws an informative error rather than crashing with a cryptic NPE.
    initStorageService(new NullStorageService());
    console.warn('[storage] OSS not configured, using NullStorageService');
  }
}
