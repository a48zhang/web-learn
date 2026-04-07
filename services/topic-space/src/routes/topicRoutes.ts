import express, { Router } from 'express';
import {
  createTopic,
  getTopics,
  getTopicById,
  updateTopic,
  updateTopicStatus,
  deleteTopic,
  uploadWebsite,
  deleteWebsite,
  getWebsiteStats,
  saveFilesSnapshot,
  saveChatHistory,
} from '../controllers/topicController';
import { internalAuthMiddleware } from '@web-learn/shared';
import { optionalAuthMiddleware } from '../middlewares/optionalAuthMiddleware';
import { upload } from '../middlewares/uploadMiddleware';
import rateLimit from 'express-rate-limit';

const router: Router = express.Router();

const readLimiter = rateLimit({ windowMs: 60000, max: 300 });
const writeLimiter = rateLimit({ windowMs: 60000, max: 100 });
const uploadLimiter = rateLimit({ windowMs: 60000, max: 20 });

router.post('/', writeLimiter, internalAuthMiddleware, createTopic);
router.get('/', readLimiter, optionalAuthMiddleware, getTopics);
router.get('/:id', readLimiter, optionalAuthMiddleware, getTopicById);
router.put('/:id', writeLimiter, internalAuthMiddleware, updateTopic);
router.patch('/:id/status', writeLimiter, internalAuthMiddleware, updateTopicStatus);
router.delete('/:id', writeLimiter, internalAuthMiddleware, deleteTopic);
router.post('/:id/website/upload', uploadLimiter, internalAuthMiddleware, upload.single('file'), uploadWebsite);
router.put('/:id/website/upload', uploadLimiter, internalAuthMiddleware, upload.single('file'), uploadWebsite);
router.delete('/:id/website', writeLimiter, internalAuthMiddleware, deleteWebsite);
router.get('/:id/website/stats', readLimiter, internalAuthMiddleware, getWebsiteStats);
router.put('/:id/files', writeLimiter, internalAuthMiddleware, saveFilesSnapshot);
router.put('/:id/chat-history', writeLimiter, internalAuthMiddleware, saveChatHistory);

export default router;
