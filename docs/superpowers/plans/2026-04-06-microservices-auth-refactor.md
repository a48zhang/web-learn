# 微服务认证架构重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement unified authentication with Gateway as single entry point, Auth Service providing internal verification, and shared package for user context parsing.

**Architecture:** Gateway calls Auth Service `/internal/verify` to validate JWT tokens, injects user info via headers (X-User-Id, X-User-Username, X-User-Email, X-User-Role), downstream services use shared package's internalAuthMiddleware to parse headers into req.user.

**Tech Stack:** Express.js, TypeScript, JWT, Sequelize, http-proxy-middleware, pnpm monorepo

---

## Files Structure

**Create:**
- `shared/src/auth/types.ts` - InternalUser and AuthHeaders type definitions
- `shared/src/auth/userContext.ts` - extractUserFromHeaders utility function
- `shared/src/auth/internalAuthMiddleware.ts` - Express middleware for downstream services
- `shared/src/auth/index.ts` - Auth module exports
- `services/auth/src/routes/internal.ts` - Internal verification endpoint
- `services/gateway/src/authClient.ts` - HTTP client for calling Auth Service
- `services/gateway/src/authVerificationMiddleware.ts` - Gateway authentication middleware

**Modify:**
- `shared/src/index.ts` - Add auth module exports
- `services/auth/src/app.ts` - Register `/internal` routes
- `services/gateway/src/app.ts` - Add auth verification before proxy
- `services/topic-space/src/app.ts` - Replace authMiddleware with shared package
- `services/ai/src/app.ts` - Replace authMiddleware with shared package

**Delete:**
- `services/topic-space/src/middlewares/authMiddleware.ts`
- `services/ai/src/middlewares/authMiddleware.ts`
- `services/topic-space/src/models/User.ts`
- `services/ai/src/models/User.ts`

**Test (future):**
- `shared/src/auth/__tests__/userContext.test.ts` - Unit tests for header extraction
- `shared/src/auth/__tests__/internalAuthMiddleware.test.ts` - Middleware tests
- `services/auth/src/routes/__tests__/internal.test.ts` - Verify endpoint tests

---

## Task 1: Create Shared Auth Types

**Files:**
- Create: `shared/src/auth/types.ts`

- [ ] **Step 1: Create auth directory**

Run: `mkdir -p shared/src/auth`
Expected: Directory created successfully

- [ ] **Step 2: Write type definitions**

```typescript
export interface InternalUser {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
}

export interface AuthHeaders {
  'x-user-id': string;
  'x-user-username': string;
  'x-user-email': string;
  'x-user-role': string;
}
```

Write to: `shared/src/auth/types.ts`

- [ ] **Step 3: Create auth module index**

```typescript
export * from './types';
```

Write to: `shared/src/auth/index.ts`

- [ ] **Step 4: Commit types**

```bash
git add shared/src/auth/
git commit -m "feat(shared): add InternalUser and AuthHeaders types for auth refactor"
```

---

## Task 2: Implement User Context Parser

**Files:**
- Create: `shared/src/auth/userContext.ts`
- Create: `shared/src/auth/__tests__/userContext.test.ts` (future)

- [ ] **Step 1: Write userContext utility**

```typescript
import { InternalUser, AuthHeaders } from './types';

export function extractUserFromHeaders(headers: Partial<AuthHeaders>): InternalUser | null {
  const id = headers['x-user-id'];
  const username = headers['x-user-username'];
  const email = headers['x-user-email'];
  const role = headers['x-user-role'];

  if (!id || !username || !email || !role) {
    return null;
  }

  return {
    id: parseInt(id, 10),
    username,
    email,
    role: role as InternalUser['role'],
  };
}
```

Write to: `shared/src/auth/userContext.ts`

- [ ] **Step 2: Update auth module exports**

Edit: `shared/src/auth/index.ts`

```typescript
export * from './types';
export * from './userContext';
```

