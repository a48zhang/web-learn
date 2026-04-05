import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Request } from 'express';

const getServiceUrls = () => ({
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  topicSpace: process.env.TOPIC_SPACE_SERVICE_URL || 'http://localhost:3002',
  ai: process.env.AI_SERVICE_URL || 'http://localhost:3003',
});

const makeProxy = (target: string) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    on: {
      error: (err: Error, _req: Request, res: any) => {
        console.error(`[gateway] proxy error to ${target}:`, err.message);
        if (!res.headersSent) {
          res.status(502).json({ success: false, error: 'Service unavailable' });
        }
      },
    },
  });

export const createProxies = () => {
  const urls = getServiceUrls();
  return {
    auth: makeProxy(urls.auth),
    topicSpace: makeProxy(urls.topicSpace),
    ai: makeProxy(urls.ai),
  };
};
