import { describe, expect, it } from 'vitest';
import { normalizeProjectPath, toWcAbsolutePath } from './projectPaths';

describe('projectPaths', () => {
  it('normalizes accepted project paths', () => {
    expect(normalizeProjectPath('src/App.tsx')).toBe('src/App.tsx');
    expect(normalizeProjectPath('./src/App.tsx')).toBe('src/App.tsx');
    expect(normalizeProjectPath('src/components/Button.tsx')).toBe('src/components/Button.tsx');
    expect(toWcAbsolutePath(normalizeProjectPath('src/App.tsx'))).toBe('/home/project/src/App.tsx');
  });

  it('rejects empty, absolute, and malformed project paths', () => {
    expect(() => normalizeProjectPath('')).toThrow(/empty/i);
    expect(() => normalizeProjectPath('/src/App.tsx')).toThrow(/absolute/i);
    expect(() => normalizeProjectPath('.')).toThrow(/dot segments/i);
    expect(() => normalizeProjectPath('..')).toThrow(/dot segments/i);
    expect(() => normalizeProjectPath('src//App.tsx')).toThrow(/repeated slashes/i);
    expect(() => normalizeProjectPath('src/./App.tsx')).toThrow(/dot segments/i);
    expect(() => normalizeProjectPath('src/../App.tsx')).toThrow(/dot segments/i);
    expect(() => normalizeProjectPath('src\\App.tsx')).toThrow(/backslashes/i);
    expect(() => normalizeProjectPath(`src\0App.tsx`)).toThrow(/NUL/i);
  });
});
