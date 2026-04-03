import express, { Router } from 'express';
import {
  createTopic,
  getTopics,
  getTopicById,
  updateTopic,
  updateTopicStatus,
  uploadWebsite,
  updateWebsite,
  deleteWebsite,
  getWebsiteStats,
} from '../controllers/topicController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { optionalAuthMiddleware } from '../middlewares/optionalAuthMiddleware';
import { upload } from '../middlewares/uploadMiddleware';
import { readLimiter, uploadLimiter, writeLimiter } from '../middlewares/rateLimitMiddleware';

const router: Router = express.Router();

// POST /api/topics - Create topic (teacher only)
router.post('/', writeLimiter, authMiddleware, createTopic);

// GET /api/topics - Get topic list
router.get('/', readLimiter, optionalAuthMiddleware, getTopics);

// GET /api/topics/:id - Get topic detail
router.get('/:id', readLimiter, optionalAuthMiddleware, getTopicById);

// PUT /api/topics/:id - Update topic (owner only)
router.put('/:id', writeLimiter, authMiddleware, updateTopic);

// PATCH /api/topics/:id/status - Publish/close topic
router.patch('/:id/status', writeLimiter, authMiddleware, updateTopicStatus);

// Website topic routes
router.post('/:id/website/upload', uploadLimiter, authMiddleware, upload.single('file'), uploadWebsite);
router.put('/:id/website/upload', uploadLimiter, authMiddleware, upload.single('file'), updateWebsite);
router.delete('/:id/website', writeLimiter, authMiddleware, deleteWebsite);
router.get('/:id/website/stats', readLimiter, authMiddleware, getWebsiteStats);


export default router;
