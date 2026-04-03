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
import fs from 'fs';

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

const mockResourceModel = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
};

const mockTaskModel = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
};

const mockSubmissionModel = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
};

const mockReviewModel = {
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
};

jest.mock('../src/models', () => ({
  User: mockUserModel,
  Topic: mockTopicModel,
  TopicMember: mockTopicMemberModel,
  Resource: mockResourceModel,
  Task: mockTaskModel,
  Submission: mockSubmissionModel,
  Review: mockReviewModel,
}));

jest.mock('../src/middlewares/uploadMiddleware', () => ({
  upload: {
    single: () => (req: any, _res: any, next: any) => {
      const originalName = req.header('x-test-original-name');
      const filename = req.header('x-test-file');

      if (filename) {
        req.file = {
          filename,
          originalname: originalName || filename,
        };
      }

      next();
    },
  },
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
  TokenExpiredError: class TokenExpiredError extends Error {},
  JsonWebTokenError: class JsonWebTokenError extends Error {},
}));

import app from '../src/app';
import { downloadResource, deleteResource } from '../src/controllers/resourceController';
import {
  submitTask,
  getSubmissionsForTask,
  getMySubmissions,
} from '../src/controllers/submissionController';

const createMockResponse = () => {
  const response: any = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  response.download = jest.fn().mockReturnValue(response);
  return response;
};

