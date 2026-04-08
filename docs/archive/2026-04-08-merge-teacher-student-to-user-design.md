# Design: Merge Teacher/Student Roles into User

## Problem

The current system distinguishes between `teacher` and `student` roles, requiring role selection at registration and gating features like topic creation, page editing, and AI agent access behind `role === 'teacher'`. The goal is to eliminate this distinction: all registered users become `user`, with only `admin` remaining as a separate role (invisible in UI, same as now).

Additionally, topic editing should support a **collaborative permissions model** — creators can grant edit access to specific users.

## Changes

### 1. Role Constants & Types

**Files:** `shared/src/types/index.ts`, `shared/src/auth/types.ts`

- `UserRole` object: `{ ADMIN: 'admin', USER: 'user' }` (remove `TEACHER`, `STUDENT`)
- `UserRoleType`: `'admin' | 'user'`
- `CreateUserDto.role`: `'user'` only (remove `'teacher' | 'student'`)

### 2. Database Migration

**File:** `services/auth/src/models/User.ts`

- `role` column: `ENUM('admin', 'user')` (was `ENUM('admin', 'teacher', 'student')`)
- Default: `'user'` (unchanged)
- Migration script: `UPDATE auth_users SET role = 'user' WHERE role IN ('teacher', 'student')`

**File:** `services/topic-space/src/models/Topic.ts`

- Add `editors` column: `DataTypes.ARRAY(DataTypes.STRING)` — stores user IDs with edit permission
- Creator is automatically added to `editors` on topic creation

### 3. Backend Permission Overhaul

#### Auth Service (`services/auth/src/controllers/authController.ts`)
- Registration: remove role forcing logic (no longer forces 'student')
- New users always get `role: 'user'`

#### Topic Controller (`services/topic-space/src/controllers/topicController.ts`)
- **Create topic:** remove `role !== 'teacher'` check — all logged-in users can create
- **Edit/Delete topic:** check if user is in `editors` array OR is admin
- **View non-published topics:** visible if user is in `editors` array OR is admin
- **`ensureTopicOwner` middleware:** replace with `ensureTopicEditor` (checks `editors.includes(userId) || role === 'admin'`)

#### Page Controller (`services/topic-space/src/controllers/pageController.ts`)
- **Edit pages:** remove `role !== 'teacher'` check — permission inherited from parent topic's `editors` list
- **View private pages:** visible if user is in parent topic's `editors` array OR is admin
- **View page by ID:** same permission check as above

#### AI Controller (`services/ai/src/controllers/aiController.ts`)
- Remove `role !== 'teacher'` check for building agent — all users can use AI
- Pass `userRole` to context remains (only for logging/analytics if needed)

#### Agent Tools (`services/ai/src/services/agentTools.ts`)
- Remove `userRole !== 'teacher'` check for building access

#### Gateway (`services/gateway/src/authVerificationMiddleware.ts`)
- `x-user-role` header continues to work with new values (`admin` | `user`)

### 4. Frontend Changes

#### Registration Page (`frontend/src/pages/RegisterPage.tsx`)
- Remove role selection radio buttons (学生/教师)
- Remove role field from Zod validation schema
- Registration always sends `role: 'user'`

#### TopNav (`frontend/src/components/layout/TopNav.tsx`)
- Remove role badge display
- "新建专题" link: show to all logged-in users (remove `role === 'teacher'` check)

#### ProtectedRoute (`frontend/src/components/ProtectedRoute.tsx`)
- `allowedRoles` type: `Array<'admin' | 'user'>` (was `'admin' | 'teacher' | 'student'`)

#### App Router (`frontend/src/App.tsx`)
- Remove `allowedRoles={['teacher']}` from `/topics/create` and `/topics/:id/edit` routes — these routes are now accessible to all logged-in users

#### Dashboard Page (`frontend/src/pages/DashboardPage.tsx`)
- Remove role-based conditional content
- Remove role display from welcome message

#### Topic List Page (`frontend/src/pages/TopicListPage.tsx`)
- Remove teacher-only conditional rendering
- All users see create/edit buttons

#### Auth Store (`frontend/src/stores/useAuthStore.ts`)
- `register` method: accept `'user'` role (or remove role parameter entirely)

## Impact Summary

| Area | Change |
|------|--------|
| Shared types | UserRole constants, UserRoleType, CreateUserDto |
| Auth service | User model, authController, register validation |
| Topic space service | Topic model (editors field), topicController, pageController |
| AI service | aiController, agentTools |
| Gateway | No changes (header passthrough works) |
| Frontend | RegisterPage, TopNav, ProtectedRoute, App, DashboardPage, TopicListPage, useAuthStore |

## Migration Steps

1. Update shared types
2. Create Sequelize migration for User model
3. Create Sequelize migration for Topic model (add editors column)
4. Update backend permission checks in all services
5. Update frontend components
6. Run migration and verify existing users are updated to `user` role
