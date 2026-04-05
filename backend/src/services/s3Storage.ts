import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import type { StorageService } from './storageService';

export class S3Storage implements StorageService {
  private client: S3Client;
  private bucket: string;
  private cdnBase?: string;

  constructor(options: {
    bucket: string;
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    cdnBase?: string;
    /** Custom S3-compatible endpoint (e.g. Azure S3 compatibility, MinIO) */
    endpoint?: string;
    /** Required for MinIO and some S3-compatible services */
    forcePathStyle?: boolean;
  }) {
    this.client = new S3Client({
      region: options.region,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.accessKeySecret,
      },
      ...(options.endpoint && {
        endpoint: options.endpoint,
        forcePathStyle: options.forcePathStyle ?? true,
      }),
    });
    this.bucket = options.bucket;
    this.cdnBase = options.cdnBase;
  }

  async uploadFile(localPath: string, ossKey: string): Promise<string> {
    const { readFileSync } = await import('fs');
    const body = readFileSync(localPath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: ossKey,
        Body: body,
        ACL: 'public-read',
      })
    );
    return this.getUrl(ossKey);
  }

  async uploadBuffer(buffer: Buffer, ossKey: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: ossKey,
        Body: buffer,
        ACL: 'public-read',
      })
    );
    return this.getUrl(ossKey);
  }

  async downloadToLocal(ossKey: string, localPath: string): Promise<void> {
    const { createWriteStream } = await import('fs');
    const { pipeline } = await import('stream/promises');
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: ossKey })
    );
    if (!response.Body) throw new Error(`Empty body for ${ossKey}`);
    await pipeline(
      response.Body as NodeJS.ReadableStream,
      createWriteStream(localPath)
    );
  }

  async delete(ossKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: ossKey })
    );
  }

  async deleteDir(prefix: string): Promise<void> {
    let continuationToken: string | undefined;
    do {
      const listResult = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        })
      );

      const objects = listResult.Contents ?? [];
      if (objects.length === 0) break;

      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: objects.map((obj) => ({ Key: obj.Key! })),
            Quiet: true,
          },
        })
      );

      continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);
  }

  getUrl(ossKey: string): string {
    if (this.cdnBase) {
      const base = this.cdnBase.endsWith('/') ? this.cdnBase.slice(0, -1) : this.cdnBase;
      const key = ossKey.startsWith('/') ? ossKey.slice(1) : ossKey;
      return `${base}/${key}`;
    }
    // Use the resolved endpoint from the client
    const endpoint = (this.client as any).config?.endpoint;
    if (endpoint) {
      return `${endpoint}/${this.bucket}/${ossKey}`;
    }
    return `https://${this.bucket}.s3.amazonaws.com/${ossKey}`;
  }

  async getSize(ossKey: string): Promise<number> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: ossKey })
      );
      return result.ContentLength ?? 0;
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === 'NotFound' || e.name === 'NoSuchKey') return 0;
      throw err;
    }
  }

  async listFiles(prefix: string): Promise<string[]> {
    let continuationToken: string | undefined;
    const keys: string[] = [];
    do {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        })
      );
      keys.push(...(result.Contents ?? []).map((obj) => obj.Key!).filter(Boolean));
      continuationToken = result.NextContinuationToken;
    } while (continuationToken);
    return keys;
  }
}
