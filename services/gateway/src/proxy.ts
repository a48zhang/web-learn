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

  // http-proxy-middleware v3.x requires options object only (no context parameter)
  // pathRewrite keeps the full path when proxying to downstream services
  console.log('[gateway] Creating auth proxy with target:', urls.auth);
  const authProxy = createProxyMiddleware({
    target: urls.auth,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: (path, req) => {
      console.log('[gateway] Auth path rewrite:', path);
      return path; // Keep full path: /api/auth/login stays as /api/auth/login
    },
  });

  console.log('[gateway] Creating topicSpace proxy with target:', urls.topicSpace);
  const topicSpaceProxy = createProxyMiddleware({
    target: urls.topicSpace,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: (path, req) => {
      console.log('[gateway] TopicSpace path rewrite:', path);
      return path; // Keep full path
    },
  });

  console.log('[gateway] Creating ai proxy with target:', urls.ai);
  const aiProxy = createProxyMiddleware({
    target: urls.ai,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: (path, req) => {
      console.log('[gateway] AI path rewrite:', path);
      return path; // Keep full path
    },
  });

  return {
    auth: authProxy,
    topicSpace: topicSpaceProxy,
    ai: aiProxy,
  };
};
