const mockConfig = {
  port: 3001,
  jwt: {
    secret: 'test-secret',
    expiresIn: '7d',
  },
  cors: {
    origins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  },
  database: {
    host: 'localhost',
    port: 3306,
    name: 'web_learn',
    user: 'root',
    password: '',
  },
  uploadsDir: '/tmp/web-learn-test-uploads',
};

jest.mock('../src/utils/config', () => ({
  config: mockConfig,
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockUserModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  findByPk: jest.fn(),
};

jest.mock('../src/models', () => ({
  User: mockUserModel,
  Topic: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  Resource: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  Task: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  Submission: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
  Review: {
    create: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
  },
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
  TokenExpiredError: class TokenExpiredError extends Error {},
  JsonWebTokenError: class JsonWebTokenError extends Error {},
}));

import app from '../src/app';

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('registers a new user successfully', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue({
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        role: 'student',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });
      (jwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'alice',
          email: 'alice@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('mock-jwt-token');
      expect(response.body.data.user).toEqual({
        id: '1',
        username: 'alice',
        email: 'alice@example.com',
        role: 'student',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      });
      expect(mockUserModel.findOne).toHaveBeenCalled();
      expect(mockUserModel.create).toHaveBeenCalledWith({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
        role: 'student',
      });
    });

    it('rejects registration when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'alice@example.com' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Username, email, and password are required',
      });
      expect(mockUserModel.findOne).not.toHaveBeenCalled();
    });

    it('forces public registration to student even when a privileged role is requested', async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.create.mockResolvedValue({
        id: 4,
        username: 'eve',
        email: 'eve@example.com',
        role: 'student',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });
      (jwt.sign as jest.Mock).mockReturnValue('forced-student-token');

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'eve',
          email: 'eve@example.com',
          password: 'password123',
          role: 'admin',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.user).toMatchObject({
        id: '4',
        role: 'student',
      });
      expect(mockUserModel.create).toHaveBeenCalledWith({
        username: 'eve',
        email: 'eve@example.com',
        password: 'password123',
        role: 'student',
      });
    });

    it('rejects duplicate username or email', async () => {
      mockUserModel.findOne.mockResolvedValue({ id: 99 });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'alice',
          email: 'alice@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Username or email already exists',
      });
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with valid credentials', async () => {
      const comparePassword = jest.fn().mockResolvedValue(true);
      mockUserModel.findOne.mockResolvedValue({
        id: 2,
        username: 'bob',
        email: 'bob@example.com',
        role: 'teacher',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        comparePassword,
      });
      (jwt.sign as jest.Mock).mockReturnValue('login-token');

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'bob@example.com',
          password: 'secret123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('login-token');
      expect(response.body.data.user).toEqual({
        id: '2',
        username: 'bob',
        email: 'bob@example.com',
        role: 'teacher',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      });
      expect(comparePassword).toHaveBeenCalledWith('secret123');
    });

    it('rejects invalid credentials when user does not exist', async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nobody@example.com',
          password: 'wrong',
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid credentials',
      });
    });

    it('rejects invalid credentials when password does not match', async () => {
      const comparePassword = jest.fn().mockResolvedValue(false);
      mockUserModel.findOne.mockResolvedValue({
        id: 3,
        username: 'charlie',
        email: 'charlie@example.com',
        role: 'student',
        comparePassword,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'charlie@example.com',
          password: 'wrong-password',
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid credentials',
      });
    });
  });

  describe('GET /api/users/me', () => {
    it('returns the current user for a valid token', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 5 });
      mockUserModel.findByPk
        .mockResolvedValueOnce({
          id: 5,
          username: 'diana',
          email: 'diana@example.com',
          role: 'student',
        })
        .mockResolvedValueOnce({
          id: 5,
          username: 'diana',
          email: 'diana@example.com',
          role: 'student',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
          updatedAt: new Date('2026-04-01T01:00:00.000Z'),
        });

      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: '5',
        username: 'diana',
        email: 'diana@example.com',
        role: 'student',
      });
      expect(mockUserModel.findByPk).toHaveBeenNthCalledWith(1, 5, {
        attributes: ['id', 'username', 'email', 'role'],
      });
      expect(mockUserModel.findByPk).toHaveBeenNthCalledWith(2, 5);
    });

    it('rejects requests without a token', async () => {
      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: 'No token, authorization denied',
      });
    });
  });
});
