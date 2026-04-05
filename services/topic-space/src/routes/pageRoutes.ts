import express, { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { optionalAuthMiddleware } from '../middlewares/optionalAuthMiddleware';
import {
  createPage,
  getPagesByTopic,
  getPageById,
  updatePage,
  deletePage,
  reorderPages,
} from '../controllers/pageController';
import rateLimit from 'express-rate-limit';

const router: Router = express.Router();

const readLimiter = rateLimit({ windowMs: 60000, max: 300 });
const writeLimiter = rateLimit({ windowMs: 60000, max: 100 });

router.post('/topics/:id/pages', writeLimiter, authMiddleware, createPage);
router.get('/topics/:id/pages', readLimiter, optionalAuthMiddleware, getPagesByTopic);
router.get('/pages/:id', readLimiter, optionalAuthMiddleware, getPageById);
router.put('/pages/:id', writeLimiter, authMiddleware, updatePage);
router.delete('/pages/:id', writeLimiter, authMiddleware, deletePage);
router.patch('/topics/:id/pages/reorder', writeLimiter, authMiddleware, reorderPages);

export default router;
