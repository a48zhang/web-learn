import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTarball } from './tarUtils';
import { buildPublishedHtml } from './rewriteAssetUrls';

describe('buildPublishedHtml', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:test-url'),
      writable: true,
    });
  });

  it('rewrites built asset URLs to blob URLs', async () => {
    const tarball = createTarball({
      'index.html': '<!doctype html><html><head><link rel="stylesheet" href="/assets/index.css"></head><body><script type="module" src="/assets/index.js"></script></body></html>',
      'assets/index.css': 'body{background:#fff;}',
      'assets/index.js': 'console.log("ok");',
    });

    const html = await buildPublishedHtml(tarball);
    expect(html).toContain('blob:');
    expect(html).not.toContain('/assets/index.css');
    expect(html).not.toContain('/assets/index.js');
  });
});
