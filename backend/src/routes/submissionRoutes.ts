import express, { Router } from 'express';
import { getMySubmissions, downloadSubmissionAttachment } from '../controllers/submissionController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router.use(authMiddleware);

// GET /api/submissions/me - Get my submissions (student)
router.get('/me', getMySubmissions);

// GET /api/submissions/:id/attachment - Download a submission attachment with authorization
router.get('/:id/attachment', downloadSubmissionAttachment);

export default router;
