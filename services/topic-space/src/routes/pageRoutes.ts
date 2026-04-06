import express, { Router } from 'express';
import { internalAuthMiddleware } from '@web-learn/shared';
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

router.post('/topics/:id/pages', writeLimiter, internalAuthMiddleware, createPage);
router.get('/topics/:id/pages', readLimiter, optionalAuthMiddleware, getPagesByTopic);
router.get('/pages/:id', readLimiter, optionalAuthMiddleware, getPageById);
router.put('/pages/:id', writeLimiter, internalAuthMiddleware, updatePage);
router.delete('/pages/:id', writeLimiter, internalAuthMiddleware, deletePage);
router.patch('/topics/:id/pages/reorder', writeLimiter, internalAuthMiddleware, reorderPages);

export default router;
