import { parseCorsOrigins } from './config';

describe('parseCorsOrigins', () => {
  afterEach(() => {
    delete process.env.CORS_ORIGINS;
  });

  it('returns defaults when CORS_ORIGINS not set', () => {
    delete process.env.CORS_ORIGINS;
    expect(parseCorsOrigins()).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
  });

  it('parses comma-separated origins', () => {
    process.env.CORS_ORIGINS = 'https://app.example.com,https://admin.example.com';
    expect(parseCorsOrigins()).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
    ]);
  });

  it('trims whitespace from origins', () => {
    process.env.CORS_ORIGINS = ' https://a.com , https://b.com ';
    expect(parseCorsOrigins()).toEqual(['https://a.com', 'https://b.com']);
  });
});
