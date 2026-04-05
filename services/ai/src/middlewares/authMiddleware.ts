import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../utils/config';
import { User } from '../models';

export interface AuthRequest extends Request {
  user?: { id: number; username: string; email: string; role: string };
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') return next();
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token, authorization denied' });
    }
    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: number; username: string; email: string; role: string;
    };
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'username', 'email', 'role'],
    });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Token is not valid' });
    }
    req.user = { id: user.id, username: user.username, email: user.email, role: user.role };
    return next();
  } catch (error) {
    let errorMessage = 'Token is not valid';
    if (error instanceof jwt.TokenExpiredError) errorMessage = 'Token has expired';
    else if (error instanceof jwt.JsonWebTokenError) errorMessage = 'Token is not valid';
    return res.status(401).json({ success: false, error: errorMessage });
  }
};