- [ ] **Step 3: Commit userContext**

```bash
git add shared/src/auth/userContext.ts shared/src/auth/index.ts
git commit -m "feat(shared): add extractUserFromHeaders utility function"
```

---

## Task 3: Implement Internal Auth Middleware

**Files:**
- Create: `shared/src/auth/internalAuthMiddleware.ts`
- Create: `shared/src/auth/__tests__/internalAuthMiddleware.test.ts` (future)

- [ ] **Step 1: Write internalAuthMiddleware**

```typescript
import { Request, Response, NextFunction } from 'express';
import { InternalUser } from './types';
import { extractUserFromHeaders } from './userContext';

export interface AuthenticatedRequest extends Request {
  user?: InternalUser;
}

export function internalAuthMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = extractUserFromHeaders(req.headers as any);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: missing or invalid user context headers'
    });
  }

  req.user = user;
  next();
}
```

Write to: `shared/src/auth/internalAuthMiddleware.ts`

- [ ] **Step 2: Update auth module exports**

Edit: `shared/src/auth/index.ts`

```typescript
export * from './types';
export * from './userContext';
export * from './internalAuthMiddleware';
```

- [ ] **Step 3: Update shared package main exports**

Edit: `shared/src/index.ts`

```typescript
export * from './types';
export * from './auth';
```

- [ ] **Step 4: Build shared package**

Run: `pnpm -C shared build`
Expected: TypeScript compilation successful, no errors

- [ ] **Step 5: Commit middleware**

```bash
git add shared/src/auth/internalAuthMiddleware.ts shared/src/auth/index.ts shared/src/index.ts
git commit -m "feat(shared): add internalAuthMiddleware for downstream services"
```

---

## Task 4: Create Auth Service Internal Verification Endpoint

**Files:**
- Create: `services/auth/src/routes/internal.ts`

- [ ] **Step 1: Write internal verification route**

```typescript
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { config } from '../utils/config';

const router = Router();

router.post('/verify', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, error: 'Token required' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] }) as any;
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'username', 'email', 'role']
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    return res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

export default router;
```

Write to: `services/auth/src/routes/internal.ts`

- [ ] **Step 2: Register internal routes in auth app**

Edit: `services/auth/src/app.ts`

Add import at top:
```typescript
import internalRoutes from './routes/internal';
```

Add route registration after health endpoint:
```typescript
// Internal routes (not exposed through gateway)
app.use('/internal', internalRoutes);
```

Full modified section:
```typescript
app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'auth', timestamp: new Date().toISOString() });
});

// Internal routes (not exposed through gateway)
app.use('/internal', internalRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
```

- [ ] **Step 3: Commit internal verification**

```bash
git add services/auth/src/routes/internal.ts services/auth/src/app.ts
git commit -m "feat(auth): add /internal/verify endpoint for gateway authentication"
```

---

## Task 5: Create Gateway Auth Service Client

**Files:**
- Create: `services/gateway/src/authClient.ts`

- [ ] **Step 1: Write Auth Service HTTP client**

```typescript
import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001';

export interface VerifyRequest {
  token: string;
}

export interface VerifyResponse {
  success: boolean;
  user?: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
  error?: string;
}

export async function verifyToken(token: string): Promise<VerifyResponse> {
  try {
    const response = await axios.post<VerifyResponse>(
      `${AUTH_SERVICE_URL}/internal/verify`,
      { token },
      {
        timeout: 5000, // 5 second timeout
        headers: { 'Content-Type': 'application/json' }
      }
    );
    return response.data;
  } catch (error: any) {
    if (error.response) {
      return error.response.data;
    }
    // Network error or timeout
    return {
      success: false,
      error: 'Auth service unavailable'
    };
  }
}
```

Write to: `services/gateway/src/authClient.ts`

- [ ] **Step 2: Add axios dependency to gateway**

Run: `pnpm --filter @web-learn/gateway add axios`
Expected: axios installed successfully

