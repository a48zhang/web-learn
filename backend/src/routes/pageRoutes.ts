import express, { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
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
router.get('/topics/:id/pages', getPagesByTopic);
router.get('/pages/:id', getPageById);
router.put('/pages/:id', authMiddleware, updatePage);
router.delete('/pages/:id', authMiddleware, deletePage);
router.patch('/topics/:id/pages/reorder', authMiddleware, reorderPages);

export default router;
