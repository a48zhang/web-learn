import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Request } from 'express';

const getServiceUrls = () => {
  const urls = {
    auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    topicSpace: process.env.TOPIC_SPACE_SERVICE_URL || 'http://localhost:3002',
    ai: process.env.AI_SERVICE_URL || 'http://localhost:3003',
  };
  console.log('[gateway] Service URLs:', urls);
  return urls;
};

export const createProxies = () => {
  const urls = getServiceUrls();

  console.log('[gateway] Creating auth proxy with target:', urls.auth);
  const authProxy = createProxyMiddleware('/api/auth', {
    target: urls.auth,
    changeOrigin: true,
    proxyTimeout: 30000,
  });

  console.log('[gateway] Creating topicSpace proxy with target:', urls.topicSpace);
  const topicSpaceProxy = createProxyMiddleware('/api/topics', {
    target: urls.topicSpace,
    changeOrigin: true,
    proxyTimeout: 30000,
  });

  console.log('[gateway] Creating ai proxy with target:', urls.ai);
  const aiProxy = createProxyMiddleware('/api/ai', {
    target: urls.ai,
    changeOrigin: true,
    proxyTimeout: 30000,
  });

  return {
    auth: authProxy,
    topicSpace: topicSpaceProxy,
    ai: aiProxy,
  };
};