- [ ] **Step 3: Commit auth client**

```bash
git add services/gateway/src/authClient.ts services/gateway/package.json
git commit -m "feat(gateway): add auth service HTTP client with token verification"
```

---

## Task 6: Implement Gateway Authentication Middleware

**Files:**
- Create: `services/gateway/src/authVerificationMiddleware.ts`

- [ ] **Step 1: Write auth verification middleware**

```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './authClient';

const publicPaths = [
  '/api/auth/login',
  '/api/auth/register',
  '/health'
];

export async function authVerificationMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip authentication for public paths
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  const authHeader = req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const verifyResult = await verifyToken(token);

    if (!verifyResult.success || !verifyResult.user) {
      return res.status(401).json({
        success: false,
        error: verifyResult.error || 'Invalid token'
      });
    }

    // Inject user info into headers for downstream services
    req.headers['x-user-id'] = verifyResult.user.id.toString();
    req.headers['x-user-username'] = verifyResult.user.username;
    req.headers['x-user-email'] = verifyResult.user.email;
    req.headers['x-user-role'] = verifyResult.user.role;

    next();
  } catch (error) {
    return res.status(503).json({
      success: false,
      error: 'Auth service unavailable'
    });
  }
}
```

Write to: `services/gateway/src/authVerificationMiddleware.ts`

- [ ] **Step 2: Commit auth verification middleware**

```bash
git add services/gateway/src/authVerificationMiddleware.ts
git commit -m "feat(gateway): add authentication verification middleware with header injection"
```

---

## Task 7: Integrate Auth Middleware in Gateway

**Files:**
- Modify: `services/gateway/src/app.ts`

- [ ] **Step 1: Add auth middleware import**

Edit: `services/gateway/src/app.ts`

Add at top:
```typescript
import { authVerificationMiddleware } from './authVerificationMiddleware';
```

- [ ] **Step 2: Insert auth middleware before proxies**

Edit: `services/gateway/src/app.ts`

Find the section where proxies are mounted. Add auth middleware before them:
```typescript
app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'gateway', timestamp: new Date().toISOString() });
});

const proxies = createProxies();

// Auth verification middleware - runs before all proxy routes
app.use(authVerificationMiddleware);

// Mount proxies - the proxy will handle the full path including the mount point
app.use('/api/auth', proxies.auth);
app.use('/api/users', proxies.auth);
app.use('/api/topics', proxies.topicSpace);
app.use('/api/pages', proxies.topicSpace);
app.use('/api/ai', proxies.ai);
```

- [ ] **Step 3: Commit gateway integration**

```bash
git add services/gateway/src/app.ts
git commit -m "feat(gateway): integrate auth verification middleware before proxy routing"
```

---

## Task 8: Install Shared Package in Gateway

**Files:**
- Modify: `services/gateway/package.json`

- [ ] **Step 1: Add shared package dependency**

Run: `pnpm --filter @web-learn/gateway add @web-learn/shared@workspace:*`
Expected: Shared package linked successfully

- [ ] **Step 2: Verify dependency installation**

Run: `cat services/gateway/package.json | grep @web-learn/shared`
Expected: Shows `"@web-learn/shared": "workspace:*"`

- [ ] **Step 3: Commit package update**

```bash
git add services/gateway/package.json pnpm-lock.yaml
git commit -m "feat(gateway): add shared package dependency for auth types"
```

---

## Task 9: Install Shared Package in Topic-Space Service

**Files:**
- Modify: `services/topic-space/package.json`

- [ ] **Step 1: Add shared package dependency**

Run: `pnpm --filter @web-learn/topic-space-service add @web-learn/shared@workspace:*`
Expected: Shared package linked successfully

- [ ] **Step 2: Verify dependency installation**

Run: `cat services/topic-space/package.json | grep @web-learn/shared`
Expected: Shows `"@web-learn/shared": "workspace:*"`

