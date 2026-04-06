import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, extractUserFromHeaders } from '@web-learn/shared';

export const optionalAuthMiddleware = async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  // Try to extract user from headers (set by Gateway)
  const user = extractUserFromHeaders(req.headers as any);

  if (user) {
    req.user = user;
  }

  // Always call next(), even if no user found (optional auth)
  return next();
};