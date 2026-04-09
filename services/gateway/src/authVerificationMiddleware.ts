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
  // Skip authentication for public paths
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Skip authentication for read-only topic access
  const isRead = req.method === 'GET';
  if (isRead && publicReadPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const verifyResult = await verifyToken(token);

    if (!verifyResult.success || !verifyResult.user) {
      return res.status(401).json({
        success: false,
        error: verifyResult.error || 'Invalid token'
      });
    }

    // Inject user info into headers for downstream services
    req.headers['x-user-id'] = verifyResult.user.id.toString();
    req.headers['x-user-username'] = verifyResult.user.username;
    req.headers['x-user-email'] = verifyResult.user.email;
    req.headers['x-user-role'] = verifyResult.user.role;

    next();
  } catch (error) {
    return res.status(503).json({
      success: false,
      error: 'Auth service unavailable'
    });
  }
}