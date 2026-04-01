import express, { Router } from 'express';
import { getCurrentUser } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router.get('/me', authMiddleware, getCurrentUser);

export default router;
