import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { getMe } from '../controllers/userController';

const router = Router();
router.get('/me', authMiddleware, getMe);
export default router;
