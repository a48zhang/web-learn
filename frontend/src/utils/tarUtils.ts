// Minimal POSIX tar packer/unpacker for browser use.
// No external dependencies, uses TextEncoder/TextDecoder.

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const MAX_TAR_NAME_BYTES = 100;

export type TarFileContent = string | Uint8Array;

function normalizeTarPath(path: string): string {
  let normalized = path;
  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  if (!normalized) {
    throw new Error('Tar path must not be empty');
  }
  if (normalized.includes('\0')) {
    throw new Error('Tar path must not contain NUL bytes');
  }
  if (normalized.includes('\\')) {
    throw new Error('Tar path must not contain backslashes');
  }
  if (normalized.startsWith('/')) {
    throw new Error('Tar path must be relative');
  }
  if (normalized.includes('//')) {
    throw new Error('Tar path must not contain repeated slashes');
  }

  const segments = normalized.split('/');
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..') {
      throw new Error('Tar path must not contain dot segments');
    }
  }

  const encoded = TEXT_ENCODER.encode(normalized);
  if (encoded.length > MAX_TAR_NAME_BYTES) {
    throw new Error(`Tar path is too long for the current tar format: ${normalized}`);
  }

  return normalized;
}

function writeOctal(value: number, length: number): Uint8Array {
  const octal = value.toString(8).padStart(length, '0');
  return TEXT_ENCODER.encode(octal);
}

function writeString(value: string, maxLength: number): Uint8Array {
  const bytes = new Uint8Array(maxLength);
  const encoded = TEXT_ENCODER.encode(value);
  if (encoded.length > maxLength) {
    throw new Error(`String is too long for tar header: ${value}`);
  }
  bytes.set(encoded);
  return bytes;
}

function checksum(header: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < 512; i++) {
    sum += header[i];
  }
  return sum;
}

function createTarHeader(path: string, size: number): Uint8Array {
  const header = new Uint8Array(512);

  // File name (100 bytes)
  header.set(writeString(path, 100), 0);

  // File mode (8 bytes)
  header.set(writeOctal(0o644, 8), 100);

  // UID (8 bytes)
  header.set(writeOctal(0, 8), 108);

  // GID (8 bytes)
  header.set(writeOctal(0, 8), 116);

  // File size (12 bytes)
  header.set(writeOctal(size, 12), 124);

  // Modification time (12 bytes)
  header.set(writeOctal(Math.floor(Date.now() / 1000), 12), 136);

  // Checksum placeholder (8 bytes) - spaces first
  header.set(TEXT_ENCODER.encode('        '), 148);

  // Type flag (1 byte) - regular file
  header[156] = TEXT_ENCODER.encode('0')[0];

  // Calculate and write checksum
  const sum = checksum(header);
  const sumOctal = sum.toString(8).padStart(6, '0') + '\0 ';
  header.set(TEXT_ENCODER.encode(sumOctal), 148);

  return header;
}

function padTo512(bytes: Uint8Array): Uint8Array {
  const padding = 512 - (bytes.length % 512);
  if (padding === 512) return bytes;
  const padded = new Uint8Array(bytes.length + padding);
  padded.set(bytes);
  return padded;
}

export function createTarball(files: Record<string, string>): ArrayBuffer {
  return createBinaryTarball(files);
}

export function createBinaryTarball(files: Record<string, TarFileContent>): ArrayBuffer {
  const chunks: Uint8Array[] = [];

  for (const [path, content] of Object.entries(files)) {
    const normalizedPath = normalizeTarPath(path);
    const contentBytes = typeof content === 'string' ? TEXT_ENCODER.encode(content) : content;
    const header = createTarHeader(normalizedPath, contentBytes.length);
    chunks.push(header);
    chunks.push(padTo512(contentBytes));
  }

  // Two empty blocks as EOF marker
  chunks.push(new Uint8Array(1024));

  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

export function extractTarball(buffer: ArrayBuffer): Record<string, string> {
  const binaryFiles = extractBinaryTarball(buffer);
  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(binaryFiles)) {
    files[path] = TEXT_DECODER.decode(content);
  }
  return files;
}

export function extractBinaryTarball(buffer: ArrayBuffer): Record<string, Uint8Array> {
  const bytes = new Uint8Array(buffer);
  const files: Record<string, Uint8Array> = {};
  let offset = 0;

  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    offset += 512;

    // Check if it's the EOF marker (all zeros)
    let isEmpty = true;
    for (let i = 0; i < 512; i++) {
      if (header[i] !== 0) {
        isEmpty = false;
        break;
      }
    }
    if (isEmpty) break;

    // Read file name (100 bytes, null-terminated)
    let nameEnd = 0;
    while (nameEnd < 100 && header[nameEnd] !== 0) nameEnd++;
    const fileName = normalizeTarPath(TEXT_DECODER.decode(header.subarray(0, nameEnd)).trim());
    if (!fileName) continue;

    // Read file size (12 bytes, octal)
    const sizeStr = TEXT_DECODER.decode(header.subarray(124, 136)).trim();
    const size = parseInt(sizeStr, 8);
    if (!Number.isFinite(size) || size < 0) {
      throw new Error(`Invalid tar file size for ${fileName}`);
    }

    // Read file content
    if (offset + size > bytes.length) break;
    const content = bytes.slice(offset, offset + size);
    files[fileName] = content;

    // Skip padding
    offset += Math.ceil(size / 512) * 512;
  }

  return files;
}
