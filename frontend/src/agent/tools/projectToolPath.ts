import { normalizeProjectPath } from '../../utils/projectPaths';

export function parseProjectToolPath(value: unknown, fieldName = 'path'): string | { content: string; isError: true } {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { content: `${fieldName} is required and must be a string`, isError: true };
  }

  try {
    return normalizeProjectPath(value.trim());
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'invalid project path';
    return {
      content: `${fieldName} must be a project-root-relative path such as src/App.tsx. ${reason}`,
      isError: true,
    };
  }
}
