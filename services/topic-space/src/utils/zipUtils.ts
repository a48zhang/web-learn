import * as yauzl from 'yauzl';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { StorageService } from '../services/storageService';

export interface ZipExtractResult {
  tempDir: string;
  indexPath: string | null; // resolved local path of index.html
}

/**
 * Extract a ZIP from a Buffer to a temporary directory.
 * Returns the temp dir path and the resolved index.html path.
 *
 * SECURITY: implements zip slip protection - rejects any entry whose
 * resolved path escapes the destination directory.
 */
export async function extractZipToTempDir(
  zipBuffer: Buffer,
  options: { indexOnly?: boolean } = {}
): Promise<ZipExtractResult> {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'website-'));
  let indexPath: string | null = null;

  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) { reject(err); return; }

      zipfile.on('entry', (entry: yauzl.Entry) => {
        const destPath = path.join(tempDir, entry.fileName);
        // Zip slip protection
        if (!destPath.startsWith(tempDir + path.sep)) {
          console.warn(`[zipUtils] Zip slip attempt blocked: ${entry.fileName}`);
          zipfile.readEntry();
          return; // skip malicious entry
        }

        const dir = path.dirname(destPath);
        fs.promises.mkdir(dir, { recursive: true }).then(() => {
          if (entry.fileName.endsWith('/')) {
            zipfile.readEntry();
            return;
          }

          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) { reject(err); return; }
            const writeStream = fs.createWriteStream(destPath);
            readStream!.pipe(writeStream);
            writeStream.on('close', () => {
              if (!options.indexOnly && entry.fileName === 'index.html') {
                indexPath = destPath;
              }
              zipfile.readEntry();
            });
          });
        }).catch(reject);
      });

      zipfile.on('end', () => resolve());
      zipfile.on('error', reject);
      zipfile.readEntry();
    });
  });

  // If index.html wasn't captured during extraction, search for it
  if (!indexPath) {
    indexPath = await findIndexHtml(tempDir);
  }

  return { tempDir, indexPath };
}

async function findIndexHtml(dir: string): Promise<string | null> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name === 'index.html') {
      return path.join(dir, entry.name);
    }
    if (entry.isDirectory()) {
      const found = await findIndexHtml(path.join(dir, entry.name));
      if (found) return found;
    }
  }
  return null;
}

/**
 * Recursively upload a local directory to OSS.
 * Returns the public URL of index.html (or first HTML file found).
 */
export async function uploadDirToOSS(
  localDir: string,
  topicId: number,
  storageService: StorageService
): Promise<string> {
  const prefix = `topics/${topicId}/`;
  let indexUrl: string | null = null;

  async function walk(dir: string, ossSubPath: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const localPath = path.join(dir, entry.name);
      const ossKey = prefix + ossSubPath + entry.name;

      if (entry.isDirectory()) {
        await walk(localPath, ossSubPath + entry.name + '/');
      } else {
        const fileBuffer = await fs.promises.readFile(localPath);
        await storageService.uploadBuffer(fileBuffer, ossKey);
        if (entry.name === 'index.html' || (!indexUrl && entry.name.endsWith('.html'))) {
          indexUrl = storageService.getUrl(ossKey);
        }
      }
    }
  }

  await walk(localDir, '');
  if (!indexUrl) {
    throw new Error('No HTML file found in ZIP archive');
  }
  return indexUrl;
}

/**
 * Clean up a temporary directory.
 */
export async function cleanupTempDir(tempDir: string): Promise<void> {
  await fs.promises.rm(tempDir, { recursive: true, force: true });
}
