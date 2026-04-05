import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  ContainerClient,
  BlockBlobClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  SASProtocol,
} from '@azure/storage-blob';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import type { StorageService } from './storageService';

export class AzureBlobStorage implements StorageService {
  private blobServiceClient: BlobServiceClient;
  private containerName: string;
  private cdnBase?: string;
  private accountName: string;
  private accountKey: string;
  private accountUrl: string;

  constructor(options: {
    accountName: string;
    accountKey: string;
    containerName: string;
    cdnBase?: string;
  }) {
    this.accountUrl = `https://${options.accountName}.blob.core.windows.net`;
    this.blobServiceClient = new BlobServiceClient(
      this.accountUrl,
      new StorageSharedKeyCredential(options.accountName, options.accountKey)
    );
    this.containerName = options.containerName;
    this.cdnBase = options.cdnBase;
    this.accountName = options.accountName;
    this.accountKey = options.accountKey;
  }

  private getContainerClient(): ContainerClient {
    return this.blobServiceClient.getContainerClient(this.containerName);
  }

  private getBlockBlobClient(ossKey: string): BlockBlobClient {
    return this.getContainerClient().getBlockBlobClient(this.normalizeKey(ossKey));
  }

  private normalizeKey(ossKey: string): string {
    return ossKey.startsWith('/') ? ossKey.slice(1) : ossKey;
  }

  /** Generate a short-lived SAS URL for a blob (read permission, 8-hour expiry). */
  private generateSasUrl(blobName: string): string {
    // Use container-level SAS so the URL can be opened directly in a browser.
    // sr=c means container-scoped SAS (required for direct blob access URLs).
    const sasOptions = {
      containerName: this.containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      expiresOn: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
      protocol: SASProtocol.Https,
    };
    const sasToken = generateBlobSASQueryParameters(
      sasOptions,
      new StorageSharedKeyCredential(this.accountName, this.accountKey)
    ).toString();
    return `${this.accountUrl}/${this.containerName}/${blobName}?${sasToken}`;
  }

  async uploadFile(localPath: string, ossKey: string): Promise<string> {
    const client = this.getBlockBlobClient(ossKey);
    await client.uploadFile(localPath, {
      blobHTTPHeaders: { blobContentType: 'application/octet-stream' },
    });
    return this.getUrl(ossKey);
  }

  async uploadBuffer(buffer: Buffer, ossKey: string): Promise<string> {
    const client = this.getBlockBlobClient(ossKey);
    await client.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: 'application/octet-stream' },
    });
    return this.getUrl(ossKey);
  }

  async downloadToLocal(ossKey: string, localPath: string): Promise<void> {
    const client = this.getBlockBlobClient(ossKey);
    const response = await client.download(0);
    const blobBody = await response.blobBody;
    if (!blobBody) throw new Error(`Empty body for ${ossKey}`);
    await pipeline(blobBody as unknown as NodeJS.ReadableStream, createWriteStream(localPath));
  }

  async delete(ossKey: string): Promise<void> {
    const client = this.getBlockBlobClient(ossKey);
    await client.delete();
  }

  async deleteDir(prefix: string): Promise<void> {
    const containerClient = this.getContainerClient();
    const normalizedPrefix = this.normalizeKey(prefix);
    const searchPrefix = normalizedPrefix.endsWith('/')
      ? normalizedPrefix
      : normalizedPrefix + '/';

    let marker: string | undefined;
    do {
      const pages = containerClient.listBlobsFlat({ prefix: searchPrefix }).byPage({
        maxPageSize: 1000,
        ...(marker && { continuationToken: marker }),
      });
      const response = await pages.next();
      if (response.done) break;
      const page = response.value;
      for (const blobItem of page.segment?.blobItems ?? []) {
        await containerClient.deleteBlob(blobItem.name);
      }
      marker = page.continuationToken;
    } while (marker);
  }

  getUrl(ossKey: string): string {
    const normalizedKey = this.normalizeKey(ossKey);
    if (this.cdnBase) {
      const base = this.cdnBase.endsWith('/') ? this.cdnBase.slice(0, -1) : this.cdnBase;
      return `${base}/${normalizedKey}`;
    }
    // blobServiceClient.url already ends with account name (no trailing slash),
    // containerName is the blob name prefix, so we need containerName/key
    return this.generateSasUrl(normalizedKey);
  }

  async getSize(ossKey: string): Promise<number> {
    try {
      const client = this.getBlockBlobClient(ossKey);
      const props = await client.getProperties();
      return props.contentLength ?? 0;
    } catch (err: unknown) {
      const e = err as { statusCode?: number };
      if (e.statusCode === 404) return 0;
      throw err;
    }
  }

  async listFiles(prefix: string): Promise<string[]> {
    const containerClient = this.getContainerClient();
    const normalizedPrefix = this.normalizeKey(prefix);
    const searchPrefix = normalizedPrefix.endsWith('/')
      ? normalizedPrefix
      : normalizedPrefix + '/';

    const keys: string[] = [];
    let marker: string | undefined;
    do {
      const pages = containerClient.listBlobsFlat({ prefix: searchPrefix }).byPage({
        maxPageSize: 1000,
        ...(marker && { continuationToken: marker }),
      });
      const response = await pages.next();
      if (response.done) break;
      const page = response.value;
      for (const blobItem of page.segment?.blobItems ?? []) {
        keys.push(blobItem.name);
      }
      marker = page.continuationToken;
    } while (marker);
    return keys;
  }
}

