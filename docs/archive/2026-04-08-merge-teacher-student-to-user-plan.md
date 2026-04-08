# Role Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove teacher/student role distinction, unify into `user` role (admin stays), and add collaborative topic editing via an `editors` JSON field.

**Architecture:** Shared types define the new `UserRoleType = 'admin' | 'user'`. Auth service stores roles in MySQL ENUM. Topic model adds `editors` JSON column for collaborative permissions. Backend permission checks switch from `role === 'teacher'` to `editors.includes(userId) || role === 'admin'`. Frontend removes role selection, badges, and conditional rendering.

**Tech Stack:** TypeScript, Express, Sequelize (MySQL), React, Zustand

---

### Task 1: Update shared types

**Files:**
- Modify: `shared/src/types/index.ts`
- Modify: `shared/src/auth/types.ts`

- [ ] **Step 1: Update `UserRoleType` and `UserRole` in `shared/src/types/index.ts`**

Change line 2 and lines 149-153:

```typescript
// Line 2: change type
export type UserRoleType = 'admin' | 'user';

// Lines 149-153: change const object
export const UserRole = {
  ADMIN: 'admin',
  USER: 'user',
} as const;
```

- [ ] **Step 2: Update `CreateUserDto.role` in `shared/src/types/index.ts`**

Change line 18:

```typescript
export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  role: 'user';
}
```

- [ ] **Step 3: Update `InternalUser.role` in `shared/src/auth/types.ts`**

Change line 5:

```typescript
export interface InternalUser {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
}
```

- [ ] **Step 4: Commit**

```bash
git add shared/src/types/index.ts shared/src/auth/types.ts
git commit -m "refactor: unify role types, replace teacher/student with user"
```

---

### Task 2: Update auth service models and registration

**Files:**
- Modify: `services/auth/src/models/User.ts`
- Modify: `services/auth/src/controllers/authController.ts`

- [ ] **Step 1: Update User model role type in `services/auth/src/models/User.ts`**

Update all role references. Change lines 10, 20, and 40-44:

```typescript
// Line 10 - interface
role: 'admin' | 'user';

// Line 20 - class property
public role!: 'admin' | 'user';

// Lines 40-44 - Sequelize definition
role: {
  type: DataTypes.ENUM('admin', 'user'),
  allowNull: false,
  defaultValue: 'user',
},
```

- [ ] **Step 2: Remove role forcing in `services/auth/src/controllers/authController.ts`**

Replace line 22 in the `register` function:

```typescript
// OLD line 22:
// const role = bodyRole === 'teacher' ? 'teacher' : 'student';
// NEW:
const role = 'user';
```

- [ ] **Step 3: Commit**

```bash
git add services/auth/src/models/User.ts services/auth/src/controllers/authController.ts
git commit -m "refactor: update auth service to use 'user' role instead of teacher/student"
```

---

### Task 3: Add `editors` field to Topic model

**Files:**
- Modify: `services/topic-space/src/models/Topic.ts`

- [ ] **Step 1: Add `editors` field to Topic model**

The `editors` field stores a JSON array of user IDs with edit permission. Since the DB is MySQL (not PostgreSQL), use `DataTypes.JSON`.

Update `Topic.ts`:

```typescript
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

interface TopicAttributes {
  id: number;
  title: string;
  description?: string;
  type: 'website';
  website_url?: string | null;
  created_by: number;
  status: 'draft' | 'published' | 'closed';
  files_snapshot?: string | null;
  chat_history?: string | null;
  published_url?: string | null;
  share_link?: string | null;
  editors: string[];
}

interface TopicCreationAttributes extends Optional<TopicAttributes, 'id' | 'description' | 'website_url' | 'status' | 'type' | 'files_snapshot' | 'chat_history' | 'published_url' | 'share_link' | 'editors'> {}

class Topic extends Model<TopicAttributes, TopicCreationAttributes> implements TopicAttributes {
  public id!: number;
  public title!: string;
  public description?: string;
  public type!: 'website';
  public website_url?: string | null;
  public created_by!: number;
  public status!: 'draft' | 'published' | 'closed';
  public files_snapshot?: string | null;
  public chat_history?: string | null;
  public published_url?: string | null;
  public share_link?: string | null;
  public editors!: string[];
  public declare createdAt: Date;
  public declare updatedAt: Date;
}

Topic.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    type: { type: DataTypes.ENUM('website'), allowNull: false, defaultValue: 'website' },
    website_url: { type: DataTypes.STRING(500), allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: false },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'closed'),
      allowNull: false, defaultValue: 'draft',
    },
    files_snapshot: { type: DataTypes.TEXT, allowNull: true },
    chat_history: { type: DataTypes.TEXT, allowNull: true },
    published_url: { type: DataTypes.STRING(500), allowNull: true },
    share_link: { type: DataTypes.STRING(500), allowNull: true },
    editors: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },
  { sequelize, tableName: 'topic_topics', underscored: true }
);

export default Topic;
```

