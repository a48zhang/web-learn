module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  collectCoverageFrom: [
    'src/controllers/**/*.ts',
    'src/routes/**/*.ts',
    'src/middlewares/**/*.ts',
    '!src/server.ts',
  ],
};
