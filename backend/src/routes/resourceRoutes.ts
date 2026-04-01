import express, { Router } from 'express';
import {
  downloadResource,
  deleteResource,
} from '../controllers/resourceController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router.use(authMiddleware);

// GET /api/resources/:id/download - Download resource
router.get('/:id/download', downloadResource);

// DELETE /api/resources/:id - Delete resource
router.delete('/:id', deleteResource);

export default router;
