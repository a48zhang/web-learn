const mockConfig = {
  port: 3001,
  jwt: { secret: 'test-secret', expiresIn: '7d' },
  cors: { origins: ['http://localhost:5173', 'http://127.0.0.1:5173'] },
  database: { host: 'localhost', port: 3306, name: 'web_learn', user: 'root', password: '' },
};

jest.mock('../src/utils/config', () => ({ config: mockConfig }));

import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockUserModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  findByPk: jest.fn(),
};

jest.mock('../src/models', () => ({
  User: mockUserModel,
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
  TokenExpiredError: class TokenExpiredError extends Error {},
  JsonWebTokenError: class JsonWebTokenError extends Error {},
}));

import app from '../src/app';

describe('Auth Service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /health', () => {
    it('returns healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.service).toBe('auth');
    });
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user successfully', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue({
        id: 1, username: 'alice', email: 'alice@example.com', role: 'user',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

      const res = await request(app).post('/api/auth/register').send({
        username: 'alice', email: 'alice@example.com', password: 'password123',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBe('mock-jwt-token');
      expect(res.body.data.user).toEqual({
        id: '1', username: 'alice', email: 'alice@example.com', role: 'user',
        createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-01T00:00:00.000Z',
      });
      expect(mockUserModel.create).toHaveBeenCalledWith({
        id: expect.any(String), username: 'alice', email: 'alice@example.com', password: 'password123', role: 'user',
      });
    });

    it('rejects registration when required fields are missing', async () => {
      const res = await request(app).post('/api/auth/register').send({ email: 'alice@example.com' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: 'Username, email, and password are required' });
    });

    it('rejects duplicate username or email', async () => {
      mockUserModel.findOne.mockResolvedValue({ id: 99 });
      const res = await request(app).post('/api/auth/register').send({
        username: 'alice', email: 'alice@example.com', password: 'password123',
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, error: 'Username or email already exists' });
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const comparePassword = jest.fn().mockResolvedValue(true);
      mockUserModel.findOne.mockResolvedValue({
        id: 2, username: 'bob', email: 'bob@example.com', role: 'user',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        comparePassword,
      });
      (jwt.sign as jest.Mock).mockReturnValue('login-token');

      const res = await request(app).post('/api/auth/login').send({
        email: 'bob@example.com', password: 'secret123',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.token).toBe('login-token');
      expect(comparePassword).toHaveBeenCalledWith('secret123');
    });

    it('rejects invalid credentials when user does not exist', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      const res = await request(app).post('/api/auth/login').send({
        email: 'nobody@example.com', password: 'wrong',
      });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ success: false, error: 'Invalid credentials' });
    });

    it('rejects invalid credentials when password does not match', async () => {
      const comparePassword = jest.fn().mockResolvedValue(false);
      mockUserModel.findOne.mockResolvedValue({
        id: 3, username: 'charlie', email: 'charlie@example.com', role: 'user', comparePassword,
      });
      const res = await request(app).post('/api/auth/login').send({
        email: 'charlie@example.com', password: 'wrong-password',
      });
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ success: false, error: 'Invalid credentials' });
    });
  });

  describe('GET /api/users/me', () => {
    it('returns the current user for a valid token', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 5 });
      mockUserModel.findByPk
        .mockResolvedValueOnce({ id: 5, username: 'diana', email: 'diana@example.com', role: 'user' })
        .mockResolvedValueOnce({
          id: 5, username: 'diana', email: 'diana@example.com', role: 'user',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-01T01:00:00.000Z'),
        });

      const res = await request(app).get('/api/users/me').set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ id: '5', username: 'diana' });
      expect(mockUserModel.findByPk).toHaveBeenNthCalledWith(1, 5, {
        attributes: ['id', 'username', 'email', 'role'],
      });
    });

    it('rejects requests without a token', async () => {
      const res = await request(app).get('/api/users/me');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ success: false, error: 'No token, authorization denied' });
    });
  });
});
