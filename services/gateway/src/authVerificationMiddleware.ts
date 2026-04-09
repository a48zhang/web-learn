import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './authClient';

const publicPaths = [
  '/api/auth/login',
  '/api/auth/register',
  '/health'
];

// Paths that allow unauthenticated GET access (exact match or sub-path).
// The topic-space service uses optionalAuthMiddleware on these routes, so
// the gateway must let them through; the service itself enforces visibility
// rules (e.g. only published topics are returned to anonymous users).
const publicReadPaths = [
  '/api/topics',
  '/api/pages',
];

/** Returns true when the request is an unauthenticated-safe GET. */
const isPublicReadRequest = (path: string, method: string) =>
  method === 'GET' &&
  publicReadPaths.some(
    (prefix) => path === prefix || path.startsWith(prefix + '/')
  );

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
      } else if (!isPublicReadRequest(req.path, req.method)) {
        // Invalid token on non-public path → reject
        return res.status(401).json({
          success: false,
          error: verifyResult.error || 'Invalid token'
        });
      }
    } catch (error) {
      if (!isPublicReadRequest(req.path, req.method)) {
        return res.status(503).json({
          success: false,
          error: 'Auth service unavailable'
        });
      }
    }
  } else {
    // No token → reject unless it's a public read path
    if (!isPublicReadRequest(req.path, req.method)) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }
  }

  next();
}
