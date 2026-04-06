import { Response } from 'express';
import { User } from '../models';
import { AuthRequest } from '../middlewares/authMiddleware';

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByPk(req.user!.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    return res.json({
      success: true,
      data: {
        id: String(user.id),
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
