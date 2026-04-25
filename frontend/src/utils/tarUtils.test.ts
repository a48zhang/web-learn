import { describe, expect, it } from 'vitest';
import { createBinaryTarball, createTarball, extractBinaryTarball, extractTarball } from './tarUtils';

describe('tarUtils', () => {
  it('round-trips text files through the legacy string helpers', () => {
    const tarball = createTarball({
      'src/App.tsx': 'export default function App() { return null; }',
    });

    expect(extractTarball(tarball)).toEqual({
      'src/App.tsx': 'export default function App() { return null; }',
    });
  });

  it('round-trips binary files without UTF-8 corruption', () => {
    const binary = new Uint8Array([0, 255, 128, 64, 10]);
    const tarball = createBinaryTarball({
      'assets/image.bin': binary,
    });

    expect(extractBinaryTarball(tarball)['assets/image.bin']).toEqual(binary);
  });

  it('rejects unsafe paths when creating a tarball', () => {
    expect(() => createTarball({ '/absolute.txt': 'bad' })).toThrow(/relative/i);
    expect(() => createTarball({ '../escape.txt': 'bad' })).toThrow(/dot segments/i);
    expect(() => createTarball({ 'src//App.tsx': 'bad' })).toThrow(/repeated slashes/i);
  });

  it('throws on paths too long for the current tar header format', () => {
    const longPath = `${'a'.repeat(101)}.txt`;

    expect(() => createTarball({ [longPath]: 'too long' })).toThrow(/too long/i);
  });
});
