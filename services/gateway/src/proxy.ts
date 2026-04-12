import { createProxyMiddleware } from 'http-proxy-middleware';
import type * as http from 'http';
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

// Headers injected by authVerificationMiddleware that must be explicitly
// forwarded to downstream services. http-proxy does not automatically
// include headers added to req.headers after the request object was
// created — they must be set on proxyReq via setHeader().
const USER_CONTEXT_HEADERS = ['x-user-id', 'x-user-username', 'x-user-email', 'x-user-role'];

const forwardUserContextHeaders = (proxyReq: http.ClientRequest, req: Request) => {
  for (const header of USER_CONTEXT_HEADERS) {
    const value = req.headers[header];
    if (value !== undefined) {
      proxyReq.setHeader(header, value);
    }
  }
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
    on: {
      proxyReq: (proxyReq, req) => forwardUserContextHeaders(proxyReq, req as Request),
    },
    pathRewrite: (path, req) => {
      const fullPath = ((req as Request).baseUrl || '') + path;
      return fullPath;
    },
  });

  // topicSpace proxy serves /api/topics
  console.log('[gateway] Creating topicSpace proxy with target:', urls.topicSpace);
  const topicSpaceProxy = createProxyMiddleware({
    target: urls.topicSpace,
    changeOrigin: true,
    proxyTimeout: 30000,
    on: {
      proxyReq: (proxyReq, req) => forwardUserContextHeaders(proxyReq, req as Request),
    },
    pathRewrite: (path, req) => {
      const fullPath = ((req as Request).baseUrl || '') + path;
      return fullPath;
    },
  });

  console.log('[gateway] Creating ai proxy with target:', urls.ai);
  const aiProxy = createProxyMiddleware({
    target: urls.ai,
    changeOrigin: true,
    proxyTimeout: 30000,
    on: {
      proxyReq: (proxyReq, req) => forwardUserContextHeaders(proxyReq, req as Request),
    },
    pathRewrite: (path) => {
      return '/api/ai' + path;
    },
  });

  return {
    auth: authProxy,
    topicSpace: topicSpaceProxy,
    ai: aiProxy,
  };
};
