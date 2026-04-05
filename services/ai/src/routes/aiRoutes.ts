import express, { Router } from 'express';
import { chat } from '../controllers/aiController';
import { authMiddleware } from '../middlewares/authMiddleware';
import rateLimit from 'express-rate-limit';

const router: Router = express.Router();

const aiChatLimiter = rateLimit({ windowMs: 60000, max: 30 });

router.post('/chat', aiChatLimiter, authMiddleware, chat);

export default router;
