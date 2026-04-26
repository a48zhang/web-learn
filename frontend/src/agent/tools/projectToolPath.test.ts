import { describe, expect, it } from 'vitest';
import { parseProjectToolPath } from './projectToolPath';

describe('parseProjectToolPath', () => {
  it('normalizes project-root-relative tool paths', () => {
    expect(parseProjectToolPath('src/App.tsx')).toBe('src/App.tsx');
    expect(parseProjectToolPath('./src/App.tsx')).toBe('src/App.tsx');
  });

  it('rejects absolute paths so file tools cannot pollute EditorStore keys', () => {
    expect(parseProjectToolPath('/home/project/src/App.tsx')).toEqual({
      content: expect.stringContaining('project-root-relative path'),
      isError: true,
    });
  });
});
