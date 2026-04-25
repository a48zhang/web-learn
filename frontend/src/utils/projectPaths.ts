const WC_PROJECT_DIR = '/home/project';

declare const projectPathBrand: unique symbol;

export type ProjectPath = string & {
  readonly [projectPathBrand]: 'ProjectPath';
};

function assertValidProjectPath(input: string): void {
  if (input.length === 0) {
    throw new Error('Project path must not be empty');
  }

  if (input.includes('\0')) {
    throw new Error('Project path must not contain NUL bytes');
  }

  if (input.includes('\\')) {
    throw new Error('Project path must not contain backslashes');
  }

  if (input.startsWith('/')) {
    throw new Error('Project path must be root-relative, not absolute');
  }

  if (input === '.' || input === '..') {
    throw new Error('Project path must not contain dot segments');
  }

  if (input.includes('//')) {
    throw new Error('Project path must not contain repeated slashes');
  }

  const segments = input.split('/');
  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      throw new Error('Project path must not contain dot segments');
    }
    if (segment.length === 0) {
      throw new Error('Project path must not contain repeated slashes');
    }
  }
}

export function normalizeProjectPath(input: string): ProjectPath {
  let normalized = input;
  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  assertValidProjectPath(normalized);

  if (normalized.length === 0) {
    throw new Error('Project path must not be empty');
  }

  return normalized as ProjectPath;
}

export function toWcAbsolutePath(path: ProjectPath): string {
  return `${WC_PROJECT_DIR}/${path}`;
}
