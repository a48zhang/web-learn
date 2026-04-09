import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/integration'],
  testMatch: ['**/*.spec.ts'],
  clearMocks: true,
  testTimeout: 30000,
};

export default config;
