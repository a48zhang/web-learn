import express, { Router } from 'express';
import { chat } from '../controllers/aiController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { aiChatLimiter } from '../middlewares/rateLimitMiddleware';

const router: Router = express.Router();

router.post('/chat', aiChatLimiter, authMiddleware, chat);

export default router;
