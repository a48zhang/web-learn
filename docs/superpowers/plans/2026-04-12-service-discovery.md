# Service Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded gateway proxy routes with dynamic service discovery via a lightweight Service Registry, enabling automatic route registration and round-robin load balancing across multiple service instances.

**Architecture:** A new Registry service (port 3010) acts as a central service directory. Each business service registers itself on startup and sends heartbeats. The Gateway polls the Registry to dynamically build and update proxy routes with round-robin distribution.

**Tech Stack:** Express, TypeScript, http-proxy-middleware, axios, in-memory Map for registry storage.

**Spec:** `docs/superpowers/specs/2026-04-12-service-discovery-design.md`

---

### Task 0: Shared Service Registry Client

**Files:**
- Create: `shared/src/service-registry.ts`
- Modify: `shared/src/index.ts` — add export

- [ ] **Step 1: Create shared service registry client**

This is a shared utility that all services (auth, topic-space, ai, gateway) will use to communicate with the Registry.

```typescript
// shared/src/service-registry.ts
import axios from 'axios';

export interface RegisterRequest {
  name: string;
  url: string;
  routes: string[];
  metadata?: {
    version?: string;
    description?: string;
  };
}

export interface ServiceEntry {
  name: string;
  url: string;
  routes: string[];
  lastHeartbeat: string;
  registeredAt: string;
}

const getRegistryUrl = (path: string) => {
  const baseUrl = process.env.REGISTRY_URL || 'http://localhost:3010';
  return `${baseUrl}${path}`;
};

export async function registerService(config: RegisterRequest): Promise<void> {
  await axios.post(getRegistryUrl('/register'), config);
}

export async function fetchServices(): Promise<ServiceEntry[]> {
  const res = await axios.get(getRegistryUrl('/services'));
  return res.data;
}

export async function sendHeartbeat(name: string): Promise<void> {
  await axios.post(getRegistryUrl('/heartbeat'), { name });
}

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function startHeartbeat(name: string, intervalMs = 5000): void {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(async () => {
    try {
      await sendHeartbeat(name);
    } catch {
      // Silently ignore heartbeat errors — next interval will retry
    }
  }, intervalMs);
}

export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}
```

- [ ] **Step 2: Export from shared barrel**

Read `shared/src/index.ts` and add the new exports:

```typescript
export {
  registerService,
  fetchServices,
  sendHeartbeat,
  startHeartbeat,
  stopHeartbeat,
} from './service-registry';
export type { RegisterRequest, ServiceEntry } from './service-registry';
```

- [ ] **Step 3: Add axios to shared dependencies if missing**

Read `shared/package.json` and ensure `axios` is in `dependencies`. If not, add it.

- [ ] **Step 4: Commit**

```bash
git add shared/src/service-registry.ts shared/src/index.ts shared/package.json
git commit -m "feat: add shared service registry client"
```

---

### Task 1: Service Registry Microservice

**Files:**
- Create: `services/registry/package.json`
- Create: `services/registry/tsconfig.json`
- Create: `services/registry/src/index.ts`
- Create: `services/registry/src/app.ts`
- Create: `services/registry/src/registry.ts`
- Create: `services/registry/Dockerfile`
- Test: `services/registry/src/__tests__/registry.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@web-learn/registry",
  "version": "1.0.0",
  "private": true,
  "main": "src/index.ts",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.3",
    "express-rate-limit": "^7.2.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^30.0.0",
    "@types/node": "^20.11.0",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0",
    "eslint": "^8.57.1",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.1.5",
    "tsx": "^4.7.3",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Copy the tsconfig from `services/auth/tsconfig.json` — all services use the same pattern. It should have:
- `"compilerOptions": { "target": "ES2020", "module": "commonjs", "lib": ["ES2020"], "outDir": "./dist", "rootDir": "./src", "strict": true, "esModuleInterop": true, "skipLibCheck": true, "forceConsistentCasingInFileNames": true, "resolveJsonModule": true, "declaration": true }`
- `"include": ["src/**/*"]`

- [ ] **Step 3: Create registry core logic**

```typescript
// services/registry/src/registry.ts

