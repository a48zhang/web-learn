import { Application } from 'express';
import { EventEmitter } from 'events';
import { createProxyMiddleware } from 'http-proxy-middleware';
import type { Options } from 'http-proxy-middleware';
import type * as http from 'http';
import type { Request } from 'express';
import type { RouteAuthMode, RouteQueryAuthRule, ServiceEntry } from '@web-learn/shared';

const USER_CONTEXT_HEADERS = ['x-user-id', 'x-user-username', 'x-user-email', 'x-user-role'];
export const DEFAULT_PROXY_TIMEOUT = 30000;
export const AI_PROXY_TIMEOUT = 0;

export const forwardUserContextHeaders = (proxyReq: http.ClientRequest, req: Request) => {
  for (const header of USER_CONTEXT_HEADERS) {
    const value = req.headers[header];
    if (value !== undefined) {
      proxyReq.setHeader(header, value);
    }
  }
};

export const proxyEvents = new EventEmitter();

interface ProxyGroup {
  path: string;
  methods: string[];
  auth: RouteAuthMode;
  queryRules?: RouteQueryAuthRule[];
  targets: string[];
  proxies: any[];
  counter: number;
  score: number;
}

const proxyGroups = new Map<string, ProxyGroup>();

let appRef: Application | null = null;
let dynamicMiddleware: ((req: any, res: any, next: any) => void) | null = null;

const isAiRoutePath = (routePath: string) => routePath.startsWith('/api/ai');

export const createProxyOptions = (targetUrl: string, routePath: string): Options => {
  const proxyTimeout = isAiRoutePath(routePath) ? AI_PROXY_TIMEOUT : DEFAULT_PROXY_TIMEOUT;

  return {
    target: targetUrl,
    changeOrigin: true,
    proxyTimeout,
    on: {
      proxyReq: (proxyReq, req) => forwardUserContextHeaders(proxyReq, req as Request),
    },
    pathRewrite: (path, req) => {
      const fullPath = ((req as Request).baseUrl || '') + path;
      return fullPath;
    },
  };
};

const createProxy = (targetUrl: string, routePath: string) => {
  return createProxyMiddleware(createProxyOptions(targetUrl, routePath));
};

const normalizePath = (path: string): string => {
  if (!path || path === '/') return '/';
  return path.endsWith('/') ? path.slice(0, -1) : path;
};

const splitPath = (path: string): string[] => normalizePath(path).split('/').filter(Boolean);

const matchesRoutePath = (routePath: string, actualPath: string): boolean => {
  const routeSegments = splitPath(routePath);
  const actualSegments = splitPath(actualPath);
  if (routeSegments.length !== actualSegments.length) return false;

  return routeSegments.every((segment, index) => segment.startsWith(':') || segment === actualSegments[index]);
};

const routeScore = (path: string): number => {
  const segments = splitPath(path);
  const staticSegments = segments.filter((segment) => !segment.startsWith(':')).length;
  return staticSegments * 100 + segments.length;
};

const matchesMethod = (group: ProxyGroup, method: string): boolean => group.methods.includes(method.toUpperCase());

const matchQueryValue = (actual: unknown, expected: string): boolean => {
  if (Array.isArray(actual)) {
    return actual.includes(expected);
  }
  return actual === expected;
};

const resolveAuthMode = (group: ProxyGroup, query: Request['query']): RouteAuthMode => {
  for (const rule of group.queryRules ?? []) {
    const matched = Object.entries(rule.when as Record<string, string>)
      .every(([key, value]) => matchQueryValue(query[key], value));
    if (matched) {
      return rule.auth;
    }
  }
  return group.auth;
};

const getSortedGroups = (): ProxyGroup[] => (
  Array.from(proxyGroups.values()).sort((a, b) => b.score - a.score)
);

