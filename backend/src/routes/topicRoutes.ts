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
import { upload } from '../middlewares/uploadMiddleware';

const router: Router = express.Router();

// POST /api/topics - Create topic (teacher only)
router.post('/', authMiddleware, createTopic);

// GET /api/topics - Get topic list
router.get('/', getTopics);

// GET /api/topics/:id - Get topic detail
router.get('/:id', getTopicById);

// PUT /api/topics/:id - Update topic (owner only)
router.put('/:id', authMiddleware, updateTopic);

// PATCH /api/topics/:id/status - Publish/close topic
router.patch('/:id/status', authMiddleware, updateTopicStatus);

// Website topic routes
router.post('/:id/website/upload', authMiddleware, upload.single('file'), uploadWebsite);
router.put('/:id/website/upload', authMiddleware, upload.single('file'), updateWebsite);
router.delete('/:id/website', authMiddleware, deleteWebsite);
router.get('/:id/website/stats', authMiddleware, getWebsiteStats);


export default router;