export interface RegisterRequest {
  name: string;
  url: string;
  routes: string[];
  metadata?: {
    version?: string;
    description?: string;
  };
}

export interface ServiceEntry {
  name: string;
  url: string;
  routes: string[];
  metadata?: RegisterRequest['metadata'];
  lastHeartbeat: Date;
  registeredAt: Date;
}

export class ServiceRegistry {
  private services = new Map<string, ServiceEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  register(config: RegisterRequest): ServiceEntry {
    const now = new Date();
    const entry: ServiceEntry = {
      name: config.name,
      url: config.url,
      routes: config.routes,
      metadata: config.metadata,
      lastHeartbeat: now,
      registeredAt: this.services.has(config.name)
        ? this.services.get(config.name)!.registeredAt
        : now,
    };
    this.services.set(config.name, entry);
    console.log(`[registry] Registered: ${config.name} at ${config.url}`);
    return entry;
  }

  heartbeat(name: string): boolean {
    const entry = this.services.get(name);
    if (!entry) return false;
    entry.lastHeartbeat = new Date();
    return true;
  }

  getAll(): ServiceEntry[] {
    return Array.from(this.services.values());
  }

  startCleanup(intervalMs = 10000, timeoutMs = 15000): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [name, entry] of this.services) {
        if (now - entry.lastHeartbeat.getTime() > timeoutMs) {
          this.services.delete(name);
          console.log(`[registry] Expired: ${name}`);
        }
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
```

- [ ] **Step 4: Create Express app**

Follow the same pattern as other services (`services/auth/src/app.ts`):

```typescript
// services/registry/src/app.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ServiceRegistry } from './registry';
import type { RegisterRequest } from './registry';

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests' },
});

const registry = new ServiceRegistry();
registry.startCleanup();

const app = express();
app.use(cors({ origin: true }));
app.use(globalLimiter);
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, service: 'registry', timestamp: new Date().toISOString() });
});

app.post('/register', (req: Request, res: Response) => {
  const { name, url, routes, metadata } = req.body as RegisterRequest;
  if (!name || !url || !routes || !Array.isArray(routes)) {
    return res.status(400).json({ success: false, error: 'Missing required fields: name, url, routes' });
  }
  const entry = registry.register({ name, url, routes, metadata });
  res.json({ success: true, data: entry });
});

app.post('/heartbeat', (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name) {
    return res.status(400).json({ success: false, error: 'Missing required field: name' });
  }
  const ok = registry.heartbeat(name);
  if (!ok) {
    return res.status(404).json({ success: false, error: `Service not found: ${name}` });
  }
  res.json({ success: true });
});

app.get('/services', (_req: Request, res: Response) => {
  res.json(registry.getAll());
});

export default app;
```

- [ ] **Step 5: Create entry point**

```typescript
// services/registry/src/index.ts
import dotenv from 'dotenv';

if (process.env.DOTENV_CONFIG_PATH) {
  dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });
} else {
  dotenv.config();
}

import app from './app';

const port = parseInt(process.env.REGISTRY_PORT || '3010', 10);

