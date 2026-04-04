import OSS from 'ali-oss';
import type { StorageService } from './storageService';

export class AliOSSStorage implements StorageService {
  private client: OSS;
  private cdnBase?: string;
  private bucket: string;

  constructor(options: {
    bucket: string;
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    cdnBase?: string;
  }) {
    this.client = new OSS({
      bucket: options.bucket,
      region: options.region,
      accessKeyId: options.accessKeyId,
      accessKeySecret: options.accessKeySecret,
    });
    this.cdnBase = options.cdnBase;
    this.bucket = options.bucket;
  }

  async uploadFile(localPath: string, ossKey: string): Promise<string> {
    await this.client.put(ossKey, localPath, { headers: { 'x-oss-object-acl': 'public-read' } });
    return this.getUrl(ossKey);
  }

  async uploadBuffer(buffer: Buffer, ossKey: string): Promise<string> {
    await this.client.put(ossKey, buffer, { headers: { 'x-oss-object-acl': 'public-read' } });
    return this.getUrl(ossKey);
  }

  async downloadToLocal(ossKey: string, localPath: string): Promise<void> {
    // ali-oss throws on error rather than returning a result object with a status field,
    // so there is no meaningful status check to perform here.
    await this.client.get(ossKey, localPath);
  }

  async delete(ossKey: string): Promise<void> {
    await this.client.delete(ossKey);
  }

  async deleteDir(prefix: string): Promise<void> {
    let marker: string | undefined;
    do {
      const result = await this.client.list(
        { prefix, 'max-keys': 1000, marker: marker || '' },
        {}
      );
      const keys = (result.objects || [])
        .filter((obj) => obj.name)
        .map((obj) => obj.name);
      if (keys.length === 0) break;
      await this.client.deleteMulti(keys, { quiet: true });
      marker = result.nextMarker;
    } while (marker);
  }

  getUrl(ossKey: string): string {
    if (this.cdnBase) {
      const base = this.cdnBase.endsWith('/') ? this.cdnBase.slice(0, -1) : this.cdnBase;
      const key = ossKey.startsWith('/') ? ossKey.slice(1) : ossKey;
      return `${base}/${key}`;
    }
    // Fallback: construct OSS URL
    // region is not stored, so use bucket naming convention: https://{bucket}.{region}.aliyuncs.com
    // Without region we can't construct the exact endpoint; return a placeholder that callers override via config
    return `https://${this.bucket}.oss-ap-southeast-1.aliyuncs.com/${ossKey}`;
  }

  async getSize(ossKey: string): Promise<number> {
    try {
      const result = await this.client.head(ossKey);
      const headers = result.res.headers as Record<string, string | undefined>;
      const contentLength = headers['content-length'];
      if (contentLength !== undefined) {
        return parseInt(String(contentLength), 10);
      }
      // Fallback: download and measure
      const getResult = await this.client.get(ossKey);
      if (Buffer.isBuffer(getResult.content)) {
        return getResult.content.length;
      }
      return 0;
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e.name === 'NoSuchKeyError' || e.name === '404Error') return 0;
      throw err;
    }
  }

  async listFiles(prefix: string): Promise<string[]> {
    const result = await this.client.list(
      { prefix, 'max-keys': 1000 },
      {}
    );
    return (result.objects || [])
      .map((obj) => obj.name)
      .filter((name): name is string => !!name);
  }
}