- [ ] **Step 2: Commit**

```bash
git add services/topic-space/src/models/Topic.ts
git commit -m "feat: add editors JSON field to Topic model for collaborative editing"
```

---

### Task 4: Update topic controller with editors-based permissions

**Files:**
- Modify: `services/topic-space/src/controllers/topicController.ts`

- [ ] **Step 1: Replace `ensureTopicOwner` with `hasTopicEditAccess` helper**

Replace line 38-39:

```typescript
const hasTopicEditAccess = (topic: any, req: AuthRequest) =>
  req.user && (topic.editors?.includes(req.user.id.toString()) || req.user.role === 'admin');

const hasTopicViewAccess = (topic: any, req: AuthRequest) =>
  topic.status === 'published' || hasTopicEditAccess(topic, req);
```

- [ ] **Step 2: Update `createTopic` — remove teacher check, add editors initialization**

Replace the `createTopic` function (lines 84-112):

```typescript
export const createTopic = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const topic = await Topic.create({
      title,
      description,
      type: 'website',
      website_url: null,
      created_by: req.user.id,
      status: 'draft',
      editors: [req.user.id.toString()],
    });

    return res.status(201).json({ success: true, data: formatTopic(topic) });
  } catch (error) {
    console.error('Create topic error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
```

- [ ] **Step 3: Update `getTopics` — remove teacher check, show all topics to all users**

Replace the `getTopics` function (lines 115-136):

```typescript
export const getTopics = async (req: AuthRequest | any, res: Response) => {
  try {
    const topics = await Topic.findAll({
      where: {},
      order: [['created_at', 'DESC']],
    });

    return res.json({
      success: true,
      data: topics.map((topic) => formatTopic(topic)),
    });
  } catch (error) {
    console.error('Get topics error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
```

- [ ] **Step 4: Update `getTopicById` — use `hasTopicViewAccess`**

Replace lines 150-156:

```typescript
    if (!hasTopicViewAccess(topic, req as AuthRequest)) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
```

- [ ] **Step 5: Update `updateTopic` — use `hasTopicEditAccess`**

Replace line 181:

```typescript
    if (!hasTopicEditAccess(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
```

- [ ] **Step 6: Update `updateTopicStatus` — use `hasTopicEditAccess`**

Replace line 212:

```typescript
    if (!hasTopicEditAccess(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
```

- [ ] **Step 7: Update `deleteTopic` — use `hasTopicEditAccess`**

Replace line 244:

```typescript
    if (!hasTopicEditAccess(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
```

- [ ] **Step 8: Update `uploadWebsite` — use `hasTopicEditAccess`**

Replace line 286-287:

```typescript
  if (!hasTopicEditAccess(topic, req)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
```

- [ ] **Step 9: Update `deleteWebsite` — use `hasTopicEditAccess`**

Replace line 346-347:

```typescript
  if (!hasTopicEditAccess(topic, req)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
```

- [ ] **Step 10: Update `getWebsiteStats` — use `hasTopicEditAccess`**

Replace line 376-377:

```typescript
  if (!hasTopicEditAccess(topic, req)) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
```

- [ ] **Step 11: Update `saveFilesSnapshot` — use `hasTopicEditAccess`**

Replace line 422-423:

```typescript
    if (!hasTopicEditAccess(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
```

