import express, { Router } from 'express';
import {
  createTopic,
  getTopics,
  getTopicById,
  updateTopic,
  updateTopicStatus,
} from '../controllers/topicController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// All topic routes require authentication
router.use(authMiddleware);

// POST /api/topics - Create topic (teacher only)
router.post('/', createTopic);

// GET /api/topics - Get topic list
router.get('/', getTopics);

// GET /api/topics/:id - Get topic detail
router.get('/:id', getTopicById);

// PUT /api/topics/:id - Update topic (owner only)
router.put('/:id', updateTopic);

// PATCH /api/topics/:id/status - Publish/close topic
router.patch('/:id/status', updateTopicStatus);

export default router;
