import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  ContainerClient,
  SASProtocol,
  BlobSASPermissions,
} from '@azure/storage-blob';
import { StorageService } from './storageService';

export class AzureBlobStorageService implements StorageService {
  private containerClient: ContainerClient;
  private sharedKeyCredential: StorageSharedKeyCredential;
  private containerName: string;

  constructor(connectionString: string, containerName: string) {
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is required');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerName = containerName;
    this.containerClient = blobServiceClient.getContainerClient(containerName);

    const parsed = this.parseConnectionString(connectionString);
    this.sharedKeyCredential = new StorageSharedKeyCredential(parsed.accountName, parsed.accountKey);
  }

  private parseConnectionString(connectionString: string): { accountName: string; accountKey: string } {
    const parts: Record<string, string> = {};
    for (const segment of connectionString.split(';')) {
      const eqIndex = segment.indexOf('=');
      if (eqIndex !== -1) {
        parts[segment.substring(0, eqIndex)] = segment.substring(eqIndex + 1);
      }
    }
    const accountName = parts['AccountName'] ?? '';
    const accountKey = parts['AccountKey'] ?? '';
    if (!accountName || !accountKey) {
      throw new Error('Connection string must contain AccountName and AccountKey');
    }
    return { accountName, accountKey };
  }

  async getPresignedUrl(
    blobName: string,
    method: 'GET' | 'PUT',
    contentType?: string,
    expiresInHours: number = 1,
  ): Promise<{ url: string; method: string }> {
    const blobClient = this.containerClient.getBlobClient(blobName);
    const startsOn = new Date();
    const expiresOn = new Date(startsOn);
    expiresOn.setHours(expiresOn.getHours() + expiresInHours);

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName,
        permissions: method === 'PUT'
          ? BlobSASPermissions.parse('rwc')
          : BlobSASPermissions.parse('r'),
        startsOn,
        expiresOn,
        protocol: SASProtocol.Https,
        contentType: method === 'PUT' && contentType ? contentType : undefined,
      },
      this.sharedKeyCredential,
    ).toString();

    return {
      url: `${blobClient.url}?${sasToken}`,
      method: method === 'PUT' ? 'PUT' : 'GET',
    };
  }

  async uploadFile(localPath: string, ossKey: string): Promise<string> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(ossKey);
    await blockBlobClient.uploadFile(localPath);
    return blockBlobClient.url;
  }

  async uploadBuffer(buffer: Buffer, ossKey: string): Promise<string> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(ossKey);
    await blockBlobClient.uploadData(buffer);
    return blockBlobClient.url;
  }

  async downloadToLocal(ossKey: string, localPath: string): Promise<void> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(ossKey);
    await blockBlobClient.downloadToFile(localPath);
  }

  async delete(ossKey: string): Promise<void> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(ossKey);
    await blockBlobClient.delete();
  }

  async deleteDir(prefix: string): Promise<void> {
    for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
      await this.containerClient.deleteBlob(blob.name);
    }
  }

  getUrl(ossKey: string): string {
    return this.containerClient.getBlobClient(ossKey).url;
  }

  async getSize(ossKey: string): Promise<number> {
    const properties = await this.containerClient.getBlobClient(ossKey).getProperties();
    return properties.contentLength ?? 0;
  }

  async listFiles(prefix: string): Promise<string[]> {
    const blobs = [];
    for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
      blobs.push(blob.name);
    }
    return blobs;
  }
}

export function createAzureBlobStorageService(
  connectionString: string,
  containerName: string,
): AzureBlobStorageService {
  return new AzureBlobStorageService(connectionString, containerName);
}
