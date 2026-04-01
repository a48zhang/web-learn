import request from 'supertest';
import jwt from 'jsonwebtoken';

const mockUserModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  findByPk: jest.fn(),
};

const mockTopicModel = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
};

jest.mock('../src/models', () => ({
  User: mockUserModel,
  Topic: mockTopicModel,
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

describe('Topics API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/topics', () => {
    it('creates a topic for a teacher', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'teacher',
      });
      mockTopicModel.create.mockResolvedValue({
        id: 7,
        title: 'Jest Basics',
        description: 'Testing fundamentals',
        created_by: 10,
        status: 'draft',
        deadline: new Date('2026-05-01T00:00:00.000Z'),
        created_at: new Date('2026-04-01T00:00:00.000Z'),
        updated_at: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .post('/api/topics')
        .set('Authorization', 'Bearer teacher-token')
        .send({
          title: 'Jest Basics',
          description: 'Testing fundamentals',
          deadline: '2026-05-01',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: '7',
        title: 'Jest Basics',
        description: 'Testing fundamentals',
        createdBy: '10',
        status: 'draft',
        deadline: '2026-05-01T00:00:00.000Z',
      });
      expect(mockTopicModel.create).toHaveBeenCalledWith({
        title: 'Jest Basics',
        description: 'Testing fundamentals',
        created_by: 10,
        deadline: new Date('2026-05-01'),
        status: 'draft',
      });
    });

    it('rejects topic creation for non-teachers', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 11 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 11,
        username: 'student1',
        email: 'student@example.com',
        role: 'student',
      });

      const response = await request(app)
        .post('/api/topics')
        .set('Authorization', 'Bearer student-token')
        .send({ title: 'Should Fail' });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        error: 'Only teachers can create topics',
      });
      expect(mockTopicModel.create).not.toHaveBeenCalled();
    });

    it('rejects topic creation without title', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 12 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 12,
        username: 'teacher2',
        email: 'teacher2@example.com',
        role: 'teacher',
      });

      const response = await request(app)
        .post('/api/topics')
        .set('Authorization', 'Bearer teacher-token')
        .send({ description: 'Missing title' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Title is required',
      });
    });
  });

  describe('GET /api/topics', () => {
    it('returns teacher-owned topics for a teacher user', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 20 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 20,
        username: 'teacher3',
        email: 'teacher3@example.com',
        role: 'teacher',
      });
      mockTopicModel.findAll.mockResolvedValue([
        {
          id: 1,
          title: 'Topic A',
          description: 'Owned by teacher',
          created_by: 20,
          status: 'draft',
          deadline: new Date('2026-04-10T00:00:00.000Z'),
          created_at: new Date('2026-04-01T00:00:00.000Z'),
          updated_at: new Date('2026-04-02T00:00:00.000Z'),
          creator: {
            id: 20,
            username: 'teacher3',
            email: 'teacher3@example.com',
          },
        },
      ]);

      const response = await request(app)
        .get('/api/topics')
        .set('Authorization', 'Bearer teacher-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        id: '1',
        title: 'Topic A',
        createdBy: '20',
        status: 'draft',
        creator: {
          id: '20',
          username: 'teacher3',
          email: 'teacher3@example.com',
        },
      });
      expect(mockTopicModel.findAll).toHaveBeenCalledWith({
        where: { created_by: 20 },
        include: [{ model: mockUserModel, as: 'creator', attributes: ['id', 'username', 'email'] }],
        order: [['created_at', 'DESC']],
      });
    });

    it('returns only published topics for a student user', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 21 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 21,
        username: 'student2',
        email: 'student2@example.com',
        role: 'student',
      });
      mockTopicModel.findAll.mockResolvedValue([
        {
          id: 2,
          title: 'Published Topic',
          description: 'Visible to students',
          created_by: 30,
          status: 'published',
          deadline: undefined,
          created_at: new Date('2026-04-03T00:00:00.000Z'),
          updated_at: new Date('2026-04-03T01:00:00.000Z'),
          creator: {
            id: 30,
            username: 'teacher4',
            email: 'teacher4@example.com',
          },
        },
      ]);

      const response = await request(app)
        .get('/api/topics')
        .set('Authorization', 'Bearer student-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data[0]).toMatchObject({
        id: '2',
        title: 'Published Topic',
        status: 'published',
        createdBy: '30',
      });
      expect(mockTopicModel.findAll).toHaveBeenCalledWith({
        where: { status: 'published' },
        include: [{ model: mockUserModel, as: 'creator', attributes: ['id', 'username', 'email'] }],
        order: [['created_at', 'DESC']],
      });
    });

    it('rejects topic listing without a token', async () => {
      const response = await request(app).get('/api/topics');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: 'No token, authorization denied',
      });
    });
  });
});
