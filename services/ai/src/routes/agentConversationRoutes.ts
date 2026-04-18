import express, { Router } from 'express';
import { getConversation, replaceConversation } from '../controllers/agentConversationController';
import { internalAuthMiddleware } from '@web-learn/shared';

const router: Router = express.Router();

router.get('/conversations/:topicId/:agentType', internalAuthMiddleware, getConversation);
router.put('/conversations/:topicId/:agentType', internalAuthMiddleware, replaceConversation);

export default router;
