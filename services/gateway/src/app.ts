import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createProxies } from './proxy';
import { authVerificationMiddleware } from './authVerificationMiddleware';

const isLocalOrigin = (origin: string) => {
  try {
    const url = new URL(origin);
    return (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '::1' ||
      url.hostname.endsWith('.localhost')
    );
  } catch {
    return false;
  }
};

const buildCorsMiddleware = () => {
  const configured = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) || [];
  const allowed = configured.length > 0 ? configured : ['http://localhost:5173', 'http://127.0.0.1:5173'];
  return cors({
    origin: (origin, callback) => {
      if (!origin || isLocalOrigin(origin) || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  });
};

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests' },
});

const createApp = () => {
  const app = express();
  app.use(buildCorsMiddleware());
  app.use(globalLimiter);

  app.get('/health', (_req, res) => {
    res.json({ success: true, service: 'gateway', timestamp: new Date().toISOString() });
  });

  const proxies = createProxies();

  // Auth verification middleware - runs before all proxy routes
  app.use(authVerificationMiddleware);

  // Mount proxies - the proxy will handle the full path including the mount point
  app.use('/api/auth', proxies.auth);
  app.use('/api/users', proxies.auth);
  app.use('/api/topics', proxies.topicSpace);
  app.use('/api/pages', proxies.topicSpace);
  app.use('/api/ai', proxies.ai);

  return app;
};

export default createApp;
