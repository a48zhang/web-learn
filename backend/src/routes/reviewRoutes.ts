import express, { Router } from 'express';
import {
  createReview,
  getReviewBySubmissionId,
  updateReview,
} from '../controllers/reviewController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router: Router = express.Router();

// All review routes require authentication
router.use(authMiddleware);

// POST /api/submissions/:id/review - Create review for submission (teacher only)
router.post('/submissions/:id/review', createReview);

// GET /api/submissions/:id/review - Get review for submission
router.get('/submissions/:id/review', getReviewBySubmissionId);

// PUT /api/reviews/:id - Update review
router.put('/reviews/:id', updateReview);

export default router;