const createDynamicMiddleware = () => {
  return (req: any, res: any, next: any) => {
    const fullPath = normalizePath(req.baseUrl + req.path);

    for (const group of getSortedGroups()) {
      if (matchesRoutePath(group.path, fullPath) && matchesMethod(group, req.method) && group.proxies.length > 0) {
        console.log(`[gateway] proxy match: ${fullPath} ${req.method} -> ${group.targets[group.counter % group.targets.length]}`);
        const idx = group.counter % group.proxies.length;
        group.counter++;
        return group.proxies[idx](req, res, next);
      }
    }
    console.log(`[gateway] dynamic middleware: no match for ${fullPath} ${req.method}`);
    return next();
  };
};

const buildRouteTargets = (services: ServiceEntry[]): Map<string, ProxyGroup> => {
  const routeTargets = new Map<string, ProxyGroup>();
  for (const service of services) {
    for (const route of service.routes) {
      const methods = route.methods.map((method: string) => method.toUpperCase()).sort();
      const key = `${route.path}|${methods.join(',')}`;
      const existing = routeTargets.get(key);

      if (!existing) {
        routeTargets.set(key, {
          path: route.path,
          methods,
          auth: route.auth,
          queryRules: route.queryRules,
          targets: [service.url],
          proxies: [],
          counter: 0,
          score: routeScore(route.path),
        });
        continue;
      }

      if (!existing.targets.includes(service.url)) {
        existing.targets.push(service.url);
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

  proxyGroups.clear();
  console.log(`[gateway] mountProxies: received ${services.length} services, ${routeTargets.size} route groups`);
  for (const [key, group] of routeTargets.entries()) {
    console.log(`[gateway]   route: ${group.path} [${group.methods.join(',')}] -> ${group.targets.join(', ')}`);
    group.proxies = group.targets.map((targetUrl) => createProxy(targetUrl, group.path));
    proxyGroups.set(key, group);
  }
};

export const updateProxyGroups = (services: ServiceEntry[]): void => {
  const routeTargets = buildRouteTargets(services);
  let newRoutesDetected = false;

  for (const key of routeTargets.keys()) {
    if (!proxyGroups.has(key)) {
      newRoutesDetected = true;
      console.log(`[gateway] New route ${key} detected, will rebuild dynamic middleware`);
    }
  }

  for (const [key, nextGroup] of routeTargets.entries()) {
    const currentGroup = proxyGroups.get(key);
    if (!currentGroup) {
      nextGroup.proxies = nextGroup.targets.map((targetUrl) => createProxy(targetUrl, nextGroup.path));
      proxyGroups.set(key, nextGroup);
    } else {
      const urlsChanged =
        nextGroup.targets.length !== currentGroup.targets.length ||
        nextGroup.targets.some((u, i) => u !== currentGroup.targets[i]);
      if (urlsChanged) {
        currentGroup.targets = nextGroup.targets;
        currentGroup.proxies = nextGroup.targets.map((targetUrl) => createProxy(targetUrl, currentGroup.path));
        currentGroup.counter = 0;
        console.log(`[gateway] Updated proxy group for ${currentGroup.path}: ${nextGroup.targets.length} targets`);
      }
    }
  }

  for (const key of Array.from(proxyGroups.keys())) {
    if (!routeTargets.has(key)) {
      proxyGroups.delete(key);
      console.log(`[gateway] Removed proxy group for ${key}`);
    }
  }

  if (newRoutesDetected && appRef && dynamicMiddleware) {
    proxyEvents.emit('routes-changed');
    console.log(`[gateway] Dynamic middleware rebuilt for new routes`);
  }
};

const findMatchingGroup = (method: string, path: string): ProxyGroup | undefined => (
  getSortedGroups().find((group) => matchesRoutePath(group.path, normalizePath(path)) && matchesMethod(group, method))
);

export const findRoutePolicy = (
  method: string,
  path: string,
  query: Request['query'],
): { auth: RouteAuthMode } | undefined => {
  const group = findMatchingGroup(method, path);
  if (!group) return undefined;
  return { auth: resolveAuthMode(group, query) };
};

// Used by auth verification (read-only, no side effects)
export const getProxyTargetWithoutCounter = (path: string, method = 'GET'): string | undefined => {
  const group = findMatchingGroup(method, path);
  if (!group || group.targets.length === 0) return undefined;
  return group.targets[0];
};
