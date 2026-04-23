import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './authClient';
import { findRoutePolicy } from './proxyManager';

const injectUserHeaders = (req: Request, user: NonNullable<Awaited<ReturnType<typeof verifyToken>>['user']>) => {
  req.headers['x-user-id'] = user.id;
  req.headers['x-user-username'] = user.username;
  req.headers['x-user-email'] = user.email;
  req.headers['x-user-role'] = user.role;
};

export async function authVerificationMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health') {
    return next();
  }

  const policy = findRoutePolicy(req.method, req.path, req.query);
  if (!policy || policy.auth === 'public') {
    return next();
  }

  const authHeader = req.header('Authorization');
  const hasToken = authHeader && authHeader.startsWith('Bearer ');

  if (!hasToken) {
    if (policy.auth === 'required') {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }
    return next();
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const verifyResult = await verifyToken(token);

    if (verifyResult.success && verifyResult.user) {
      injectUserHeaders(req, verifyResult.user);
      return next();
    }

    if (policy.auth === 'required') {
      return res.status(401).json({
        success: false,
        error: verifyResult.error || 'Invalid token'
      });
    }

    return next();
  } catch (error) {
    if (policy.auth === 'required') {
      return res.status(503).json({
        success: false,
        error: 'Auth service unavailable'
      });
    }

    return next();
  }
}
