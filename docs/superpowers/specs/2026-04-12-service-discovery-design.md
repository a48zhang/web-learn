# Service Discovery System Design

> **Created:** 2026-04-12

## Problem

The gateway's proxy routes and service URLs are hardcoded in `services/gateway/src/proxy.ts` and `services/gateway/src/app.ts`. Adding a new service requires modifying both files. The gateway has no way to detect service instances or distribute load across multiple instances of the same service.

## Solution

A lightweight Service Registry microservice (port 3010) that services register with on startup. Gateway queries the registry to dynamically discover services and build proxy routes, with round-robin load balancing when multiple instances of a service are running.

## Architecture

```
┌──────────────┐  POST /register   ┌──────────────────┐
│   Auth :3001 │──────────────────▶│                  │
└──────────────┘  POST /heartbeat  │                  │
┌──────────────┐  (every 5s)       │   Registry :3010 │
│Topic-Space:3002│───────────────▶│   (memory Map)    │
└──────────────┘                   │                  │
┌──────────────┐                   │                  │
│     AI :3003 │──────────────────▶│                  │
└──────────────┘                   └────────┬─────────┘
                                            │
                                    GET /services
                                    (every 10s)
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │   Gateway :3000  │
                                   │  dynamic proxies  │
                                   │  round-robin LB   │
                                   └──────────────────┘
```

## Components

### Service Registry (new: `services/registry`)

In-memory service registry with heartbeat-based liveness detection.

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/register` | None | Register or update a service |
| `POST` | `/heartbeat` | None | Renew service heartbeat |
| `GET` | `/services` | None | List all active services |
| `GET` | `/health` | None | Health check |

**Registration payload:**
```typescript
type RouteAuthMode = 'public' | 'optional' | 'required';

interface RouteQueryAuthRule {
  when: Record<string, string>;  // query params to match, e.g. { op: 'upload' }
  auth: RouteAuthMode;           // override auth mode when query matches
}

interface ServiceRoutePolicy {
  path: string;                  // route path with optional params: "/api/topics/:id"
  methods: string[];             // HTTP methods: ["GET", "POST"]
  auth: RouteAuthMode;           // auth requirement for this route
  queryRules?: RouteQueryAuthRule[];  // query-param-based auth overrides
}

interface RegisterRequest {
  name: string;       // unique service identifier: "auth", "ai", "topic-space"
  url: string;        // service base URL: "http://auth:3001"
  routes: ServiceRoutePolicy[];  // per-route policies with method + auth
  metadata?: {
    version?: string;
    description?: string;
  };
}
```

**Storage:** `Map<string, ServiceEntry>` where key is service name. If a service re-registers with the same name, the entry is overwritten (service restart). Heartbeat timeout: 15 seconds. Cleanup interval: every 10 seconds.

### Service Registration Client (new: `shared/src/service-registry.ts`)

Shared utility used by all services to register with the registry and send heartbeats.

```typescript
function registerService(config: RegisterRequest): Promise<void>;
function startHeartbeat(intervalMs?: number): void;
function stopHeartbeat(): void;
```

### Gateway Dynamic Discovery

Replaces hardcoded proxy configuration with dynamic service discovery.

- **Startup:** Poll registry (up to 30s), then build proxies from returned services
- **Route matching:** Segment-level path matching — route and actual path must have the same number of segments, with static segments requiring exact match and `:param` segments matching any value. Replaces the old `startsWith` prefix matching.
- **Route scoring:** Routes with more static segments score higher, ensuring `/api/topics/:id/git/presign` matches before `/api/topics/:id`. Groups are sorted by score (most specific first).
- **Round-robin:** For routes served by multiple instances, cycle through proxy targets
- **Periodic sync:** Every 10s, refresh registry and update proxy groups
- **Registry disconnect:** Continue with last known registry state, retry sync

### Auth Policy Enforcement

The gateway auth middleware (`authVerificationMiddleware.ts`) no longer uses hardcoded `publicPaths`/`publicReadPaths` arrays. Instead, it resolves auth behavior per request from the service-reported route policies:

- **`public`:** No auth required, always pass through
- **`optional`:** Verify token if present; invalid token treated as anonymous access (not rejected)
- **`required`:** Valid token required; reject with 401 if missing or invalid, 503 if auth service unavailable
- **`queryRules`:** Query-parameter-based auth overrides (e.g., `?op=download` → `public`, `?op=upload` → `required`)

### Auth Client Integration

`authClient.ts` no longer reads `AUTH_SERVICE_URL` env var. Instead, it uses route-matched proxy lookup (`getProxyTargetWithoutCounter`) to find the auth service URL.

## Constraints

- No hardcoded routes in gateway — all routing comes from registry
- No hardcoded fallback — gateway waits up to 30s for registry, exits on failure
- Existing `/health` endpoints on all services unchanged
- User context headers (`x-user-id`, `x-user-username`, `x-user-email`, `x-user-role`) still forwarded to downstream services

## Startup Order

```
MySQL → Registry → Auth / Topic-Space / AI → Gateway
```

Registry has no dependencies. Gateway depends on registry + all business services.

## Error Scenarios

| Scenario | Behavior |
|----------|----------|
| Registry unavailable at gateway startup | Retry every 2s for 30s, then exit |
| Registry becomes unavailable at runtime | Use cached registry state, retry every 10s |
| Service stops sending heartbeat | Removed after 15s timeout, proxies stop routing to it |
| All instances of a service are down | Requests return 502 |
| Multiple instances of same service | Round-robin across all healthy instances |
