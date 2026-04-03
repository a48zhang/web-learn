import express, { Router } from 'express';
import { chat } from '../controllers/aiController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router.post('/chat', authMiddleware, chat);

export default router;
