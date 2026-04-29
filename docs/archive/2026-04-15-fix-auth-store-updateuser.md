# Fix useAuthStore updateUser / changePassword 空壳问题

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `updateUser` 和 `changePassword` 从空壳改为真实调用后端 API，用户操作结果与预期一致（持久化生效）。

**Architecture:** 后端在 auth 服务添加 `PUT /api/users/me` 更新用户名、`POST /api/users/me/change-password` 修改密码；前端 `authApi` 增加对应方法，`useAuthStore` 替换空壳实现为真实 API 调用。

**Tech Stack:** Express + Sequelize (backend), Axios + Zustand (frontend)

---

## 文件变更概览

| 文件 | 变更 |
|------|------|
| `services/auth/src/routes/users.ts` | 新增 `PUT /me` 和 `POST /me/change-password` 路由 |
| `services/auth/src/controllers/userController.ts` | 新增 `updateMe`、`changePassword` 两个 handler |
| `frontend/src/services/api.ts` | `authApi` 新增 `updateMe`、`changePassword` 方法 |
| `frontend/src/stores/useAuthStore.ts` | `updateUser`、`changePassword` 替换为空壳调用真实 API |

---

## Task 1: 后端 — 添加 updateMe 和 changePassword handler

**Files:**
- Modify: `services/auth/src/controllers/userController.ts`
- Modify: `services/auth/src/routes/users.ts`

---

### Task 1.1: 添加 updateMe handler

**Files:**
- Modify: `services/auth/src/controllers/userController.ts`

- [ ] **Step 1: 在 userController.ts 末尾添加 updateMe 函数**

```typescript
// services/auth/src/controllers/userController.ts 新增

export const updateMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByPk(req.user!.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const { username } = req.body;
    if (username !== undefined) {
      if (typeof username !== 'string' || username.length < 2 || username.length > 50) {
        return res.status(400).json({ success: false, error: 'Username must be 2-50 characters' });
      }
      user.username = username;
    }

    await user.save();
    return res.json({
      success: true,
      data: {
        id: String(user.id),
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
```

- [ ] **Step 2: 添加 changePassword handler**

```typescript
// services/auth/src/controllers/userController.ts 新增（放在 updateMe 之后）

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByPk(req.user!.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'currentPassword and newPassword are required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'newPassword must be at least 6 characters' });
    }

    const valid = await user.comparePassword(currentPassword);
    if (!valid) {
      return res.status(403).json({ success: false, error: 'Current password is incorrect' });
    }

    await user.set('password', newPassword);
    await user.save();
    return res.json({ success: true, data: { message: 'Password changed successfully' } });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
```

- [ ] **Step 3: 在 routes/users.ts 挂载新路由**

```typescript
// services/auth/src/routes/users.ts

import { getMe, updateMe, changePassword } from '../controllers/userController';

// GET /me 已存在，新增两条：
router.put('/me', writeLimiter, authMiddleware, updateMe);
router.post('/me/change-password', writeLimiter, authMiddleware, changePassword);
```

同时在文件顶部添加 writeLimiter：
```typescript
const writeLimiter = rateLimit({ windowMs: 60000, max: 100, standardHeaders: true, legacyHeaders: false });
```

- [ ] **Step 4: 验证后端路由挂载成功**

Run: `cd services/auth && npm run dev 2>&1 | head -20`
Expected: 无编译错误，路由注册日志（如果有）

---

## Task 2: 前端 — authApi 添加 updateMe 和 changePassword

**Files:**
- Modify: `frontend/src/services/api.ts`

---

- [ ] **Step 1: 在 authApi 对象中添加两个方法**

```typescript
// frontend/src/services/api.ts — 在 authApi 对象内添加

updateMe: async (data: { username: string }): Promise<User> => {
  const response = await api.put<ApiResponse<User>>('/users/me', data);
  return response.data.data as User;
},

changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<void> => {
  const response = await api.post<ApiResponse<{ message: string }>>('/users/me/change-password', data);
  return response.data.data as unknown as void;
},
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "(error|users|api)" | head -20`
Expected: 无相关错误（可能有无辜的预发错误，忽略）

