import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { config } from '../utils/config';

const router: Router = Router();

router.post('/verify', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, error: 'Token required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] }) as any;
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'username', 'email', 'role']
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    return res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

export default router;