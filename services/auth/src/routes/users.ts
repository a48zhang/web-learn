import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../middlewares/authMiddleware';
import { getMe, updateMe, changePassword } from '../controllers/userController';

const router: Router = Router();

const readLimiter = rateLimit({ windowMs: 60000, max: 300, standardHeaders: true, legacyHeaders: false });
const writeLimiter = rateLimit({ windowMs: 60000, max: 100, standardHeaders: true, legacyHeaders: false });

router.get('/me', readLimiter, authMiddleware, getMe);
router.put('/me', writeLimiter, authMiddleware, updateMe);
router.post('/me/change-password', writeLimiter, authMiddleware, changePassword);
export default router;
