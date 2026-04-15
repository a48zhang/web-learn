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
    const keys = Object.keys(proxyGroups);
    // Match route prefix
    for (const route of keys) {
      if (fullPath.startsWith(route)) {
        const group = proxyGroups[route];
        if (group && group.proxies.length > 0) {
          console.log(`[gateway] proxy match: ${fullPath} -> ${group.targets[group.counter % group.targets.length]}`);
          const idx = group.counter % group.proxies.length;
          group.counter++;
          return group.proxies[idx](req, res, next);
        }
      }
    }
    console.log(`[gateway] dynamic middleware: no match for ${fullPath}, proxyGroups keys: [${keys.join(', ')}]`);
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

export const registerProxyMiddleware = (app: Application): void => {
  // Register empty middleware synchronously — routes will be populated later.
  // This must be called BEFORE notFoundHandler in app.ts.
  dynamicMiddleware = createDynamicMiddleware();
  appRef = app;
  app.use(dynamicMiddleware);
};

export const mountProxies = (services: ServiceEntry[]): void => {
  const routeTargets = buildRouteTargets(services);

  console.log(`[gateway] mountProxies: received ${services.length} services, ${Object.keys(routeTargets).length} route groups`);
  for (const [route, urls] of Object.entries(routeTargets) as [string, string[]][]) {
    console.log(`[gateway]   route: ${route} -> ${urls.join(', ')}`);
    const proxies = urls.map(createProxy);
    proxyGroups[route] = { targets: urls, proxies, counter: 0 };
  }
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

// Used by auth verification (read-only, no side effects)
export const getProxyTargetWithoutCounter = (route: string): string | undefined => {
  const group = proxyGroups[route];
  if (!group || group.targets.length === 0) return undefined;
  // Return the first target without modifying counter
  return group.targets[0];
};

// Used by proxy middleware (with round-robin counter)
export const getProxyTarget = (route: string): string | undefined => {
  const group = proxyGroups[route];
  if (!group || group.targets.length === 0) return undefined;
  const idx = group.counter % group.targets.length;
  group.counter++;
  return group.targets[idx];
};