- [ ] **Step 3: Commit package update**

```bash
git add services/topic-space/package.json pnpm-lock.yaml
git commit -m "feat(topic-space): add shared package dependency"
```

---

## Task 10: Install Shared Package in AI Service

**Files:**
- Modify: `services/ai/package.json`

- [ ] **Step 1: Add shared package dependency**

Run: `pnpm --filter @web-learn/ai-service add @web-learn/shared@workspace:*`
Expected: Shared package linked successfully

- [ ] **Step 2: Verify dependency installation**

Run: `cat services/ai/package.json | grep @web-learn/shared`
Expected: Shows `"@web-learn/shared": "workspace:*"`

- [ ] **Step 3: Commit package update**

```bash
git add services/ai/package.json pnpm-lock.yaml
git commit -m "feat(ai): add shared package dependency"
```

---

## Task 11: Replace Auth Middleware in Topic-Space Service

**Files:**
- Modify: `services/topic-space/src/app.ts`
- Delete: `services/topic-space/src/middlewares/authMiddleware.ts`
- Delete: `services/topic-space/src/models/User.ts`

- [ ] **Step 1: Update imports in topic-space app**

Read: `services/topic-space/src/app.ts` to find authMiddleware import location

Edit: `services/topic-space/src/app.ts`

Replace old import:
```typescript
// OLD: import { authMiddleware } from './middlewares/authMiddleware';
// NEW:
import { internalAuthMiddleware } from '@web-learn/shared';
```

- [ ] **Step 2: Replace middleware usage**

Find all occurrences of `authMiddleware` in `services/topic-space/src/app.ts` and replace with `internalAuthMiddleware`.

Example changes:
```typescript
// Route registration - replace authMiddleware with internalAuthMiddleware
app.use('/api/topics', internalAuthMiddleware, topicRoutes);
app.use('/api/pages', internalAuthMiddleware, pageRoutes);
```

- [ ] **Step 3: Delete old auth middleware file**

Run: `rm services/topic-space/src/middlewares/authMiddleware.ts`
Expected: File deleted

- [ ] **Step 4: Delete User model file**

Run: `rm services/topic-space/src/models/User.ts`
Expected: File deleted

- [ ] **Step 5: Verify no compilation errors**

Run: `pnpm -C services/topic-space build`
Expected: Build successful, no errors

- [ ] **Step 6: Commit topic-space changes**

```bash
git add services/topic-space/src/app.ts
git add -u services/topic-space/src/middlewares/authMiddleware.ts services/topic-space/src/models/User.ts
git commit -m "refactor(topic-space): replace authMiddleware with shared internalAuthMiddleware"
```

---

## Task 12: Replace Auth Middleware in AI Service

**Files:**
- Modify: `services/ai/src/app.ts`
- Delete: `services/ai/src/middlewares/authMiddleware.ts`
- Delete: `services/ai/src/models/User.ts`

- [ ] **Step 1: Update imports in ai app**

Read: `services/ai/src/app.ts` to find authMiddleware import location

Edit: `services/ai/src/app.ts`

Replace old import:
```typescript
// OLD: import { authMiddleware } from './middlewares/authMiddleware';
// NEW:
import { internalAuthMiddleware } from '@web-learn/shared';
```

- [ ] **Step 2: Replace middleware usage**

Find all occurrences of `authMiddleware` in `services/ai/src/app.ts` and replace with `internalAuthMiddleware`.

Example changes:
```typescript
// Route registration - replace authMiddleware with internalAuthMiddleware
app.use('/api/ai', internalAuthMiddleware, aiRoutes);
```

- [ ] **Step 3: Delete old auth middleware file**

Run: `rm services/ai/src/middlewares/authMiddleware.ts`
Expected: File deleted

- [ ] **Step 4: Delete User model file**

Run: `rm services/ai/src/models/User.ts`
Expected: File deleted

- [ ] **Step 5: Verify no compilation errors**

