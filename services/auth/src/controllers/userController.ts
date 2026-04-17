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

export const updateMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByPk(req.user!.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const { username } = req.body;
    if (username !== undefined) {
      if (typeof username !== 'string' || username.length < 2 || username.length > 50) {
        return res.status(400).json({ success: false, error: 'Username must be 2-50 characters' });
      }
      user.username = username;
    }

    await user.save();
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
    console.error('Update user error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByPk(req.user!.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'currentPassword and newPassword are required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'newPassword must be at least 6 characters' });
    }

    const valid = await user.comparePassword(currentPassword);
    if (!valid) {
      return res.status(403).json({ success: false, error: 'Current password is incorrect' });
    }

    await user.set('password', newPassword);
    await user.save();
    return res.json({ success: true, data: { message: 'Password changed successfully' } });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