app.listen(port, () => {
  console.log(`[registry] listening on port ${port}`);
});
```

- [ ] **Step 6: Write registry unit tests**

```typescript
// services/registry/src/__tests__/registry.test.ts
import { ServiceRegistry } from '../registry';

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  afterEach(() => {
    registry.stop();
  });

  describe('register', () => {
    it('registers a new service', () => {
      const entry = registry.register({
        name: 'test',
        url: 'http://test:3001',
        routes: ['/api/test'],
      });
      expect(entry.name).toBe('test');
      expect(entry.url).toBe('http://test:3001');
      expect(entry.routes).toEqual(['/api/test']);
    });

    it('overwrites existing service with same name', () => {
      registry.register({ name: 'test', url: 'http://test:3001', routes: ['/api/test'] });
      const entry = registry.register({ name: 'test', url: 'http://test:3002', routes: ['/api/test'] });
      expect(entry.url).toBe('http://test:3002');
      expect(entry.registeredAt).toBeDefined();
    });
  });

  describe('heartbeat', () => {
    it('returns false for unknown service', () => {
      expect(registry.heartbeat('unknown')).toBe(false);
    });

    it('updates lastHeartbeat for known service', () => {
      registry.register({ name: 'test', url: 'http://test:3001', routes: ['/api/test'] });
      const before = registry.getAll()[0].lastHeartbeat;
      registry.heartbeat('test');
      const after = registry.getAll()[0].lastHeartbeat;
      expect(after.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('getAll', () => {
    it('returns all registered services', () => {
      registry.register({ name: 'a', url: 'http://a:1', routes: ['/a'] });
      registry.register({ name: 'b', url: 'http://b:2', routes: ['/b'] });
      expect(registry.getAll()).toHaveLength(2);
    });

    it('returns empty array when no services', () => {
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('removes expired services', (done) => {
      registry.register({ name: 'test', url: 'http://test:1', routes: ['/test'] });
      registry.startCleanup(100, 200);
      // heartbeat will keep it alive briefly, then it expires
      setTimeout(() => {
        expect(registry.getAll().length).toBe(0);
        done();
      }, 400);
    });
  });
});
```

- [ ] **Step 7: Create Dockerfile**

Copy and adapt `services/gateway/Dockerfile`:

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY shared/package.json shared/
COPY services/registry/package.json services/registry/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared ./shared
COPY services/registry ./services/registry
RUN cd services/registry && pnpm run build

FROM base AS runner
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/shared ./shared
COPY --from=builder /app/services/registry/dist ./services/registry/dist
COPY services/registry/package.json services/registry/
ENV NODE_ENV=production
CMD ["node", "services/registry/dist/index.js"]
```

- [ ] **Step 8: Add registry to pnpm workspace**

Verify `services/*` is already in `pnpm-workspace.yaml` — it is. No changes needed.

- [ ] **Step 9: Install deps and run tests**

```bash
cd services/registry && pnpm install && pnpm test
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add services/registry/
git commit -m "feat: add service registry microservice"
```

---

### Task 2: Docker Compose — Add Registry Service

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add registry service to docker-compose.yml**

Insert the registry service definition before the gateway service:

```yaml
  registry:
    build:
      context: .
      dockerfile: services/registry/Dockerfile
    container_name: web-learn-registry
    restart: unless-stopped
    environment:
      NODE_ENV: production
      REGISTRY_PORT: 3010
    ports:
      - "3010:3010"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3010/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
```

- [ ] **Step 2: Add REGISTRY_URL to all business services**

Add `REGISTRY_URL: http://registry:3010` to the environment of `auth`, `topic-space`, and `ai` services.

- [ ] **Step 3: Update gateway depends_on**

Add registry to gateway's `depends_on`:

```yaml
    depends_on:
      registry:
        condition: service_healthy
      auth:
        condition: service_healthy
      topic-space:
        condition: service_healthy
      ai:
        condition: service_healthy
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add registry service to docker-compose"
```

---

### Task 3: Register Existing Services with Registry

**Files:**
- Modify: `services/auth/package.json` — add @web-learn/shared dependency
- Modify: `services/auth/src/index.ts` — add registration + heartbeat
- Modify: `services/topic-space/src/index.ts` — add registration + heartbeat
- Modify: `services/ai/src/index.ts` — add registration + heartbeat

- [ ] **Step 1: Add @web-learn/shared to auth's dependencies**

Auth is the only service that doesn't depend on shared. Read `services/auth/package.json` and add to dependencies:
```json
"@web-learn/shared": "workspace:*",
```

- [ ] **Step 2: Add registration to auth service**

Read `services/auth/src/index.ts` and add after `app.listen()`:

```typescript
import app from './app';
import { config } from './utils/config';
import { sequelize } from './utils/database';
import { registerService, startHeartbeat } from '@web-learn/shared';

(async () => {
  await sequelize.authenticate();
  // ... existing sync logic ...

  app.listen(config.port, () => {
    console.log(`[auth] listening on port ${config.port}`);
    registerService({
      name: 'auth',
      url: `http://${config.database.host}:${config.port}`,
      routes: ['/api/auth', '/api/users'],
      metadata: { description: 'Authentication service' },
    }).catch((err) => console.error('[auth] Failed to register with registry:', err.message));
    startHeartbeat('auth');
  });
})();
```

The key change is: after the server starts listening, register with the registry and start sending heartbeats. The registration call is fire-and-forget (catch errors to not crash the service).

Important: For auth service, `config.database.host` will be `mysql` in Docker and `localhost` in local dev. But the URL should be the service's own address, not the DB host. Use:
```typescript
url: `http://auth:${config.port}`,
```
for Docker, or construct from `SERVICE_HOST` env var. The simplest approach: read `SERVICE_HOST` env var, default to `localhost`:
```typescript
const serviceHost = process.env.SERVICE_HOST || 'localhost';
url: `http://${serviceHost}:${config.port}`,
```

- [ ] **Step 3: Add registration to topic-space service**

Read `services/topic-space/src/index.ts` and add after `app.listen()`:

```typescript
import { registerService, startHeartbeat } from '@web-learn/shared';
```

Add the same pattern after app.listen:
```typescript
registerService({
  name: 'topic-space',
  url: `http://topic-space:${config.port}`,
  routes: ['/api/topics'],
  metadata: { description: 'Topic space service' },
}).catch((err) => console.error('[topic-space] Failed to register:', err.message));
startHeartbeat('topic-space');
```

- [ ] **Step 4: Add registration to ai service**

Read `services/ai/src/index.ts` and add the same pattern:

```typescript
import { registerService, startHeartbeat } from '@web-learn/shared';
```

After app.listen:
```typescript
registerService({
  name: 'ai',
  url: `http://ai:${config.port}`,
  routes: ['/api/ai'],
  metadata: { description: 'AI service' },
}).catch((err) => console.error('[ai] Failed to register:', err.message));
startHeartbeat('ai');
```

- [ ] **Step 5: Run pnpm install at root**

```bash
pnpm install
```

- [ ] **Step 6: Commit**

```bash
git add services/auth/package.json services/auth/src/index.ts services/topic-space/src/index.ts services/ai/src/index.ts
git commit -m "feat: register services with service registry on startup"
```

---

### Task 4: Gateway — Dynamic Service Discovery & Proxy Manager

**Files:**
- Create: `services/gateway/src/serviceDiscovery.ts` — registry client + polling
- Create: `services/gateway/src/proxyManager.ts` — round-robin proxy management
- Modify: `services/gateway/src/app.ts` — remove hardcoded routes, use dynamic discovery
- Delete: `services/gateway/src/proxy.ts` — replaced by proxyManager

- [ ] **Step 1: Write proxyManager.ts**

This manages round-robin proxy groups for each route.

```typescript
// services/gateway/src/proxyManager.ts
import { Application } from 'express';
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

