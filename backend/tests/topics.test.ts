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

const mockTopicModel = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
};

const mockTopicMemberModel = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
};

jest.mock('../src/models', () => ({
  User: mockUserModel,
  Topic: mockTopicModel,
  TopicMember: mockTopicMemberModel,
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

// Mock sequelize to avoid real database connections
const mockTransaction = {
  commit: jest.fn(),
  rollback: jest.fn(),
};

jest.mock('../src/utils/database', () => ({
  sequelize: {
    transaction: jest.fn((callback) => callback(mockTransaction)),
    authenticate: jest.fn(),
    sync: jest.fn(),
  },
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
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });
      mockTopicMemberModel.create.mockResolvedValue({
        id: 1,
        topic_id: 7,
        user_id: 10,
        joined_at: new Date('2026-04-01T00:00:00.000Z'),
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
        deadline: '2026-05-01',
      });
      expect(mockTopicModel.create).toHaveBeenCalledWith({
        title: 'Jest Basics',
        description: 'Testing fundamentals',
        created_by: 10,
        deadline: new Date('2026-05-01'),
        status: 'draft',
      });
      expect(mockTopicMemberModel.create).toHaveBeenCalledWith({
        topic_id: 7,
        user_id: 10,
        joined_at: expect.any(Date),
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
  });

  describe('GET /api/topics', () => {
    it('lists teacher-owned topics for teachers', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'teacher',
      });
      mockTopicModel.findAll.mockResolvedValue([
        {
          id: 7,
          title: 'Jest Basics',
          description: 'Testing fundamentals',
          created_by: 10,
          status: 'draft',
          deadline: new Date('2026-05-01T00:00:00.000Z'),
          created_at: new Date('2026-04-01T00:00:00.000Z'),
          updated_at: new Date('2026-04-01T00:00:00.000Z'),
          creator: {
            id: 10,
            username: 'teacher1',
            email: 'teacher@example.com',
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
        id: '7',
        title: 'Jest Basics',
        createdBy: '10',
        status: 'draft',
      });
      expect(mockTopicModel.findAll).toHaveBeenCalledWith({
        where: { created_by: 10 },
        include: [{ model: mockUserModel, as: 'creator', attributes: ['id', 'username', 'email'] }],
        order: [['created_at', 'DESC']],
      });
    });

    it('lists only published topics for students', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 11 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 11,
        username: 'student1',
        email: 'student@example.com',
        role: 'student',
      });
      mockTopicModel.findAll.mockResolvedValue([
        {
          id: 8,
          title: 'Algorithms',
          description: 'Graphs and trees',
          created_by: 10,
          status: 'published',
          deadline: undefined,
          created_at: new Date('2026-04-02T00:00:00.000Z'),
          updated_at: new Date('2026-04-02T00:00:00.000Z'),
          creator: {
            id: 10,
            username: 'teacher1',
            email: 'teacher@example.com',
          },
        },
        {
          id: 9,
          title: 'Data Structures',
          description: 'Arrays and linked lists',
          created_by: 10,
          status: 'published',
          deadline: undefined,
          created_at: new Date('2026-04-03T00:00:00.000Z'),
          updated_at: new Date('2026-04-03T00:00:00.000Z'),
          creator: {
            id: 10,
            username: 'teacher1',
            email: 'teacher@example.com',
          },
        },
      ]);
      mockTopicMemberModel.findAll.mockResolvedValue([
        { topic_id: 8 },
      ]);

      const response = await request(app)
        .get('/api/topics')
        .set('Authorization', 'Bearer student-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toMatchObject({
        id: '8',
        title: 'Algorithms',
        status: 'published',
        hasJoined: true,
      });
      expect(response.body.data[1]).toMatchObject({
        id: '9',
        title: 'Data Structures',
        status: 'published',
        hasJoined: false,
      });
      expect(mockTopicMemberModel.findAll).toHaveBeenCalledWith({
        where: { user_id: 11 },
        attributes: ['topic_id'],
      });
      expect(mockTopicModel.findAll).toHaveBeenCalledWith({
        where: { status: 'published' },
        include: [{ model: mockUserModel, as: 'creator', attributes: ['id', 'username', 'email'] }],
        order: [['created_at', 'DESC']],
      });
    });
  });

  describe('GET /api/topics/:id', () => {
    it('denies access for student not joined to topic', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 11 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 11,
        username: 'student1',
        email: 'student@example.com',
        role: 'student',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 8,
        title: 'Algorithms',
        description: 'Graphs and trees',
        created_by: 10,
        status: 'published',
        deadline: undefined,
        created_at: new Date('2026-04-02T00:00:00.000Z'),
        updated_at: new Date('2026-04-02T00:00:00.000Z'),
        creator: {
          id: 10,
          username: 'teacher1',
          email: 'teacher@example.com',
        },
      });
      mockTopicMemberModel.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/topics/8')
        .set('Authorization', 'Bearer student-token');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        error: 'Access denied. You have not joined this topic.',
      });
    });

    it('allows access for student who joined the topic', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 11 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 11,
        username: 'student1',
        email: 'student@example.com',
        role: 'student',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 8,
        title: 'Algorithms',
        description: 'Graphs and trees',
        created_by: 10,
        status: 'published',
        deadline: undefined,
        created_at: new Date('2026-04-02T00:00:00.000Z'),
        updated_at: new Date('2026-04-02T00:00:00.000Z'),
        creator: {
          id: 10,
          username: 'teacher1',
          email: 'teacher@example.com',
        },
      });
      mockTopicMemberModel.findOne.mockResolvedValue({
        id: 1,
        topic_id: 8,
        user_id: 11,
        joined_at: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .get('/api/topics/8')
        .set('Authorization', 'Bearer student-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: '8',
        title: 'Algorithms',
        status: 'published',
      });
    });

    it('allows access for teacher who created the topic', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'teacher',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 8,
        title: 'Algorithms',
        description: 'Graphs and trees',
        created_by: 10,
        status: 'published',
        deadline: undefined,
        created_at: new Date('2026-04-02T00:00:00.000Z'),
        updated_at: new Date('2026-04-02T00:00:00.000Z'),
        creator: {
          id: 10,
          username: 'teacher1',
          email: 'teacher@example.com',
        },
      });

      const response = await request(app)
        .get('/api/topics/8')
        .set('Authorization', 'Bearer teacher-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: '8',
        title: 'Algorithms',
      });
    });
  });

  describe('POST /api/topics/:id/join', () => {
    it('allows student to join a published topic', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 11 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 11,
        username: 'student1',
        email: 'student@example.com',
        role: 'student',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 8,
        title: 'Algorithms',
        description: 'Graphs and trees',
        created_by: 10,
        status: 'published',
        deadline: undefined,
        created_at: new Date('2026-04-02T00:00:00.000Z'),
        updated_at: new Date('2026-04-02T00:00:00.000Z'),
      });
      mockTopicMemberModel.findOne.mockResolvedValue(null);
      mockTopicMemberModel.create.mockResolvedValue({
        id: 1,
        topic_id: 8,
        user_id: 11,
        joined_at: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .post('/api/topics/8/join')
        .set('Authorization', 'Bearer student-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        message: 'Successfully joined the topic',
      });
      expect(mockTopicMemberModel.create).toHaveBeenCalledWith({
        topic_id: 8,
        user_id: 11,
        joined_at: expect.any(Date),
      });
    });

    it('rejects student from joining a draft topic', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 11 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 11,
        username: 'student1',
        email: 'student@example.com',
        role: 'student',
      });
      mockTopicModel.findByPk.mockResolvedValue({
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
        .post('/api/topics/7/join')
        .set('Authorization', 'Bearer student-token');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        error: 'Cannot join a topic that is not published',
      });
      expect(mockTopicMemberModel.create).not.toHaveBeenCalled();
    });

    it('rejects duplicate join attempts', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 11 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 11,
        username: 'student1',
        email: 'student@example.com',
        role: 'student',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 8,
        title: 'Algorithms',
        description: 'Graphs and trees',
        created_by: 10,
        status: 'published',
        deadline: undefined,
        created_at: new Date('2026-04-02T00:00:00.000Z'),
        updated_at: new Date('2026-04-02T00:00:00.000Z'),
      });
      mockTopicMemberModel.findOne.mockResolvedValue({
        id: 1,
        topic_id: 8,
        user_id: 11,
        joined_at: new Date('2026-04-01T00:00:00.000Z'),
      });

      const response = await request(app)
        .post('/api/topics/8/join')
        .set('Authorization', 'Bearer student-token');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Already joined this topic',
      });
      expect(mockTopicMemberModel.create).not.toHaveBeenCalled();
    });

    it('rejects teacher from joining a topic', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 10 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 10,
        username: 'teacher1',
        email: 'teacher@example.com',
        role: 'teacher',
      });

      const response = await request(app)
        .post('/api/topics/8/join')
        .set('Authorization', 'Bearer teacher-token');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        error: 'Only students can join topics',
      });
      expect(mockTopicMemberModel.create).not.toHaveBeenCalled();
    });
  });
});
