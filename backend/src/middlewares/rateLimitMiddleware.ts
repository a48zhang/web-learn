import rateLimit from 'express-rate-limit';

const buildLimiter = (windowMs: number, max: number, message: string) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: message,
    },
  });

export const writeLimiter = buildLimiter(60 * 1000, 120, 'Too many write requests');
export const aiChatLimiter = buildLimiter(60 * 1000, 30, 'Too many AI chat requests');
export const uploadLimiter = buildLimiter(60 * 1000, 20, 'Too many upload requests');
export const readLimiter = buildLimiter(60 * 1000, 240, 'Too many read requests');
