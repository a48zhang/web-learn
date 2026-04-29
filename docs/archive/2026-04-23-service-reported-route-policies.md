# Service-Reported Route Policies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let services register method-aware route auth policies with the registry so the gateway can enforce authentication from service-reported metadata instead of hardcoded path rules.

**Architecture:** Extend the shared service-registry contract from `routes: string[]` to structured route policy objects, preserve backward-compatible prefix routing for proxy selection, and teach the gateway to resolve `public | optional | required` auth behavior per request from registry data. Topic-space will declare `GET /api/topics/:id` as `optional`, allowing anonymous requests to reach the service while still letting the service decide whether the resource is viewable.

**Tech Stack:** TypeScript, Express, Axios, Jest, existing monorepo shared package

---

### Task 1: Extend Shared Registry Types For Route Policies

**Files:**
- Modify: `shared/src/service-registry.ts`
- Modify: `shared/src/index.ts`
- Test: `services/registry/src/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing type-level/runtime-facing registry tests**

```ts
it('stores structured route policies on registration', () => {
  const entry = registry.register({
    name: 'topic-space',
    url: 'http://topic:3002',
    routes: [
      {
        path: '/api/topics/:id',
        methods: ['GET'],
        auth: 'optional',
      },
    ],
  });

  expect(entry.routes).toEqual([
    {
      path: '/api/topics/:id',
      methods: ['GET'],
      auth: 'optional',
    },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @web-learn/registry test -- --runInBand registry.test.ts`
Expected: FAIL because `routes` is typed and stored as `string[]`

- [ ] **Step 3: Replace flat route strings with shared route-policy types**

```ts
export type RouteAuthMode = 'public' | 'optional' | 'required';

export interface RouteQueryAuthRule {
  when: Record<string, string>;
  auth: RouteAuthMode;
}

export interface ServiceRoutePolicy {
  path: string;
  methods: string[];
  auth: RouteAuthMode;
  queryRules?: RouteQueryAuthRule[];
}

export interface RegisterRequest {
  name: string;
  url: string;
  routes: ServiceRoutePolicy[];
  metadata?: {
    version?: string;
    description?: string;
  };
}

export interface ServiceEntry {
  name: string;
  url: string;
  routes: ServiceRoutePolicy[];
  lastHeartbeat: string;
  registeredAt: string;
}
```

- [ ] **Step 4: Re-export the new shared types**

```ts
export type {
  RegisterRequest,
  ServiceEntry,
  ServiceRoutePolicy,
  RouteAuthMode,
  RouteQueryAuthRule,
} from './service-registry';
```

- [ ] **Step 5: Run the focused registry test again**

Run: `pnpm --filter @web-learn/registry test -- --runInBand registry.test.ts`
Expected: PASS for the new structured route-policy assertion

- [ ] **Step 6: Commit**

```bash
git add shared/src/service-registry.ts shared/src/index.ts services/registry/src/__tests__/registry.test.ts
git commit -m "refactor: add shared route policy types"
```

### Task 2: Update Registry Service To Validate And Persist Structured Policies

**Files:**
- Modify: `services/registry/src/app.ts`
- Modify: `services/registry/src/registry.ts`
- Test: `services/registry/src/__tests__/registry.test.ts`

- [ ] **Step 1: Write failing tests for registry validation and persistence**

```ts
it('rejects registration when routes is not an array of route policies', async () => {
  const res = await request(app)
    .post('/register')
    .send({ name: 'topic-space', url: 'http://topic:3002', routes: ['/api/topics'] });

  expect(res.status).toBe(400);
  expect(res.body.error).toContain('routes');
});
```

```ts
it('keeps route policy metadata in getAll()', () => {
  registry.register({
    name: 'topic-space',
    url: 'http://topic:3002',
    routes: [{ path: '/api/topics', methods: ['GET'], auth: 'optional' }],
  });

  expect(registry.getAll()[0].routes[0]).toMatchObject({
    path: '/api/topics',
    methods: ['GET'],
    auth: 'optional',
  });
});
```

- [ ] **Step 2: Run registry tests to verify they fail**

Run: `pnpm --filter @web-learn/registry test -- --runInBand`
Expected: FAIL because the app accepts string arrays and the registry stores string routes

- [ ] **Step 3: Tighten registry validation around route policy shape**

```ts
const isValidRoutePolicy = (route: unknown): route is ServiceRoutePolicy => {
  if (!route || typeof route !== 'object') return false;
  const candidate = route as ServiceRoutePolicy;
  return (
    typeof candidate.path === 'string' &&
    Array.isArray(candidate.methods) &&
    candidate.methods.every((method) => typeof method === 'string') &&
    (candidate.auth === 'public' || candidate.auth === 'optional' || candidate.auth === 'required')
  );
};

if (!name || !url || !Array.isArray(routes) || !routes.every(isValidRoutePolicy)) {
  return res.status(400).json({
    success: false,
    error: 'Missing or invalid required fields: name, url, routes',
  });
}
```

- [ ] **Step 4: Store and return the structured policies without flattening**

```ts
const entry: ServiceEntry = {
  name: config.name,
  url: config.url,
  routes: config.routes,
  metadata: config.metadata,
  lastHeartbeat: now,
  registeredAt: this.services.has(key) ? this.services.get(key)!.registeredAt : now,
};
```

- [ ] **Step 5: Run registry tests to verify persistence and validation**

Run: `pnpm --filter @web-learn/registry test -- --runInBand`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add services/registry/src/app.ts services/registry/src/registry.ts services/registry/src/__tests__/registry.test.ts
git commit -m "refactor: persist structured registry route policies"
```

### Task 3: Make Gateway Match Service-Reported Auth Policies

**Files:**
- Modify: `services/gateway/src/authVerificationMiddleware.ts`
- Modify: `services/gateway/src/proxyManager.ts`
- Modify: `services/gateway/src/serviceDiscovery.ts`
- Test: `tests/integration/auth-permissions.spec.ts`
- Test: `tests/integration/gateway-routing.spec.ts`

- [ ] **Step 1: Add failing integration coverage for anonymous topic detail access through gateway**

```ts
it('allows GET /api/topics/:id without authentication when route policy is optional', async () => {
  const loginRes = await api.post('/api/auth/login', {
    email: 'admin@test.com',
    password: 'Admin123!',
  });
  const token = loginRes.body.data.token;

  const createRes = await api.post(
    '/api/topics',
    { title: 'Public Topic' },
    { headers: headersWithAuth(token) }
  );

  await api.patch(
    `/api/topics/${createRes.body.data.id}/status`,
    { status: 'published' },
    { headers: headersWithAuth(token) }
  );

  const res = await api.get(`/api/topics/${createRes.body.data.id}`);
  expect(res.status).toBe(200);
});
```

```ts
it('treats invalid tokens on optional routes as anonymous access', async () => {
  const res = await api.get('/api/topics/some-published-id', {
    headers: { Authorization: 'Bearer invalidtoken123' },
  });

  expect(res.status).not.toBe(401);
});
```

- [ ] **Step 2: Run the gateway/auth integration tests to verify they fail**

Run: `pnpm test:integration -- auth-permissions.spec.ts gateway-routing.spec.ts`
Expected: FAIL because the gateway only whitelists exact `/api/topics`

- [ ] **Step 3: Compile registry route policies into matchers for both proxy routing and auth lookup**

```ts
interface CompiledRoutePolicy {
  path: string;
  methods: string[];
  auth: RouteAuthMode;
  queryRules?: RouteQueryAuthRule[];
  matcher: ReturnType<typeof match>;
}

const compileRoutePolicy = (route: ServiceRoutePolicy): CompiledRoutePolicy => ({
  ...route,
  methods: route.methods.map((method) => method.toUpperCase()),
  matcher: match(route.path, { decode: decodeURIComponent }),
});
```

- [ ] **Step 4: Replace hardcoded public path logic with policy-driven auth evaluation**

```ts
const policy = findRoutePolicy(req.method, req.path, req.query);

if (!policy || policy.auth === 'public') {
  return next();
}

if (!hasToken) {
  if (policy.auth === 'required') {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  return next();
}

const verifyResult = await verifyToken(token);

if (verifyResult.success && verifyResult.user) {
  injectUserHeaders(req, verifyResult.user);
  return next();
}

if (policy.auth === 'required') {
  return res.status(401).json({ success: false, error: verifyResult.error || 'Invalid token' });
}

return next();
```

- [ ] **Step 5: Resolve `queryRules` after path+method match**

```ts
const resolveAuthMode = (route: CompiledRoutePolicy, query: Request['query']): RouteAuthMode => {
  for (const rule of route.queryRules ?? []) {
    const matched = Object.entries(rule.when).every(([key, value]) => query[key] === value);
    if (matched) return rule.auth;
  }
  return route.auth;
};
```

- [ ] **Step 6: Run gateway integration tests again**

Run: `pnpm test:integration -- auth-permissions.spec.ts gateway-routing.spec.ts`
Expected: PASS, including anonymous published-topic detail access

- [ ] **Step 7: Commit**

```bash
git add services/gateway/src/authVerificationMiddleware.ts services/gateway/src/proxyManager.ts services/gateway/src/serviceDiscovery.ts tests/integration/auth-permissions.spec.ts tests/integration/gateway-routing.spec.ts
git commit -m "fix: drive gateway auth from registered route policies"
```

### Task 4: Make Services Register Explicit Route Policies

**Files:**
- Modify: `services/topic-space/src/index.ts`
- Modify: `services/auth/src/index.ts`
- Modify: `services/ai/src/index.ts`
- Test: `tests/integration/auth-permissions.spec.ts`

- [ ] **Step 1: Write failing integration assertions for service-specific auth behavior**

```ts
it('requires auth for POST /api/topics', async () => {
  const res = await api.post('/api/topics', { title: 'No Auth Topic' });
  expect(res.status).toBe(401);
});

it('allows anonymous GET /api/topics/:id/git/presign?op=publish for published topics', async () => {
  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Run the auth-permissions integration suite**

Run: `pnpm test:integration -- auth-permissions.spec.ts`
Expected: FAIL until services register detailed policies instead of broad prefixes

- [ ] **Step 3: Register topic-space policies with method and query awareness**

```ts
startHeartbeat({
  name: 'topic-space',
  url: `http://${serviceHost}:${config.port}`,
  routes: [
    { path: '/api/topics', methods: ['GET'], auth: 'optional' },
    { path: '/api/topics/:id', methods: ['GET'], auth: 'optional' },
    {
      path: '/api/topics/:id/git/presign',
      methods: ['GET'],
      auth: 'optional',
      queryRules: [
        { when: { op: 'upload' }, auth: 'required' },
        { when: { op: 'download' }, auth: 'optional' },
        { when: { op: 'publish' }, auth: 'optional' },
      ],
    },
    { path: '/api/topics', methods: ['POST'], auth: 'required' },
    { path: '/api/topics/:id', methods: ['PUT'], auth: 'required' },
    { path: '/api/topics/:id/status', methods: ['PATCH'], auth: 'required' },
    { path: '/api/topics/:id', methods: ['DELETE'], auth: 'required' },
  ],
  metadata: { description: 'Topic space service' },
});
```

- [ ] **Step 4: Register auth and AI services with explicit required/public policies**

```ts
routes: [
  { path: '/api/auth/login', methods: ['POST'], auth: 'public' },
  { path: '/api/auth/register', methods: ['POST'], auth: 'public' },
  { path: '/api/users/me', methods: ['GET', 'PUT'], auth: 'required' },
  { path: '/api/users/me/change-password', methods: ['POST'], auth: 'required' },
]
```

```ts
routes: [
  { path: '/api/ai/chat/completions', methods: ['POST'], auth: 'required' },
  { path: '/api/ai/conversations/:topicId/:agentType', methods: ['GET', 'PUT'], auth: 'required' },
]
```

- [ ] **Step 5: Run the integration suite for end-to-end behavior**

Run: `pnpm test:integration -- auth-permissions.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add services/topic-space/src/index.ts services/auth/src/index.ts services/ai/src/index.ts tests/integration/auth-permissions.spec.ts
git commit -m "refactor: register explicit service route policies"
```

### Task 5: Harden Matching Logic And Regression Coverage

**Files:**
- Modify: `tests/integration/auth-permissions.spec.ts`
- Modify: `tests/integration/gateway-routing.spec.ts`
- Modify: `services/registry/src/__tests__/registry.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Add regression tests for invalid tokens on optional routes and required routes**

```ts
it('returns 401 for invalid token on required route', async () => {
  const res = await api.post(
    '/api/topics',
    { title: 'Bad Token Topic' },
    { headers: { Authorization: 'Bearer invalidtoken123' } }
  );
  expect(res.status).toBe(401);
});

it('does not return 401 for invalid token on optional route', async () => {
  const res = await api.get(`/api/topics/${publishedTopicId}`, {
    headers: { Authorization: 'Bearer invalidtoken123' },
  });
  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Add registry-level test for query-rule retention**

```ts
expect(entry.routes[0].queryRules).toEqual([
  { when: { op: 'upload' }, auth: 'required' },
  { when: { op: 'publish' }, auth: 'optional' },
]);
```

- [ ] **Step 3: Document the route-policy registration contract for future services**

```md
Services now register structured route policies with the registry:

```ts
routes: [
  { path: '/api/example', methods: ['GET'], auth: 'public' },
  { path: '/api/example/:id', methods: ['GET'], auth: 'optional' },
  { path: '/api/example', methods: ['POST'], auth: 'required' },
]
```
```

- [ ] **Step 4: Run the relevant test suites**

Run: `pnpm --filter @web-learn/registry test -- --runInBand`
Expected: PASS

Run: `pnpm test:integration -- auth-permissions.spec.ts gateway-routing.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/integration/auth-permissions.spec.ts tests/integration/gateway-routing.spec.ts services/registry/src/__tests__/registry.test.ts README.md
git commit -m "test: cover service-reported route policy regressions"
```

## Self-Review

### Spec coverage

- Service-reported policy source: covered by Tasks 1, 2, and 4
- Gateway policy execution: covered by Task 3
- Topic public access regression: covered by Tasks 3 and 5
- Query-param-sensitive auth for `git/presign`: covered by Tasks 3 and 4
- Ongoing documentation for future services: covered by Task 5

### Placeholder scan

- No `TODO`/`TBD` placeholders remain
- Every code-changing task contains concrete snippets
- Every verification step contains exact commands and expected outcomes

### Type consistency

- Shared route type is consistently named `ServiceRoutePolicy`
- Shared auth enum is consistently named `RouteAuthMode`
- Query-based overrides consistently use `RouteQueryAuthRule`

Plan complete and saved to `docs/superpowers/plans/2026-04-23-service-reported-route-policies.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
