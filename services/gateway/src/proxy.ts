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

  // http-proxy-middleware v3.x: when mounted with app.use('/api/auth', proxy),
  // Express strips the mount point, so we need to restore it in pathRewrite
  // Auth proxy is shared between /api/auth and /api/users mounts, so use req.baseUrl
  console.log('[gateway] Creating auth proxy with target:', urls.auth);
  const authProxy = createProxyMiddleware({
    target: urls.auth,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: (path, req) => {
      const fullPath = (req.baseUrl || '') + path;
      console.log('[gateway] Auth path rewrite:', path, '->', fullPath);
      return fullPath;
    },
  });

  // topicSpace proxy is shared between /api/topics and /api/pages mounts, so use req.baseUrl
  console.log('[gateway] Creating topicSpace proxy with target:', urls.topicSpace);
  const topicSpaceProxy = createProxyMiddleware({
    target: urls.topicSpace,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: (path, req) => {
      const fullPath = (req.baseUrl || '') + path;
      console.log('[gateway] TopicSpace path rewrite:', path, '->', fullPath);
      return fullPath;
    },
  });

  console.log('[gateway] Creating ai proxy with target:', urls.ai);
  const aiProxy = createProxyMiddleware({
    target: urls.ai,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: (path, req) => {
      // Restore the full path with mount point
      const fullPath = '/api/ai' + path;
      console.log('[gateway] AI path rewrite:', path, '->', fullPath);
      return fullPath;
    },
  });

  const llmProxy = createProxyMiddleware({
    target: urls.topicSpace,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: (path) => {
      const fullPath = '/api/llm' + path;
      return fullPath;
    },
  });

  return {
    auth: authProxy,
    topicSpace: topicSpaceProxy,
    ai: aiProxy,
    llm: llmProxy,
  };
};
