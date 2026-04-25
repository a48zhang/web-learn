import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBinaryTarball, createTarball } from './tarUtils';
import { buildPublishedHtml } from './rewriteAssetUrls';

describe('buildPublishedHtml', () => {
  const createdBlobs: Blob[] = [];

  beforeEach(() => {
    createdBlobs.length = 0;
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      value: vi.fn((blob: Blob) => {
        createdBlobs.push(blob);
        return 'blob:test-url';
      }),
      writable: true,
    });
  });

  it('rewrites built asset URLs to blob URLs', async () => {
    const tarball = createTarball({
      'index.html': '<!doctype html><html><head><link rel="stylesheet" href="/assets/index.css"></head><body><script type="module" src="/assets/index.js"></script></body></html>',
      'assets/index.css': 'body{background:#fff;}',
      'assets/index.js': 'console.log("ok");',
    });

    const result = await buildPublishedHtml(tarball);
    expect(result.html).toContain('blob:');
    expect(result.html).not.toContain('/assets/index.css');
    expect(result.html).not.toContain('/assets/index.js');
    expect(result.blobUrls).toHaveLength(2);
  });

  it('keeps binary asset bytes intact when creating blob URLs', async () => {
    const imageBytes = new Uint8Array([0, 255, 128, 64]);
    const tarball = createBinaryTarball({
      'index.html': '<img src="/assets/image.png">',
      'assets/image.png': imageBytes,
    });

    await buildPublishedHtml(tarball);

    expect(createdBlobs).toHaveLength(1);
    expect(createdBlobs[0].type).toBe('image/png');
    await expect(createdBlobs[0].arrayBuffer()).resolves.toEqual(imageBytes.buffer);
  });
});
