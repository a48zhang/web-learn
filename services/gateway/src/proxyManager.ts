import { Application } from 'express';
import { EventEmitter } from 'events';
import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Options } from 'http-proxy-middleware';
import type * as http from 'http';
import type { Request } from 'express';
import type { ServiceEntry } from '@web-learn/shared';

const USER_CONTEXT_HEADERS = ['x-user-id', 'x-user-username', 'x-user-email', 'x-user-role'];

const forwardUserContextHeaders = (proxyReq: http.ClientRequest, req: Request) => {
  for (const header of USER_CONTEXT_HEADERS) {
    const value = req.headers[header];
    if (value !== undefined) {
      proxyReq.setHeader(header, value);
    }
  }
};

export const proxyEvents = new EventEmitter();

interface ProxyGroup {
  targets: string[];
  proxies: any[];
  counter: number;
}

const proxyGroups: Record<string, ProxyGroup> = {};

let appRef: Application | null = null;
let dynamicMiddleware: ((req: any, res: any, next: any) => void) | null = null;

const createProxy = (targetUrl: string) => {
  return createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    proxyTimeout: 30000,
    on: {
      proxyReq: (proxyReq, req) => forwardUserContextHeaders(proxyReq, req as Request),
    },
    pathRewrite: (path, req) => {
      const fullPath = ((req as Request).baseUrl || '') + path;
      return fullPath;
    },
  } as Options);
};

const createDynamicMiddleware = () => {
  return (req: any, res: any, next: any) => {
    const fullPath = req.baseUrl + req.path;
    // Match route prefix
    for (const route of Object.keys(proxyGroups)) {
      if (fullPath.startsWith(route)) {
        const group = proxyGroups[route];
        if (group && group.proxies.length > 0) {
          const idx = group.counter % group.proxies.length;
          group.counter++;
          return group.proxies[idx](req, res, next);
        }
      }
    }
    return next();
  };
};

const buildRouteTargets = (services: ServiceEntry[]): Record<string, string[]> => {
  const routeTargets: Record<string, string[]> = {};
  for (const service of services) {
    for (const route of service.routes) {
      if (!routeTargets[route]) {
        routeTargets[route] = [];
      }
      if (!routeTargets[route].includes(service.url)) {
        routeTargets[route].push(service.url);
      }
    }
  }
  return routeTargets;
};

export const mountProxies = (app: Application, services: ServiceEntry[]): void => {
  appRef = app;
  dynamicMiddleware = createDynamicMiddleware();

  const routeTargets = buildRouteTargets(services);

  for (const [route, urls] of Object.entries(routeTargets) as [string, string[]][]) {
    const proxies = urls.map(createProxy);
    proxyGroups[route] = { targets: urls, proxies, counter: 0 };
  }

  // Single catch-all middleware handles all routes dynamically
  app.use(dynamicMiddleware);
};

export const updateProxyGroups = (services: ServiceEntry[]): void => {
  const routeTargets = buildRouteTargets(services);
  let newRoutesDetected = false;

  for (const [route, urls] of Object.entries(routeTargets)) {
    if (!proxyGroups[route]) {
      newRoutesDetected = true;
      console.log(`[gateway] New route ${route} detected, will rebuild dynamic middleware`);
    }
  }

  for (const [route, urls] of Object.entries(routeTargets) as [string, string[]][]) {
    if (!proxyGroups[route]) {
      const proxies = urls.map(createProxy);
      proxyGroups[route] = { targets: urls, proxies, counter: 0 };
    } else {
      const urlsChanged =
        urls.length !== proxyGroups[route].targets.length ||
        urls.some((u, i) => u !== proxyGroups[route].targets[i]);
      if (urlsChanged) {
        proxyGroups[route].targets = urls;
        proxyGroups[route].proxies = urls.map(createProxy);
        proxyGroups[route].counter = 0;
        console.log(`[gateway] Updated proxy group for ${route}: ${urls.length} targets`);
      }
    }
  }

  for (const route of Object.keys(proxyGroups)) {
    if (!routeTargets[route]) {
      delete proxyGroups[route];
      console.log(`[gateway] Removed proxy group for ${route}`);
    }
  }

  if (newRoutesDetected && appRef && dynamicMiddleware) {
    proxyEvents.emit('routes-changed');
    console.log(`[gateway] Dynamic middleware rebuilt for new routes`);
  }
};

export const getProxyTarget = (route: string): string | undefined => {
  const group = proxyGroups[route];
  if (!group || group.targets.length === 0) return undefined;
  const idx = group.counter % group.targets.length;
  group.counter++;
  return group.targets[idx];
};
