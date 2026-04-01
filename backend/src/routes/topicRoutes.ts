import express, { Router } from 'express';
import {
  createTopic,
  getTopics,
  getTopicById,
  updateTopic,
  updateTopicStatus,
} from '../controllers/topicController';
import {
  uploadResource,
  getResources,
  downloadResource,
  deleteResource,
} from '../controllers/resourceController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/uploadMiddleware';

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

// Resource routes
// POST /api/topics/:id/resources - Upload resource to topic
router.post('/:id/resources', upload.single('file'), uploadResource);

// GET /api/topics/:id/resources - Get resources for topic
router.get('/:id/resources', getResources);

// GET /api/resources/:id/download - Download resource
router.get('/resources/:id/download', downloadResource);

// DELETE /api/resources/:id - Delete resource
router.delete('/resources/:id', deleteResource);

export default router;
