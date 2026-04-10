// Minimal POSIX tar packer/unpacker for browser use
// No external dependencies, uses TextEncoder/TextDecoder

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function writeOctal(value: number, length: number): Uint8Array {
  const octal = value.toString(8).padStart(length, '0');
  return TEXT_ENCODER.encode(octal);
}

function writeString(value: string, maxLength: number): Uint8Array {
  const bytes = new Uint8Array(maxLength);
  const encoded = TEXT_ENCODER.encode(value);
  bytes.set(encoded.subarray(0, Math.min(maxLength, encoded.length)));
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
  const chunks: Uint8Array[] = [];

  for (const [path, content] of Object.entries(files)) {
    const contentBytes = TEXT_ENCODER.encode(content);
    const header = createTarHeader(path, contentBytes.length);
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
  const bytes = new Uint8Array(buffer);
  const files: Record<string, string> = {};
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
    const fileName = TEXT_DECODER.decode(header.subarray(0, nameEnd)).trim();
    if (!fileName) continue;

    // Read file size (12 bytes, octal)
    const sizeStr = TEXT_DECODER.decode(header.subarray(124, 136)).trim();
    const size = parseInt(sizeStr, 8);

    // Read file content
    if (offset + size > bytes.length) break;
    const content = TEXT_DECODER.decode(bytes.subarray(offset, offset + size));
    files[fileName] = content;

    // Skip padding
    offset += Math.ceil(size / 512) * 512;
  }

  return files;
}