- [ ] **Step 12: Update `saveChatHistory` — use `hasTopicEditAccess`**

Replace line 450-451:

```typescript
    if (!hasTopicEditAccess(topic, req)) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
```

- [ ] **Step 13: Commit**

```bash
git add services/topic-space/src/controllers/topicController.ts
git commit -m "refactor: replace role-based topic permissions with editors-based access"
```

---

### Task 5: Update page controller with editors-based permissions

**Files:**
- Modify: `services/topic-space/src/controllers/pageController.ts`

- [ ] **Step 1: Replace `assertTopicWritableByUser` with editors-based check**

Replace lines 46-53:

```typescript
const assertTopicWritableByUser = async (topicId: number, req: AuthRequest) => {
  const topic = await Topic.findByPk(topicId);
  if (!topic) return { ok: false, status: 404, error: 'Topic not found' } as const;
  const user = req.user;
  if (!user || (!topic.editors?.includes(user.id.toString()) && user.role !== 'admin')) {
    return { ok: false, status: 403, error: 'Access denied' } as const;
  }
  return { ok: true, topic } as const;
};
```

- [ ] **Step 2: Update `getPagesByTopic` — use editors for private view**

Replace lines 106-113:

```typescript
    const authReq = req as AuthRequest;
    const canViewPrivate =
      authReq.user &&
      (authReq.user.role === 'admin' ||
        authReq.user.id && topic.editors?.includes(authReq.user.id.toString()));
    if (topic.status !== 'published' && !canViewPrivate) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }
```

- [ ] **Step 3: Update `getPageById` — use editors for private view**

Replace lines 143-150:

```typescript
    const authReq = req as AuthRequest;
    const canViewPrivate =
      authReq.user &&
      (authReq.user.role === 'admin' ||
        authReq.user.id && topic.editors?.includes(authReq.user.id.toString()));
    if (topic.status !== 'published' && !canViewPrivate) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }
```

- [ ] **Step 4: Commit**

```bash
git add services/topic-space/src/controllers/pageController.ts
git commit -m "refactor: replace role-based page permissions with editors-based access"
```

---

### Task 6: Update AI service controllers and agent tools

**Files:**
- Modify: `services/ai/src/controllers/aiController.ts`
- Modify: `services/ai/src/services/agentTools.ts`

- [ ] **Step 1: Update AI controller building agent check**

Replace lines 86-96 in `aiController.ts`:

```typescript
    if (agent_type === 'building') {
      if (topic.created_by !== authReq.user.id && authReq.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      if (topic.type !== 'knowledge') {
        return res.status(400).json({ success: false, error: 'Building assistant currently supports knowledge topics only' });
      }
    }
```

- [ ] **Step 2: Update AI controller comment in system prompt**

Replace line 12 (the building system prompt comment):

```typescript
      '目标：帮助用户创建与编辑专题内容。',
```

- [ ] **Step 3: Update `ensureBuildingAccess` in agentTools.ts**

Replace lines 56-68:

```typescript
const ensureBuildingAccess = async (topicId: number, context: ToolContext) => {
  const topic = await Topic.findByPk(topicId);
  if (!topic) {
    throw new Error('Topic not found');
  }
  const editors = (topic.editors as string[]) || [];
  if (!editors.includes(context.userId.toString()) && context.userRole !== 'admin') {
    throw new Error('Access denied');
  }
  if (topic.type !== 'knowledge') {
    throw new Error('Building assistant only supports knowledge topics');
  }
  return topic;
};
```

- [ ] **Step 4: Commit**

```bash
git add services/ai/src/controllers/aiController.ts services/ai/src/services/agentTools.ts
git commit -m "refactor: remove teacher-only AI access restrictions, use editors-based access"
```

---

### Task 7: Update frontend registration page

**Files:**
- Modify: `frontend/src/pages/RegisterPage.tsx`
- Modify: `frontend/src/stores/useAuthStore.ts`

- [ ] **Step 1: Update RegisterPage — remove role selection**

Replace the entire file content:

