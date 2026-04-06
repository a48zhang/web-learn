import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login } from '../controllers/authController';

const router = Router();

// Strict rate limiting for auth endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts, please try again later' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many registration attempts' },
});

router.post('/login', loginLimiter, login);
router.post('/register', registerLimiter, register);
export default router;
