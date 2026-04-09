import express, { Router } from 'express';
import { chat } from '../controllers/aiController';
import { internalAuthMiddleware } from '@web-learn/shared';
import rateLimit from 'express-rate-limit';

const router: Router = express.Router();

const aiChatLimiter = rateLimit({ windowMs: 60000, max: 30 });

router.post('/chat', aiChatLimiter, internalAuthMiddleware, chat);
router.post('/chat.completions', aiChatLimiter, internalAuthMiddleware, chat);

export default router;
