import { extractTarball } from './tarUtils';

const MIME_MAP: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getMime(path: string): string {
  const extIndex = path.lastIndexOf('.');
  if (extIndex < 0) return 'application/octet-stream';
  return MIME_MAP[path.slice(extIndex).toLowerCase()] || 'application/octet-stream';
}

export async function buildPublishedHtml(
  buffer: ArrayBuffer
): Promise<{ html: string; blobUrls: string[] }> {
  const files = extractTarball(buffer);
  const indexHtml = files['index.html'];
  if (!indexHtml) {
    throw new Error('index.html not found in published files');
  }

  const blobUrlMap: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    if (path === 'index.html') continue;
    const blob = new Blob([content], { type: getMime(path) });
    blobUrlMap[path] = URL.createObjectURL(blob);
  }

  let html = indexHtml;
  for (const [path, blobUrl] of Object.entries(blobUrlMap)) {
    const normalizedPath = path.replace(/^\.?\//, '');
    const pathPattern = escapeRegExp(normalizedPath);
    html = html.replace(new RegExp(`([\"'])/?${pathPattern}\\1`, 'g'), `$1${blobUrl}$1`);
    html = html.replace(new RegExp(`([\"'])\\.\\/${pathPattern}\\1`, 'g'), `$1${blobUrl}$1`);
  }

  return { html, blobUrls: Object.values(blobUrlMap) };
}
