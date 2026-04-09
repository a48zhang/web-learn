---
name: UX Audit Report
description: Comprehensive user experience audit of the WebLearn platform identifying gaps and improvement opportunities
type: reference
---

# UX Audit Report - WebLearn Platform

> 最后更新：2026-04-08
>
> 审计范围：访客、学生、教师三种角色的完整用户体验

---

## 关键发现 - 按优先级排序

### 🔴 高优先级问题（Critical）

#### 1. 访客 - 没有公开首页

**问题描述**：
- 访客访问根路径 `/` 时被强制重定向到 `/dashboard`
- 未登录用户看到的是登录页面，无法浏览任何专题内容
- 违反了"完全公开浏览"的设计原则

**影响**：
- 高跳出率 - 访客在了解平台价值前就离开了
- 无法展示平台内容吸引用户注册
- 与产品规格中"访客无需登录即可浏览"的要求相矛盾

**建议方案**：
- 创建公开首页路由 `/`，展示：
  - 精选/热门专题
  - 平台价值主张说明
  - 清晰的"注册"和"登录"按钮
  - 专题搜索和分类浏览
- 已登录用户访问 `/` 时重定向到 `/dashboard`
- 保持 `/topics` 路由对所有用户公开

**技术实现要点**：
```tsx
// App.tsx 路由调整示例
<Route path="/" element={<PublicHomePage />} />
<Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
<Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
```

---

#### 2. 教师 - 编辑器没有保存状态指示

**问题描述**：
- WebsiteEditorPage中没有自动保存状态指示器
- 用户不知道工作是否已保存
- 没有最后保存时间戳
- 缺少明确的保存按钮反馈

**影响**：
- 用户焦虑 - 担心丢失工作
- 可能导致不必要的手动刷新
- 糟糕的编辑体验

**建议方案**：
添加以下保存状态反馈：
1. **自动保存指示器**：
   - "已保存" - 所有更改已持久化
   - "保存中..." - 正在保存
   - "未保存更改" - 有本地更改未保存
2. **最后保存时间戳**：显示"上次保存于 14:32"
3. **手动保存按钮**：提供明确的保存按钮，点击后显示成功反馈
4. **离开页面警告**：有未保存更改时尝试导航离开，显示确认对话框

**技术实现要点**：
```typescript
// 编辑器状态类型
interface EditorSaveState {
  status: 'saving' | 'saved' | 'unsaved';
  lastSavedAt: Date | null;
  hasUnsavedChanges: boolean;
}

// 使用 beforeunload 事件
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [hasUnsavedChanges]);
```

---

#### 3. 所有用户 - AI助手对话历史不持久化

**问题描述**：
- AIChatSidebar中的对话在关闭侧边栏或导航后消失
- 用户需要重复询问相同的问题
- 失去上下文连贯性

**影响**：
- 用户体验沮丧
- AI助手效用降低
- 浪费API调用

**建议方案**：
- 按专题保存对话历史到后端
- Topic模型已有 `chatHistory` 字段，利用起来
- 重新打开侧边栏时加载历史对话
- 提供"清空对话"选项

**技术实现要点**：
```typescript
// 加载历史对话
useEffect(() => {
  if (topic?.chatHistory) {
    setMessages(topic.chatHistory);
  }
}, [topic]);

// 保存对话（防抖）
const saveChatHistory = useCallback(
  debounce(async (messages: AIChatMessage[]) => {
    await topicApi.update(topicId, { chatHistory: messages });
  }, 2000),
  [topicId]
);
```

#### 4. 所有用户 - 主题偏好不持久化

**问题描述**：
- 需要确认主题切换是否跨会话保存
- [待验证] 当前实现可能只保存在本地状态，刷新页面后可能丢失

**影响**：
- 用户每次登录需要重新设置主题
- 体验不一致

**建议方案**：
- 将主题偏好保存到用户设置（后端）或 localStorage（未登录用户）
- 登录后自动应用用户偏好

---

## 已验证问题

#### 4. 所有用户 - 主题偏好持久化 ✅

**状态：** 无需修改

`useThemeStore` 已使用 Zustand `persist` 中间件将主题偏好保存到 localStorage（key: `theme-storage`）。
刷新页面、重新登录后均能正确恢复主题偏好。