Run: `pnpm -C services/ai build`
Expected: Build successful, no errors

- [ ] **Step 6: Commit ai service changes**

```bash
git add services/ai/src/app.ts
git add -u services/ai/src/middlewares/authMiddleware.ts services/ai/src/models/User.ts
git commit -m "refactor(ai): replace authMiddleware with shared internalAuthMiddleware"
```

---

## Task 13: Verify Complete System Integration

**Files:**
- All services and gateway

- [ ] **Step 1: Build all packages**

Run: `pnpm -r build`
Expected: All packages build successfully without errors

- [ ] **Step 2: Check lint**

Run: `pnpm -r lint`
Expected: No lint errors (warnings acceptable)

- [ ] **Step 3: Verify services can start**

Run: `pnpm dev:services` (will start gateway + all backend services)

Wait for services to start, then stop with Ctrl+C.

Expected output logs:
- `[gateway] listening on port 3000`
- `[auth] Database connected successfully`
- `[auth] Server running on port 3001`
- `[topic-space] Database connected successfully`
- `[topic-space] Server running on port 3002`
- `[ai] Database connected successfully`
- `[ai] Server running on port 3003`

- [ ] **Step 4: Commit verification**

```bash
git add -A
git commit -m "chore: verify complete auth refactor integration"
```

---

## Task 14: Manual Authentication Flow Test

**Files:**
- None (manual testing)

- [ ] **Step 1: Start all services**

Run: `pnpm dev`

Expected: All services and frontend start successfully

- [ ] **Step 2: Test login endpoint**

Run:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

Expected: Returns `{ "success": true, "token": "...", "user": {...} }`

Save the token for next steps.

- [ ] **Step 3: Test protected endpoint with valid token**

Run:
```bash
curl -X GET http://localhost:3000/api/topics \
  -H "Authorization: Bearer <TOKEN_FROM_STEP_2>"
```

Expected: Returns topics list (or empty array), not 401 error

- [ ] **Step 4: Test protected endpoint without token**

Run:
```bash
curl -X GET http://localhost:3000/api/topics
```

Expected: Returns 401 `{ "success": false, "error": "No token provided" }`

- [ ] **Step 5: Test internal verify endpoint directly**

Run:
```bash
curl -X POST http://localhost:3001/internal/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"<TOKEN_FROM_STEP_2>"}'
```

Expected: Returns `{ "success": true, "user": {...} }`

- [ ] **Step 6: Stop services**

Press Ctrl+C to stop all running services

---

## Success Criteria

After completing all tasks, verify:

1. **Shared package exports work:**
   - `import { internalAuthMiddleware, extractUserFromHeaders, InternalUser } from '@web-learn/shared'` compiles without errors

2. **Auth Service internal endpoint works:**
   - `POST /internal/verify` validates tokens and returns user info
   - Gateway can call this endpoint successfully

3. **Gateway authentication works:**
   - Public routes (`/api/auth/login`, `/api/auth/register`, `/health`) accessible without token
   - Protected routes require valid token
   - Gateway injects user headers correctly

4. **Downstream services receive user context:**
   - topic-space and ai services can access `req.user` via shared middleware
   - No authMiddleware duplication remains

5. **Code quality:**
   - Deleted ~100 lines of duplicate authMiddleware code
   - All packages build successfully
   - No lint errors

---

## Notes

- **OptionalAuthMiddleware:** The spec mentions `services/topic-space/src/middlewares/optionalAuthMiddleware.ts` - this should remain unchanged as it's for optional authentication scenarios (not affected by this refactor)

- **Testing:** Unit tests for shared package can be added later as separate tasks (not blocking for this implementation)

- **Environment Variables:** Ensure `AUTH_SERVICE_URL` is set correctly in `.env` or defaults to `http://localhost:3001`

- **Gateway Exclusion:** The `/internal/*` paths are NOT proxied through gateway, only accessible via direct service calls (http://localhost:3001/internal/verify)