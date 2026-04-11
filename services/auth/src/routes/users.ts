import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middlewares/authMiddleware';
import { getMe } from '../controllers/userController';

const router: Router = Router();

const readLimiter = rateLimit({ windowMs: 60000, max: 300, standardHeaders: true, legacyHeaders: false });

router.get('/me', readLimiter, authMiddleware, getMe);
export default router;
