import jwt from 'jsonwebtoken';
import { Response, NextFunction } from 'express';
import { config } from '../utils/config';
import { User } from '../models';
import { AuthRequest } from './authMiddleware';

export const optionalAuthMiddleware = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: number;
      username: string;
      email: string;
      role: string;
    };

    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'username', 'email', 'role'],
    });
    if (!user) {
      console.warn('Optional auth user not found for token', { userId: decoded.id });
      return next();
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
    return next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.warn('Optional auth token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.warn('Optional auth token invalid');
    } else {
      console.warn('Optional auth unexpected error');
    }
    return next();
  }
};
