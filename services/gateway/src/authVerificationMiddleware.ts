import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './authClient';

const publicPaths = [
  '/api/auth/login',
  '/api/auth/register',
  '/health'
];

const publicReadPaths = [
  '/api/topics'
];

export async function authVerificationMiddleware(req: Request, res: Response, next: NextFunction) {
  // Always skip authentication for fully public paths
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  const authHeader = req.header('Authorization');
  const hasToken = authHeader && authHeader.startsWith('Bearer ');

  if (hasToken) {
    // Always verify token and inject user headers when present
    const token = authHeader.replace('Bearer ', '');

    try {
      const verifyResult = await verifyToken(token);

      if (verifyResult.success && verifyResult.user) {
        req.headers['x-user-id'] = verifyResult.user.id.toString();
        req.headers['x-user-username'] = verifyResult.user.username;
        req.headers['x-user-email'] = verifyResult.user.email;
        req.headers['x-user-role'] = verifyResult.user.role;
      } else if (!publicReadPaths.some(path => req.path === path && req.method === 'GET')) {
        // Invalid token on non-public path → reject
        return res.status(401).json({
          success: false,
          error: verifyResult.error || 'Invalid token'
        });
      }
    } catch (error) {
      if (!publicReadPaths.some(path => req.path === path && req.method === 'GET')) {
        return res.status(503).json({
          success: false,
          error: 'Auth service unavailable'
        });
      }
    }
  } else {
    // No token → reject unless it's a public read path
    const isPublicRead = publicReadPaths.some(path => req.path === path && req.method === 'GET');
    if (!isPublicRead) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }
  }

  next();
}