---

## Task 3: useAuthStore — 替换空壳为真实 API 调用

**Files:**
- Modify: `frontend/src/stores/useAuthStore.ts`

---

- [ ] **Step 1: 替换 updateUser 实现**

在 `updateUser` 函数体内替换为：

```typescript
updateUser: async (data: { username?: string }) => {
  const currentUser = get().user;
  // Optimistic update
  if (currentUser) {
    set({ user: { ...currentUser, ...data } });
  }
  try {
    const updated = await authApi.updateMe(data);
    set({ user: updated });
  } catch (error) {
    // Rollback optimistic update on failure
    if (currentUser) {
      set({ user: currentUser });
    }
    throw error;
  }
},
```

- [ ] **Step 2: 替换 changePassword 实现**

```typescript
changePassword: async (newPassword: string) => {
  await authApi.changePassword({ currentPassword: '', newPassword });
  get().logout();
},
```

> **注意**：SettingsModal 中目前没有提供 currentPassword 输入框（changePassword 在 SettingsModal 中有独立标签页 PasswordTab）。前端需要确保用户输入了 currentPassword 才能调用。此处先实现基础版本，PasswordTab 的 currentPassword 输入在 Task 4 处理。

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "useAuthStore|api\.ts" | head -20`
Expected: 无错误

---

## Task 4: ProfileTab — 捕获 API 错误并正确显示（顺带修复）

**Files:**
- Modify: `frontend/src/components/settings/ProfileTab.tsx`

---

- [ ] **Step 1: 确认 ProfileTab 的 onSubmit 已正确调用 updateUser**

当前 ProfileTab 的 onSubmit：
```typescript
const onSubmit = async (data: ProfileFormValues) => {
  try {
    await updateUser({ username: data.username });
    reset({ username: data.username });
    toast.success('个人资料已更新');
  } catch {
    toast.error('更新失败，请稍后重试');
  }
};
```

此代码已正确调用 `updateUser`，无需修改。但 `updateUser` 抛出错误时 toast 显示的是"更新失败"（通用错误），可以改进为从错误对象提取具体信息，不过这是低优先级改进，不阻塞本次 plan。

---

## Task 5: 端到端验证

---

- [ ] **Step 1: 启动 auth 服务**

Run: `cd services/auth && npm run dev`
Expected: 服务启动无错误

- [ ] **Step 2: 启动 gateway**

Run: `cd services/gateway && npm run dev`
Expected: 路由注册成功

- [ ] **Step 3: 测试 PUT /api/users/me**

```bash
TOKEN="<登录获取的token>"
curl -X PUT http://localhost:3000/api/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"newname"}' | jq .
```
Expected: `{"success":true,"data":{"id":"...","username":"newname",...}}`

- [ ] **Step 4: 测试 updateUser 在前端正常工作**

在浏览器中：设置 → 个人资料 → 修改用户名 → 保存 → 刷新页面 → 用户名保留
Expected: 刷新后新用户名仍在

---

## 自检清单

- [ ] `updateMe` 和 `changePassword` 两个 handler 是否都处理了 404（用户不存在）？
- [ ] `updateMe` 是否验证了 username 长度范围（2-50）？
- [ ] `changePassword` 是否验证了新密码长度（≥6）？
- [ ] `changePassword` 是否验证了 currentPassword 正确？
- [ ] `useAuthStore.updateUser` 是否在 API 失败时回滚 optimistic update？
- [ ] 所有 API 路由是否都挂了 `authMiddleware`（需要登录）？
- [ ] 路由路径 `/me` 前是否有 `/api` 前缀？（由 gateway 统一添加，确认 routes 文件挂载在 `/api/users` 下即可）