interface ProxyGroup {
  proxies: ReturnType<typeof createProxyMiddleware>[];
  counter: number;
}

const proxyGroups: Record<string, ProxyGroup> = {};

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

export const mountProxies = (app: Application, services: ServiceEntry[]): void => {
  // Build route -> target URLs map
  const routeTargets: Record<string, string[]> = {};

  for (const service of services) {
    for (const route of service.routes) {
      if (!routeTargets[route]) {
        routeTargets[route] = [];
      }
      routeTargets[route].push(service.url);
    }
  }

  // Create proxy groups for new routes
  for (const [route, urls] of Object.entries(routeTargets)) {
    if (!proxyGroups[route]) {
      const proxies = urls.map(createProxy);
      proxyGroups[route] = { proxies, counter: 0 };
      app.use(route, (req, res, next) => {
        const group = proxyGroups[route];
        const idx = group.counter % group.proxies.length;
        group.counter++;
        group.proxies[idx](req, res, next);
      });
    }
  }
};

export const updateProxyGroups = (services: ServiceEntry[]): void => {
  const routeTargets: Record<string, string[]> = {};

  for (const service of services) {
    for (const route of service.routes) {
      if (!routeTargets[route]) {
        routeTargets[route] = [];
      }
      routeTargets[route].push(service.url);
    }
  }

  // Update existing groups (add/remove proxies)
  for (const [route, urls] of Object.entries(routeTargets)) {
    if (proxyGroups[route]) {
      // Rebuild proxies if URL list changed
      const currentUrls = proxyGroups[route].proxies.map((p) => (p as any).options?.target || '');
      const urlsChanged =
        urls.length !== currentUrls.length || urls.some((u, i) => u !== currentUrls[i]);
      if (urlsChanged) {
        proxyGroups[route].proxies = urls.map(createProxy);
        proxyGroups[route].counter = 0;
      }
    }
  }

  // Remove groups for routes that no longer exist
  for (const route of Object.keys(proxyGroups)) {
    if (!routeTargets[route]) {
      delete proxyGroups[route];
    }
  }
};

