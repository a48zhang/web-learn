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

const router: Router = express.Router();

router.post('/topics/:id/pages', authMiddleware, createPage);
router.get('/topics/:id/pages', optionalAuthMiddleware, getPagesByTopic);
router.get('/pages/:id', optionalAuthMiddleware, getPageById);
router.put('/pages/:id', authMiddleware, updatePage);
router.delete('/pages/:id', authMiddleware, deletePage);
router.patch('/topics/:id/pages/reorder', authMiddleware, reorderPages);

export default router;