```typescript
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../stores/useAuthStore';
import { toast } from '../stores/useToastStore';
import { UserRole } from '@web-learn/shared';
import { getApiErrorMessage } from '../utils/errors';

const registerSchema = z.object({
  username: z.string().min(2, '用户名至少需要2个字符'),
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6个字符'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次输入的密码不一致',
  path: ['confirmPassword'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setError(null);
    try {
      await registerUser(data.username, data.email, data.password);
      toast.success('注册成功！');
      navigate('/dashboard');
    } catch (err: unknown) {
      const errorMsg = getApiErrorMessage(err, '注册失败，请稍后重试');
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            创建新账户
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            或者{' '}
            <Link
              to="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              登录已有账户
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                用户名
              </label>
              <input
                id="username"
                {...register('username')}
                type="text"
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="请输入用户名"
                aria-describedby="username-error"
              />
              {errors.username && (
                <p id="username-error" className="mt-1 text-sm text-red-600">{errors.username.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                邮箱地址
              </label>
              <input
                id="email"
                {...register('email')}
                type="email"
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="请输入邮箱地址"
                aria-describedby="email-error"
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                密码
              </label>
              <input
                id="password"
                {...register('password')}
                type="password"
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="请输入密码 (至少6个字符)"
                aria-describedby="password-error"
              />
              {errors.password && (
                <p id="password-error" className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                确认密码
              </label>
              <input
                id="confirmPassword"
                {...register('confirmPassword')}
                type="password"
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="请再次输入密码"
                aria-describedby="confirmPassword-error"
              />
              {errors.confirmPassword && (
                <p id="confirmPassword-error" className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </span>
                  注册中...
                </>
              ) : (
                '注册'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RegisterPage;
```

- [ ] **Step 2: Update `useAuthStore` — remove role from register**

Update lines 12 and 44:

```typescript
// Line 12 - interface signature
register: (username: string, email: string, password: string) => Promise<void>;

// Lines 44-58 - implementation
register: async (username: string, email: string, password: string) => {
  set({ isLoading: true });
  try {
    const response = await authApi.register({ username, email, password, role: 'user' });
    localStorage.setItem('auth_token', response.token);
    set({
      user: response.user,
      token: response.token,
      isAuthenticated: true,
      isLoading: false,
    });
  } catch (error) {
    set({ isLoading: false });
    throw error;
  }
},
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/RegisterPage.tsx frontend/src/stores/useAuthStore.ts
git commit -m "feat: remove role selection from registration, always register as 'user'"
```

---

### Task 8: Update frontend layout and routing

**Files:**
- Modify: `frontend/src/components/layout/TopNav.tsx`
- Modify: `frontend/src/components/ProtectedRoute.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update TopNav — show "新建专题" to all users, remove role badge**

Replace the full file:

```typescript
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';

interface TopNavProps {
  onMenuClick: () => void;
}

interface NavLinkItem {
  label: string;
  to: string;
}