// Expose for authClient to find auth service URL
export const getProxyTarget = (route: string): string | undefined => {
  const group = proxyGroups[route];
  if (!group || group.proxies.length === 0) return undefined;
  // Return the next target (same round-robin logic)
  const idx = group.counter % group.proxies.length;
  group.counter++;
  return (group.proxies[idx] as any).options?.target;
};
```

Note: `createProxyMiddleware` doesn't expose the target URL on the returned middleware. A cleaner approach: store URLs alongside proxies.

Let me revise the proxy group structure:

```typescript
interface ProxyGroup {
  targets: string[];
  proxies: ReturnType<typeof createProxyMiddleware>[];
  counter: number;
}
```

And `getProxyTarget` becomes:
```typescript
export const getProxyTarget = (route: string): string | undefined => {
  const group = proxyGroups[route];
  if (!group || group.targets.length === 0) return undefined;
  const idx = group.counter % group.targets.length;
  group.counter++;
  return group.targets[idx];
};
```

Full revised `proxyManager.ts`:

```typescript
// services/gateway/src/proxyManager.ts
import { Application } from 'express';
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

interface ProxyGroup {
  targets: string[];
  proxies: ReturnType<typeof createProxyMiddleware>[];
  counter: number;
}

const proxyGroups: Record<string, ProxyGroup> = {};

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
  const routeTargets = buildRouteTargets(services);

  for (const [route, urls] of Object.entries(routeTargets)) {
    if (!proxyGroups[route]) {
      const proxies = urls.map(createProxy);
      proxyGroups[route] = { targets: urls, proxies, counter: 0 };
      app.use(route, (req, res, next) => {
        const group = proxyGroups[route];
        const idx = group.counter % group.proxies.length;
        group.counter++;
        group.proxies[idx](req, res, next);
      });
    }
  }
};

