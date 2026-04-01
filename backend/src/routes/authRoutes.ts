import express, { Router } from 'express';
import { register, login, getCurrentUser } from '../controllers/authController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router: Router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authMiddleware, getCurrentUser);

export default router;