describe('Workflow API coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('PATCH /api/topics/:id/status', () => {
    it('publishes a teacher-owned topic', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      (jwt.verify as jest.Mock).mockReturnValue({ id: 41 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 41,
        username: 'teacher-one',
        email: 'teacher1@example.com',
        role: 'teacher',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 8,
        title: 'Algorithms',
        description: 'Graph practice',
        created_by: 41,
        status: 'draft',
        deadline: new Date('2026-05-01T00:00:00.000Z'),
        created_at: new Date('2026-04-01T00:00:00.000Z'),
        updated_at: new Date('2026-04-01T00:00:00.000Z'),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        save,
      });

      const response = await request(app)
        .patch('/api/topics/8/status')
        .set('Authorization', 'Bearer teacher-token')
        .send({ status: 'published' });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: '8',
        status: 'published',
      });
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('closes a teacher-owned topic', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      (jwt.verify as jest.Mock).mockReturnValue({ id: 41 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 41,
        username: 'teacher-one',
        email: 'teacher1@example.com',
        role: 'teacher',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 8,
        title: 'Algorithms',
        description: 'Graph practice',
        created_by: 41,
        status: 'published',
        deadline: undefined,
        created_at: new Date('2026-04-01T00:00:00.000Z'),
        updated_at: new Date('2026-04-01T00:00:00.000Z'),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        save,
      });

      const response = await request(app)
        .patch('/api/topics/8/status')
        .set('Authorization', 'Bearer teacher-token')
        .send({ status: 'closed' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('closed');
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('rejects status updates from non-owners', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 55 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 55,
        username: 'teacher-two',
        email: 'teacher2@example.com',
        role: 'teacher',
      });
      mockTopicModel.findByPk.mockResolvedValue({
        id: 8,
        title: 'Algorithms',
        description: 'Graph practice',
        created_by: 41,
        status: 'draft',
      });

      const response = await request(app)
        .patch('/api/topics/8/status')
        .set('Authorization', 'Bearer teacher-token')
        .send({ status: 'published' });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        error: 'Access denied',
      });
    });
  });

  describe('App security middleware', () => {
    it('allows cross-origin requests (CORS is open for development)', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'https://example.com');

      expect(response.status).toBe(200);
    });

    it('does not expose uploaded files through a public static route', async () => {
      const response = await request(app).get('/uploads/secret.pdf');

      expect(response.status).toBe(404);
    });
  });

  describe('Resource controller branches', () => {
    it('returns the URI when downloading a link resource', async () => {
      const response = createMockResponse();
      const req = {
        user: { id: 77, role: 'student' },
        params: { id: '16' },
      } as any;

      mockResourceModel.findByPk.mockResolvedValue({
        id: 16,
        type: 'link',
        title: 'Reference',
        uri: 'https://example.com/reference',
        topic: {
          id: 12,
          created_by: 41,
          status: 'published',
        },
      });
      mockTopicMemberModel.findOne.mockResolvedValue({
        id: 1,
        topic_id: 12,
        user_id: 77,
      });

      await downloadResource(req, response);

      expect(mockResourceModel.findByPk).toHaveBeenCalledWith(16, {
        include: [{ model: mockTopicModel, as: 'topic' }],
      });
      expect(response.json).toHaveBeenCalledWith({
        success: true,
        data: { uri: 'https://example.com/reference' },
      });
    });

    it('denies resource downloads for unauthorised teachers', async () => {
      const response = createMockResponse();
      const req = {
        user: { id: 99, role: 'teacher' },
        params: { id: '18' },
      } as any;

      mockResourceModel.findByPk.mockResolvedValue({
        id: 18,
        type: 'document',
        title: 'week1.pdf',
        uri: '/uploads/week1.pdf',
        topic: {
          id: 12,
          created_by: 41,
          status: 'published',
        },
      });

      await downloadResource(req, response);

      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied',
      });
    });

    it('returns 404 when a downloadable file is missing', async () => {
      const response = createMockResponse();
      const req = {
        user: { id: 77, role: 'student' },
        params: { id: '18' },
      } as any;

      mockResourceModel.findByPk.mockResolvedValue({
        id: 18,
        type: 'document',
        title: 'missing.pdf',
        uri: '/uploads/missing.pdf',
        topic: {
          id: 12,
          created_by: 41,
          status: 'published',
        },
      });
      mockTopicMemberModel.findOne.mockResolvedValue({
        id: 1,
        topic_id: 12,
        user_id: 77,
      });
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      await downloadResource(req, response);

      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        error: 'File not found',
      });
    });

    it('deletes a file resource and removes the file from disk', async () => {
      const destroy = jest.fn().mockResolvedValue(undefined);
      const response = createMockResponse();
      const req = {
        user: { id: 41, role: 'teacher' },
        params: { id: '22' },
      } as any;

      mockResourceModel.findByPk.mockResolvedValue({
        id: 22,
        owner_id: 41,
        type: 'document',
        uri: '/uploads/week1.pdf',
        destroy,
      });
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);

      await deleteResource(req, response);

      expect(unlinkSpy).toHaveBeenCalledTimes(1);
      expect(destroy).toHaveBeenCalledTimes(1);
      expect(response.json).toHaveBeenCalledWith({
        success: true,
        message: 'Resource deleted successfully',
      });
    });
  });

  describe('Submission controller flows', () => {
    it('creates a submission for a student on a published topic before deadline', async () => {
      const response = createMockResponse();
      const req = {
        params: { id: '31' },
        body: { content: 'My answer' },
        user: { id: 77, role: 'student' },
      } as any;

      mockTaskModel.findByPk.mockResolvedValue({
        id: 31,
        title: 'Essay',
        topic: {
          id: 12,
          status: 'published',
          deadline: '2026-05-01',
        },
      });
      mockTopicMemberModel.findOne.mockResolvedValue({
        id: 1,
        topic_id: 12,
        user_id: 77,
      });
      mockSubmissionModel.findOne.mockResolvedValue(null);
      mockSubmissionModel.create.mockResolvedValue({
        id: 91,
        task_id: 31,
        student_id: 77,
        content: 'My answer',
        file_url: undefined,
        submitted_at: new Date('2026-04-01T10:00:00.000Z'),
      });

      await submitTask(req, response);

      expect(mockSubmissionModel.findOne).toHaveBeenCalledWith({
        where: {
          task_id: 31,
          student_id: 77,
        },
      });
      expect(response.status).toHaveBeenCalledWith(201);
      expect(response.json).toHaveBeenCalledWith({
        success: true,
        data: {
          id: '91',
          taskId: '31',
          studentId: '77',
          content: 'My answer',
          fileUrl: undefined,
          submittedAt: '2026-04-01T10:00:00.000Z',
        },
      });
    });

    it('rejects submissions for draft topics', async () => {
      const response = createMockResponse();
      const req = {
        params: { id: '31' },
        body: { content: 'My answer' },
        user: { id: 77, role: 'student' },
      } as any;

      mockTaskModel.findByPk.mockResolvedValue({
        id: 31,
        title: 'Essay',
        topic: {
          id: 12,
          status: 'draft',
          deadline: '2026-05-01',
        },
      });

      await submitTask(req, response);

      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        error: 'Task submissions are only allowed for published topics',
      });
      expect(mockSubmissionModel.findOne).not.toHaveBeenCalled();
    });

    it('rejects submissions after the deadline', async () => {
      const response = createMockResponse();
      const req = {
        params: { id: '31' },
        body: { content: 'Late answer' },
        user: { id: 77, role: 'student' },
      } as any;

      mockTaskModel.findByPk.mockResolvedValue({
        id: 31,
        title: 'Essay',
        topic: {
          id: 12,
          status: 'published',
          deadline: '2026-03-01',
        },
      });
      mockTopicMemberModel.findOne.mockResolvedValue({
        id: 1,
        topic_id: 12,
        user_id: 77,
      });

      await submitTask(req, response);

      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.json).toHaveBeenCalledWith({
        success: false,
        error: 'Submission deadline has passed',
      });
      expect(mockSubmissionModel.findOne).not.toHaveBeenCalled();
    });

    it('returns submissions for the task owner', async () => {
      const response = createMockResponse();
      const req = {
        params: { id: '31' },
        user: { id: 41, role: 'teacher' },
      } as any;

      mockTaskModel.findByPk.mockResolvedValue({
        id: 31,
        created_by: 41,
        topic: { id: 12, title: 'Algorithms' },
      });
      mockSubmissionModel.findAll.mockResolvedValue([
        {
          id: 91,
          task_id: 31,
          student_id: 77,
          content: 'My answer',
          file_url: '/uploads/answer.txt',
          submitted_at: new Date('2026-04-01T10:00:00.000Z'),
          student: {
            id: 77,
            username: 'student-one',
            email: 'student@example.com',
          },
        },
      ]);

      await getSubmissionsForTask(req, response);

      expect(response.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: '91',
            taskId: '31',
            studentId: '77',
            content: 'My answer',
            fileUrl: '/api/submissions/91/attachment',
            submittedAt: '2026-04-01T10:00:00.000Z',
            student: {
              id: '77',
              username: 'student-one',
              email: 'student@example.com',
            },
          },
        ],
      });
    });

    it('returns the current student submissions', async () => {
      const response = createMockResponse();
      const req = {
        user: { id: 77, role: 'student' },
      } as any;

      mockSubmissionModel.findAll.mockResolvedValue([
        {
          id: 91,
          task_id: 31,
          student_id: 77,
          content: 'My answer',
          file_url: '/uploads/answer.txt',
          submitted_at: new Date('2026-04-01T10:00:00.000Z'),
          task: {
            id: 31,
            title: 'Essay',
            topic: {
              id: 12,
              title: 'Algorithms',
            },
          },
        },
      ]);

      await getMySubmissions(req, response);

      expect(response.json).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: '91',
            taskId: '31',
            studentId: '77',
            content: 'My answer',
            fileUrl: '/api/submissions/91/attachment',
            submittedAt: '2026-04-01T10:00:00.000Z',
            task: {
              id: '31',
              title: 'Essay',
              topic: {
                id: '12',
                title: 'Algorithms',
              },
            },
          },
        ],
      });
    });
  });

  describe('Review endpoints', () => {
    it('rejects review creation when the score is out of range', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 41 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 41,
        username: 'teacher-one',
        email: 'teacher1@example.com',
        role: 'teacher',
      });

      const response = await request(app)
        .post('/api/submissions/91/review')
        .set('Authorization', 'Bearer teacher-token')
        .send({ score: 101, feedback: 'Too high' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Score must be a number between 0 and 100',
      });
      expect(mockSubmissionModel.findByPk).not.toHaveBeenCalled();
    });

    it('rejects review updates when the score is out of range', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 41 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 41,
        username: 'teacher-one',
        email: 'teacher1@example.com',
        role: 'teacher',
      });

      const response = await request(app)
        .put('/api/reviews/7')
        .set('Authorization', 'Bearer teacher-token')
        .send({ score: -1, feedback: 'Too low' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Score must be a number between 0 and 100',
      });
      expect(mockReviewModel.findByPk).not.toHaveBeenCalled();
    });

    it('creates a review for a submission owned by the teacher topic', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 41 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 41,
        username: 'teacher-one',
        email: 'teacher1@example.com',
        role: 'teacher',
      });
      mockSubmissionModel.findByPk.mockResolvedValue({
        id: 91,
        task: {
          id: 31,
          topic: {
            id: 12,
            created_by: 41,
          },
        },
      });
      mockReviewModel.findOne.mockResolvedValue(null);
      mockReviewModel.create.mockResolvedValue({
        id: 7,
        submission_id: 91,
        reviewer_id: 41,
        score: 95,
        feedback: 'Strong work',
        reviewed_at: new Date('2026-04-01T12:00:00.000Z'),
      });

      const response = await request(app)
        .post('/api/submissions/91/review')
        .set('Authorization', 'Bearer teacher-token')
        .send({ score: 95, feedback: 'Strong work' });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        id: '7',
        submissionId: '91',
        reviewerId: '41',
        score: 95,
        feedback: 'Strong work',
      });
    });

    it('returns a review for the submitting student', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({ id: 77 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 77,
        username: 'student-one',
        email: 'student@example.com',
        role: 'student',
      });
      mockReviewModel.findOne.mockResolvedValue({
        id: 7,
        submission_id: 91,
        reviewer_id: 41,
        score: 95,
        feedback: 'Strong work',
        reviewed_at: new Date('2026-04-01T12:00:00.000Z'),
        reviewer: {
          id: 41,
          username: 'teacher-one',
          email: 'teacher1@example.com',
        },
        submission: {
          id: 91,
          student_id: 77,
        },
      });

      const response = await request(app)
        .get('/api/submissions/91/review')
        .set('Authorization', 'Bearer student-token');

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: '7',
        submissionId: '91',
        reviewer: {
          id: '41',
          username: 'teacher-one',
          email: 'teacher1@example.com',
        },
        score: 95,
      });
    });

    it('updates a review for the reviewer teacher', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      (jwt.verify as jest.Mock).mockReturnValue({ id: 41 });
      mockUserModel.findByPk.mockResolvedValue({
        id: 41,
        username: 'teacher-one',
        email: 'teacher1@example.com',
        role: 'teacher',
      });
      mockReviewModel.findByPk.mockResolvedValue({
        id: 7,
        submission_id: 91,
        reviewer_id: 41,
        score: 80,
        feedback: 'Needs more detail',
        reviewed_at: new Date('2026-04-01T12:00:00.000Z'),
        submission: {
          task: {
            topic: {
              created_by: 41,
            },
          },
        },
        save,
      });

      const response = await request(app)
        .put('/api/reviews/7')
        .set('Authorization', 'Bearer teacher-token')
        .send({ score: 88, feedback: 'Improved analysis' });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        id: '7',
        score: 88,
        feedback: 'Improved analysis',
      });
      expect(save).toHaveBeenCalledTimes(1);
    });
  });
});