export const updateProxyGroups = (services: ServiceEntry[]): void => {
  const routeTargets = buildRouteTargets(services);

  for (const [route, urls] of Object.entries(routeTargets)) {
    if (!proxyGroups[route]) {
      // New route appeared at runtime — create new group
      const proxies = urls.map(createProxy);
      // We can't mount new middleware dynamically in Express, so log warning
      // In practice, services register before gateway starts, so this path is rare
      console.log(`[gateway] Warning: new route ${route} detected, but Express middleware cannot be added at runtime. Restart gateway.`);
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
};

export const getProxyTarget = (route: string): string | undefined => {
  const group = proxyGroups[route];
  if (!group || group.targets.length === 0) return undefined;
  const idx = group.counter % group.targets.length;
  group.counter++;
  return group.targets[idx];
};
```

- [ ] **Step 2: Write serviceDiscovery.ts**

This handles polling the registry and coordinating with proxyManager.

```typescript
// services/gateway/src/serviceDiscovery.ts
import { Application } from 'express';
import { fetchServices } from '@web-learn/shared';
import { mountProxies, updateProxyGroups } from './proxyManager';

const REGISTRY_URL = process.env.REGISTRY_URL || 'http://localhost:3010';

const pollWithRetry = async (maxRetries: number, delayMs: number): Promise<void> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fetchServices();
      console.log(`[gateway] Registry reachable (attempt ${i + 1})`);
      return;
    } catch {
      console.log(`[gateway] Waiting for registry (attempt ${i + 1}/${maxRetries})...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Registry not available after max retries');
};

export const waitForRegistry = async (): Promise<void> => {
  await pollWithRetry(15, 2000); // 15 retries * 2s = 30s max wait
};

export const initServiceDiscovery = (app: Application): void => {
  // Initial discovery and mount
  (async () => {
    try {
      const services = await fetchServices();
      console.log(`[gateway] Discovered ${services.length} services from registry`);
      mountProxies(app, services);
    } catch (err) {
      console.error('[gateway] Failed to discover services:', err);
    }
  })();

  // Periodic refresh every 10s
  setInterval(async () => {
    try {
      const services = await fetchServices();
      updateProxyGroups(services);
    } catch (err) {
      console.log('[gateway] Registry sync failed, will retry in 10s');
    }
  }, 10000);
};

export { REGISTRY_URL };
```

- [ ] **Step 3: Rewrite app.ts**

Remove all hardcoded routes and proxy imports. Replace with service discovery.

```typescript
// services/gateway/src/app.ts
import express, { Application } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authVerificationMiddleware } from './authVerificationMiddleware';
import { requestLogger, notFoundHandler } from './devLogger';
import { waitForRegistry, initServiceDiscovery } from './serviceDiscovery';

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
  const app: Application = express();
  app.use(buildCorsMiddleware());
  app.use(globalLimiter);

  if (process.env.NODE_ENV !== 'production') {
    app.use(requestLogger);
  }

  app.get('/health', (_req, res) => {
    res.json({ success: true, service: 'gateway', timestamp: new Date().toISOString() });
  });

  // Auth verification middleware
  app.use(authVerificationMiddleware);

  // Dynamic service discovery — proxies mounted here
  initServiceDiscovery(app);

  if (process.env.NODE_ENV !== 'production') {
    app.use(notFoundHandler);
  }

  return app;
};

export default createApp;
```

Note: `initServiceDiscovery` needs to be synchronous but it calls `fetchServices` which is async. The `mountProxies` call happens in an IIFE inside `initServiceDiscovery`. There's a race: requests could arrive before services are mounted. This is acceptable because:
1. Docker Compose ensures all services are healthy before gateway starts
2. The `waitForRegistry` call in `index.ts` ensures registry is reachable
3. The 404 handler will catch any requests that slip through before mounting

- [ ] **Step 4: Rewrite index.ts to wait for registry before listening**

```typescript
// services/gateway/src/index.ts
import dotenv from 'dotenv';

if (process.env.DOTENV_CONFIG_PATH) {
  dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });
} else {
  dotenv.config();
}

import createApp from './app';
import { waitForRegistry } from './serviceDiscovery';

const port = parseInt(process.env.GATEWAY_PORT || '3000', 10);

(async () => {
  try {
    await waitForRegistry();
  } catch (err) {
    console.error('[gateway] Failed to connect to service registry, exiting');
    process.exit(1);
  }

  const app = createApp();
  app.listen(port, () => {
    console.log(`[gateway] listening on port ${port}`);
  });
})();
```

- [ ] **Step 5: Update authClient.ts to use proxyManager**

Instead of reading `AUTH_SERVICE_URL` from env, use the cached proxy target from proxyManager.

```typescript
// services/gateway/src/authClient.ts
import axios from 'axios';
import { getProxyTarget } from './proxyManager';

export interface VerifyRequest {
  token: string;
}

export interface VerifyResponse {
  success: boolean;
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
  error?: string;
}

export async function verifyToken(token: string): Promise<VerifyResponse> {
  const authUrl = getProxyTarget('/api/auth');
  if (!authUrl) {
    return { success: false, error: 'Auth service not available' };
  }

  try {
    const response = await axios.post<VerifyResponse>(
      `${authUrl}/internal/verify`,
      { token },
      { timeout: 5000, headers: { 'Content-Type': 'application/json' } }
    );
    return response.data;
  } catch (error: any) {
    if (error.response) {
      return error.response.data;
    }
    return { success: false, error: 'Auth service unavailable' };
  }
}
```

- [ ] **Step 6: Delete proxy.ts**

```bash
rm services/gateway/src/proxy.ts
```

- [ ] **Step 7: Add REGISTRY_URL to gateway environment in docker-compose.yml**

Already set in Task 2. Verify it's present.

- [ ] **Step 8: Install shared dependency in gateway (already present)**

Gateway already depends on `@web-learn/shared`. No changes needed.

- [ ] **Step 9: Run gateway tests**

```bash
cd services/gateway && pnpm test
```

- [ ] **Step 10: Commit**

```bash
git add services/gateway/src/serviceDiscovery.ts services/gateway/src/proxyManager.ts services/gateway/src/app.ts services/gateway/src/index.ts services/gateway/src/authClient.ts
git rm services/gateway/src/proxy.ts
git commit -m "feat(gateway): replace hardcoded proxies with dynamic service discovery"
```

---

### Task 5: Integration Testing

**Files:**
- Modify: `tests/integration/gateway-routing.spec.ts` — update for dynamic discovery

- [ ] **Step 1: Verify existing integration test still passes**

The existing test (`tests/integration/gateway-routing.spec.ts`) tests routing through the gateway. It uses `shared/testClient` to make requests. With dynamic service discovery, the test should still pass because:
- The registry is started as part of the test setup (or services register themselves)
- The gateway discovers services from the registry
- Routes work the same way

Run:
```bash
pnpm --filter @web-learn/tests run test -- --testPathPattern=gateway-routing
```

Expected: all existing routing tests pass.

- [ ] **Step 2: Commit**

```bash
git commit -m "test: verify gateway routing with service discovery"
```

---

### Task 6: Update Documentation

**Files:**
- Modify: `docs/spec/gateway-service.md`

- [ ] **Step 1: Update gateway service spec**

Replace the hardcoded routing table with a description of dynamic discovery:

Remove the "路由映射" table and "转发配置" code block. Replace with:

```markdown
## 服务发现

Gateway 通过 Service Registry 动态发现下游服务，不使用硬编码路由。

**启动流程：**
1. 连接 Registry (`REGISTRY_URL`)，最多等待 30 秒
2. 获取已注册服务列表，为每个服务的路由前缀创建代理
3. 每 10 秒轮询 Registry，更新代理组

**负载均衡：** 同一服务的多个实例自动按 round-robin 分发请求。

**配置：**
| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `REGISTRY_URL` | Registry 服务地址 | `http://localhost:3010` |
| `GATEWAY_PORT` | Gateway 监听端口 | `3000` |
```

- [ ] **Step 2: Commit**

```bash
git add docs/spec/gateway-service.md
git commit -m "docs: update gateway spec for service discovery"
```
