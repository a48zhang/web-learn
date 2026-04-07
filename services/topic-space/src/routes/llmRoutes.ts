import express, { Router } from 'express';
import { llmChat, llmChatStream } from '../controllers/llmProxyController';
import { internalAuthMiddleware } from '@web-learn/shared';
import rateLimit from 'express-rate-limit';

const router: Router = express.Router();

const llmLimiter = rateLimit({ windowMs: 60000, max: 30 });

router.post('/chat/completions', llmLimiter, internalAuthMiddleware, llmChat);
router.post('/chat/completions/stream', llmLimiter, internalAuthMiddleware, llmChatStream);

export default router;
