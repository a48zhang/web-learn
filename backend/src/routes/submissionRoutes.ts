import express, { Router } from 'express';
import { getMySubmissions } from '../controllers/submissionController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router.use(authMiddleware);

// GET /api/submissions/me - Get my submissions (student)
router.get('/me', getMySubmissions);

export default router;
