import express, { Router } from 'express';
import {
  submitTask,
  getSubmissionsForTask,
} from '../controllers/submissionController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { upload } from '../middlewares/uploadMiddleware';

const router: Router = express.Router();

router.use(authMiddleware);

// POST /api/tasks/:id/submit - Submit task (student only)
router.post('/:id/submit', upload.single('file'), submitTask);

// GET /api/tasks/:id/submissions - Get submissions for task (teacher)
router.get('/:id/submissions', getSubmissionsForTask);

export default router;
