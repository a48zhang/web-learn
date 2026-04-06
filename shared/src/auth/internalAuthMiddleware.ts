import { Request, Response, NextFunction } from 'express';
import { InternalUser } from './types';
import { extractUserFromHeaders } from './userContext';

export interface AuthenticatedRequest extends Request {
  user?: InternalUser;
}

export function internalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = extractUserFromHeaders(req.headers as any);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: missing or invalid user context headers'
    });
  }

  req.user = user;
  next();
}