export default function TopNav({ onMenuClick }: TopNavProps) {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const navLinks: NavLinkItem[] = isAuthenticated
    ? [
        { label: '控制台', to: '/dashboard' },
        { label: '专题列表', to: '/topics' },
        { label: '新建专题', to: '/topics/create' },
      ]
    : [
        { label: '登录', to: '/login' },
        { label: '注册', to: '/register' },
      ];

  const isActive = (to: string) =>
    location.pathname === to ||
    (location.pathname.startsWith(to + '/') && to !== '/');

  return (
    <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm flex items-center px-4 sm:px-6 justify-between">
      <div className="flex items-center gap-6">
        <Link to="/dashboard" className="font-bold text-blue-600 text-lg">
          WebLearn
        </Link>
        <nav className="hidden md:flex items-center gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={
                isActive(link.to)
                  ? 'text-blue-600 border-b-2 border-blue-600 pb-0.5 text-sm font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 text-sm'
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {isAuthenticated && user ? (
          <>
            <span className="hidden md:inline text-sm text-gray-700 dark:text-gray-300">{user.username}</span>
            <button
              onClick={logout}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hidden md:inline"
            >
              退出
            </button>
          </>
        ) : null}

        <button
          className="md:hidden p-2 rounded-md text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={onMenuClick}
          aria-label="打开菜单"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Update ProtectedRoute type**

Replace line 6:

```typescript
  allowedRoles?: Array<'admin' | 'user'>;
```

- [ ] **Step 3: Update App.tsx — remove allowedRoles from topic routes**

Replace lines 69-78 and 87-96:

```typescript
          <Route
            path="/topics/create"
            element={
              <ProtectedRoute>
                <AppShell>
                  <TopicCreatePage />
                </AppShell>
              </ProtectedRoute>
            }
          />
...
          <Route
            path="/topics/:id/edit"
            element={
              <ProtectedRoute>
                <AppShell>
                  <TopicEditorRouter />
                </AppShell>
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/TopNav.tsx frontend/src/components/ProtectedRoute.tsx frontend/src/App.tsx
git commit -m "feat: remove role-based route restrictions and role badge from nav"
```

---

### Task 9: Update frontend dashboard and topic list pages

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/pages/TopicListPage.tsx`

- [ ] **Step 1: Update DashboardPage — remove role-based sections**

Replace the full file:

```typescript
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';
import SettingsModal from '../components/settings/SettingsModal';

function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { setMeta } = useLayoutMeta();
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMeta({
      pageTitle: '控制台',
      breadcrumbSegments: [
        { label: '首页', to: '/dashboard' },
        { label: '控制台' },
      ],
      sideNavSlot: null,
    });
  }, [setMeta]);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">控制台</h1>
          <p className="text-gray-600 mt-1">
            欢迎，{user?.username}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">创建专题</h2>
          <p className="text-gray-600 mb-4">创建新的学习专题并发布</p>
          <button
            onClick={() => navigate('/topics/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            开始创建
          </button>
        </div>
        <div className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">我的专题</h2>
          <p className="text-gray-600 mb-4">查看和管理专题</p>
          <button
            onClick={() => navigate('/topics')}
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            查看专题
          </button>
        </div>

        <div className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">账户设置</h2>
          <p className="text-gray-600 mb-4">更新您的个人资料和偏好设置</p>
          <button
            ref={settingsBtnRef}
            onClick={() => setSettingsModalOpen(true)}
            className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            设置
          </button>
        </div>
      </div>

      <div className="mt-8 bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">最近活动</h2>
        <div className="text-gray-500 text-center py-8">
          暂无活动记录
        </div>
      </div>

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        triggerRef={settingsBtnRef}
      />
    </div>
  );
}

export default DashboardPage;
```

- [ ] **Step 2: Update TopicListPage — remove role-based rendering**

Replace the full file:

```typescript
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { LoadingOverlay } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { topicApi } from '../services/api';
import type { Topic } from '@web-learn/shared';
import { toast } from '../stores/useToastStore';
import { getApiErrorMessage } from '../utils/errors';
import { useLayoutMeta } from '../components/layout/LayoutMetaContext';

function TopicListPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { setMeta } = useLayoutMeta();

  useEffect(() => {
    setMeta({
      pageTitle: '专题列表',
      breadcrumbSegments: [
        { label: '首页', to: '/dashboard' },
        { label: '专题列表' },
      ],
      sideNavSlot: null,
    });
  }, [setMeta]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteTopic, setPendingDeleteTopic] = useState<Topic | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openMenuTopicId, setOpenMenuTopicId] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const data = await topicApi.getAll();
        setTopics(data);
      } catch {
        setError('获取专题列表失败');
      } finally {
        setLoading(false);
      }
    };

    fetchTopics();
  }, []);

  useEffect(() => {
    if (!openMenuTopicId) return;
    const handleClickOutside = () => setOpenMenuTopicId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuTopicId]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return '草稿';
      case 'published':
        return '已发布';
      case 'closed':
        return '已关闭';
      default:
        return status;
    }
  };

  const getTypeText = (type: string) => {
    return type === 'website' ? '网站型' : '知识库型';
  };

  const handleStatusChange = async (topicId: string, newStatus: 'draft' | 'published' | 'closed') => {
    const prevTopics = topics;
    setTopics(prev => prev.map(t => t.id === topicId ? { ...t, status: newStatus } : t));
    setOpenMenuTopicId(null);
    try {
      await topicApi.updateStatus(topicId, { status: newStatus });
      toast.success('状态已更新');
    } catch (err: unknown) {
      setTopics(prevTopics);
      toast.error(getApiErrorMessage(err, '更新状态失败'));
    }
  };

  const handleOpenDeleteDialog = (topic: Topic) => {
    setPendingDeleteTopic(topic);
    setDeleteDialogOpen(true);
  };

  const handleDeleteTopic = async () => {
    if (!pendingDeleteTopic) return;
    setDeleting(true);
    try {
      await topicApi.delete(pendingDeleteTopic.id);
      setTopics((prev) => prev.filter((topic) => topic.id !== pendingDeleteTopic.id));
      setDeleteDialogOpen(false);
      setPendingDeleteTopic(null);
      toast.success('专题已删除');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '删除专题失败'));
    } finally {
      setDeleting(false);
    }
  };

  const isTopicEditor = (topic: Topic) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return (topic.editors as string[] | undefined)?.includes(user.id.toString());
  };

  if (loading) {
    return <LoadingOverlay message="加载中..." />;
  }

  return (
    <>
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              专题列表
            </h1>
          </div>
          <button
            onClick={() => navigate('/topics/create')}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            创建专题
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {topics.length === 0 ? (
            <EmptyState
              icon="folder"
              title="还没有专题"
              description="创建您的第一个专题，开始组织教学内容"
              action={{
                label: '创建专题',
                onClick: () => navigate('/topics/create'),
              }}
            />
          ) : (
            topics.map((topic) => (
              <div key={topic.id} className="bg-white shadow rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start sm:items-center gap-3 flex-wrap">
                      <h2 className="text-xl font-semibold text-gray-900">
                        <Link to={`/topics/${topic.id}`} className="hover:text-blue-600">
                          {topic.title}
                        </Link>
                      </h2>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(topic.status)}`}>
                        {getStatusText(topic.status)}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {getTypeText(topic.type)}
                      </span>
                    </div>
                    {topic.description && (
                      <p className="text-gray-600 mb-3 line-clamp-2">{topic.description}</p>
                    )}
                    <div className="text-sm text-gray-500">创建时间: {new Date(topic.createdAt).toLocaleDateString('zh-CN')}</div>
                  </div>
                  <div className="sm:ml-4 flex-shrink-0 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                    <Link
                      to={`/topics/${topic.id}`}
                      className="w-full sm:w-auto text-blue-600 hover:text-blue-500 font-medium inline-block text-center"
                    >
                      查看详情 →
                    </Link>
                    {isTopicEditor(topic) && (
                      <>
                        <Link
                          to={`/topics/${topic.id}/edit`}
                          className="w-full sm:w-auto text-green-600 hover:text-green-500 font-medium inline-block text-center"
                        >
                          编辑专题 →
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteDialog(topic)}
                          className="w-full sm:w-auto text-red-600 hover:text-red-500 font-medium text-center"
                        >
                          删除专题 →
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuTopicId(openMenuTopicId === topic.id ? null : topic.id);
                            }}
                            className="p-1 text-gray-500 hover:text-gray-700 rounded"
                            aria-label="更多操作"
                          >
                            ⋯
                          </button>
                          {openMenuTopicId === topic.id && (
                            <div
                              className="absolute right-0 top-8 bg-white shadow-lg rounded-md border border-gray-200 z-10 min-w-[120px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {topic.status === 'draft' && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(topic.id, 'published')}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  发布
                                </button>
                              )}
                              {topic.status === 'published' && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(topic.id, 'closed')}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  关闭
                                </button>
                              )}
                              {topic.status === 'closed' && (
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(topic.id, 'published')}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  重新发布
                                </button>
                              )}
                              {(topic.status === 'published' || topic.status === 'closed') && (
                                <button
                                  type="button"
                                  onClick={() => { setOpenMenuTopicId(null); navigate(`/topics/${topic.id}/edit`); }}
                                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  编辑
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => { setOpenMenuTopicId(null); handleOpenDeleteDialog(topic); }}
                                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                删除
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {deleteDialogOpen && pendingDeleteTopic && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">删除专题</h3>
            <p className="text-sm text-gray-600">
              确认删除"{pendingDeleteTopic.title}"？该操作会删除专题及其页面内容。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setPendingDeleteTopic(null);
                }}
                className="px-3 py-1.5 text-sm rounded border border-gray-300"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteTopic}
                disabled={deleting}
                className="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TopicListPage;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/pages/TopicListPage.tsx
git commit -m "feat: remove role-based dashboard sections and topic list filtering"
```

---

### Task 10: Create database migration and update Topic format

**Files:**
- Create: `services/topic-space/src/migrations/add-editors-to-topics.ts` (or equivalent migration approach)
- Modify: `services/topic-space/src/controllers/topicController.ts` (formatTopic update)

- [ ] **Step 1: Update `formatTopic` to include `editors` field**

In `topicController.ts`, add `editors` to the format function (after line 28, before `createdAt`):

```typescript
const formatTopic = (topic: any) => ({
  id: topic.id.toString(),
  title: topic.title,
  description: topic.description,
  type: topic.type,
  websiteUrl: topic.website_url ?? null,
  createdBy: topic.created_by.toString(),
  creator: topic.creator
    ? {
      id: topic.creator.id.toString(),
      username: topic.creator.username,
      email: topic.creator.email,
    }
    : undefined,
  status: topic.status,
  filesSnapshot: (() => { try { return topic.files_snapshot ? JSON.parse(topic.files_snapshot) : null; } catch { return null; } })(),
  chatHistory: (() => { try { return topic.chat_history ? JSON.parse(topic.chat_history) : null; } catch { return null; } })(),
  publishedUrl: topic.published_url ?? null,
  shareLink: topic.share_link ?? null,
  editors: topic.editors ?? [],
  createdAt: topic.createdAt.toISOString(),
  updatedAt: topic.updatedAt.toISOString(),
});
```

Note: This needs to be done as part of Task 4 changes but is listed separately here for clarity.

- [ ] **Step 2: Create Sequelize migration script**

Since Sequelize with MySQL doesn't auto-migrate ENUM changes, create a migration. If the project uses `sequelize-cli` migrations, create the file at the appropriate path. If it runs migrations programmatically, add the ALTER statements to the startup.

Check if there's an existing migrations directory:

```bash
ls services/topic-space/src/migrations/ 2>/dev/null || echo "no migrations dir"
ls services/auth/src/migrations/ 2>/dev/null || echo "no migrations dir"
```

If no migrations directory exists, the migration will be done via a one-time startup script. Create `services/topic-space/src/utils/migrate.ts`:

```typescript
import { sequelize } from './database';

export const runMigrations = async () => {
  try {
    // Add editors column if it doesn't exist
    const tableInfo = await sequelize.queryInterface.describeTable('topic_topics');
    if (!tableInfo.editors) {
      await sequelize.queryInterface.addColumn('topic_topics', 'editors', {
        type: 'JSON',
        allowNull: false,
        defaultValue: [],
      });
      console.log('[migration] Added editors column to topic_topics');
    }

    // Update existing topics: set editors to [created_by]
    const { sequelize: seq } = await import('./database');
    const [topics] = await seq.query('SELECT id, created_by FROM topic_topics');
    for (const topic of topics as any[]) {
      await seq.query(
        'UPDATE topic_topics SET editors = ? WHERE id = ?',
        { replacements: [JSON.stringify([topic.created_by.toString()]), topic.id] }
      );
    }
    console.log(`[migration] Updated editors for ${(topics as any[]).length} existing topics`);

    // Update auth_users role ENUM (MySQL requires special handling)
    const authTableInfo = await sequelize.queryInterface.describeTable('auth_users');
    // For MySQL ENUM modification, run raw SQL
    try {
      await seq.query(
        "ALTER TABLE auth_users MODIFY COLUMN role ENUM('admin', 'user') NOT NULL DEFAULT 'user'"
      );
      // Update existing users
      await seq.query("UPDATE auth_users SET role = 'user' WHERE role IN ('teacher', 'student')");
      console.log('[migration] Updated auth_users role ENUM and existing users');
    } catch (e) {
      console.log('[migration] auth_users ENUM may already be updated or needs manual fix:', e);
    }

    console.log('[migration] All migrations completed successfully');
  } catch (error) {
    console.error('[migration] Failed:', error);
    throw error;
  }
};
```

- [ ] **Step 3: Integrate migration into topic-space server startup**

Find the server entry point (likely `services/topic-space/src/index.ts` or similar) and call `runMigrations()` before the server starts listening.

- [ ] **Step 4: Commit**

```bash
git add services/topic-space/src/utils/migrate.ts services/topic-space/src/controllers/topicController.ts
git commit -m "feat: add migration for editors column and role ENUM update"
```

---

### Task 11: Update Topic type to include editors field

**Files:**
- Modify: `shared/src/types/index.ts`

- [ ] **Step 1: Add `editors` to Topic interface**

In the Topic interface (after line 46, before `createdAt`):

```typescript
export interface Topic {
  id: string;
  title: string;
  description?: string;
  type: TopicType;
  websiteUrl?: string | null;
  createdBy: string;
  status: TopicStatusType;
  filesSnapshot?: Record<string, string> | null;
  chatHistory?: AIChatMessage[] | null;
  publishedUrl?: string | null;
  shareLink?: string | null;
  editors: string[];
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/src/types/index.ts
git commit -m "feat: add editors field to Topic interface"
```

---

### Task 12: Update test files for new role model

**Files:**
- Modify: `services/auth/tests/auth.test.ts`
- Modify: `services/ai/tests/ai.test.ts`
- Modify: `services/topic-space/tests/topics.test.ts`
- Modify: `services/topic-space/tests/pages.test.ts`
- Modify: `services/gateway/tests/auth-integration.test.ts`

- [ ] **Step 1: Update auth tests — change role references**

In `services/auth/tests/auth.test.ts`, replace all `'student'` and `'teacher'` with `'user'`:

```typescript
// All role: 'student' → role: 'user'
// All role: 'teacher' → role: 'user'
// Remove test "forces public registration to student when admin role is requested"
// Remove test "keeps teacher role when explicitly requested" (both are now the same role)
```

In `services/gateway/tests/auth-integration.test.ts`, change line 188:
```typescript
// OLD: expect(res.body.data.user.role).toBe('student');
// NEW: expect(res.body.data.user.role).toBe('user');
```

- [ ] **Step 2: Update topic-space tests — add editors field to test topics**

In `services/topic-space/tests/topics.test.ts` and `services/topic-space/tests/pages.test.ts`:

All test users now have `role: 'user'`. When creating topics in tests, add `editors: [userId.toString()]` to the topic attributes. The `ensureTopicOwner` → `hasTopicEditAccess` logic now checks `editors.includes(userId.toString())`.

Example pattern for all topic creation in tests:

```typescript
// When mocking Topic.create, ensure editors is set:
Topic.create.mockResolvedValue({
  id: 1,
  title: 'Test Topic',
  created_by: 1,
  editors: ['1'],
  // ... other fields
});
```

For topic.findByPk mocks, add `editors: ['1']` (or the appropriate user ID) to returned objects.

- [ ] **Step 3: Update AI tests — remove teacher-only building test, update mocks**

In `services/ai/tests/ai.test.ts`:
- Replace all `role: 'student'` with `role: 'user'`
- Replace all `role: 'teacher'` with `role: 'user'`
- Remove test "blocks building chat for non-teacher user" — this no longer applies
- Update topic mocks to include `editors: ['1']` so building access checks pass
- Update test "rejects building chat for non-owner teacher" → "rejects building chat for non-editor"

- [ ] **Step 4: Run all tests and fix any remaining failures**

```bash
# If the project has a test runner, run it:
npm test 2>&1 | head -100
```

Fix any remaining test failures caused by role references.

- [ ] **Step 5: Commit**

```bash
git add services/auth/tests/auth.test.ts services/ai/tests/ai.test.ts services/topic-space/tests/topics.test.ts services/topic-space/tests/pages.test.ts services/gateway/tests/auth-integration.test.ts
git commit -m "test: update tests for unified 'user' role and editors-based permissions"
```
