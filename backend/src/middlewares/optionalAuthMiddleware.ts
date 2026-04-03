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
      return next();
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };
    return next();
  } catch {
    return next();
  }
};
