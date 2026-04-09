import { Request, Response, NextFunction } from 'express';

/**
 * Request logger middleware: prints METHOD + URL for every request.
 */
export function requestLogger(req: Request, _res: Response, next: NextFunction) {
  console.log(`[gateway] ${req.method} ${req.url}`);
  next();
}

/**
 * 404 catch-all: responds immediately when no route matched.
 * Without this, unmatched requests hang indefinitely.
 */
export function notFoundHandler(req: Request, res: Response) {
  console.log(`[gateway] 404 - no route matched: ${req.method} ${req.url}`);
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.url}` });
}
