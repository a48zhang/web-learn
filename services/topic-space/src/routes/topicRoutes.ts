import express, { Router } from 'express';
import {
  createTopic,
  getTopics,
  getTopicById,
  updateTopic,
  updateTopicStatus,
  deleteTopic,
} from '../controllers/topicController';
import { getGitPresign } from '../controllers/gitPresignController';
import { internalAuthMiddleware } from '@web-learn/shared';
import { optionalAuthMiddleware } from '../middlewares/optionalAuthMiddleware';
import rateLimit from 'express-rate-limit';

const router: Router = express.Router();

const readLimiter = rateLimit({ windowMs: 60000, max: 300 });
const writeLimiter = rateLimit({ windowMs: 60000, max: 100 });

router.post('/', writeLimiter, internalAuthMiddleware, createTopic);
router.get('/', readLimiter, optionalAuthMiddleware, getTopics);
router.get('/:id', readLimiter, optionalAuthMiddleware, getTopicById);
router.put('/:id', writeLimiter, internalAuthMiddleware, updateTopic);
router.patch('/:id/status', writeLimiter, internalAuthMiddleware, updateTopicStatus);
router.delete('/:id', writeLimiter, internalAuthMiddleware, deleteTopic);
router.get('/:id/git/presign', writeLimiter, internalAuthMiddleware, getGitPresign);

export default router;
