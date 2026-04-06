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
} from '../controllers/topicController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { optionalAuthMiddleware } from '../middlewares/optionalAuthMiddleware';
import { upload } from '../middlewares/uploadMiddleware';
import rateLimit from 'express-rate-limit';

const router: Router = express.Router();

const readLimiter = rateLimit({ windowMs: 60000, max: 300 });
const writeLimiter = rateLimit({ windowMs: 60000, max: 100 });
const uploadLimiter = rateLimit({ windowMs: 60000, max: 20 });

router.post('/', writeLimiter, authMiddleware, createTopic);
router.get('/', readLimiter, optionalAuthMiddleware, getTopics);
router.get('/:id', readLimiter, optionalAuthMiddleware, getTopicById);
router.put('/:id', writeLimiter, authMiddleware, updateTopic);
router.patch('/:id/status', writeLimiter, authMiddleware, updateTopicStatus);
router.delete('/:id', writeLimiter, authMiddleware, deleteTopic);
router.post('/:id/website/upload', uploadLimiter, authMiddleware, upload.single('file'), uploadWebsite);
router.put('/:id/website/upload', uploadLimiter, authMiddleware, upload.single('file'), uploadWebsite);
router.delete('/:id/website', writeLimiter, authMiddleware, deleteWebsite);
router.get('/:id/website/stats', readLimiter, authMiddleware, getWebsiteStats);

export default router;
