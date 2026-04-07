---
name: User Settings Modal Design
description: Design for user settings modal with profile, password, and theme preferences
type: spec
---

# User Settings Modal Design

**Last updated**: 2026-04-07

## Overview

Add a user settings modal accessible from the Dashboard page's "Account Settings" card. The modal provides three tabs: Profile, Password, and Theme.

## Requirements

### Functional Requirements
1. Users can view and edit their username
2. Users can view their email (read-only)
3. Users can change their password (no current password verification)
4. Users can toggle between light and dark theme
5. Theme preference persists in localStorage
6. Settings are accessible via the Dashboard page "Account Settings" button

### Non-Functional Requirements
1. Use existing modal pattern from the codebase
2. Follow existing form validation patterns (react-hook-form + zod)
3. Responsive design, consistent with existing UI
4. Optimistic updates for better UX

## Architecture

### Component Structure
```
frontend/src/
├── components/
│   └── settings/
│       ├── SettingsModal.tsx       # Main modal container with tabs
│       ├── ProfileTab.tsx          # Profile edit form
│       ├── PasswordTab.tsx         # Password change form
│       └── ThemeTab.tsx            # Theme preference selector
├── stores/
│   ├── useAuthStore.ts             # Add updateUser method
│   └── useThemeStore.ts            # New theme state management
└── pages/
    └── DashboardPage.tsx           # Connect settings button to modal
```

### State Management

#### useAuthStore Additions
```typescript
interface AuthState {
  // ... existing state ...
  updateUser: (data: { username?: string }) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
}
```

#### useThemeStore (New)
```typescript
type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}
```

## Detailed Design

### SettingsModal Component

**Props:**
```typescript
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**Structure:**
- Modal backdrop (existing pattern: `fixed inset-0 z-50 bg-black/40 flex items-center justify-center`)
- Modal container (`bg-white rounded-lg shadow-lg w-full max-w-md p-6`)
- Tab navigation (3 tabs: Profile, Password, Theme)
- Active tab content area
- Close button in top-right or footer

**Tab State:**
```typescript
type ActiveTab = 'profile' | 'password' | 'theme';
```

### ProfileTab Component

**Form Fields:**
- Username: text input, editable, required
- Email: text input, read-only, disabled

**Validation:**
- Username: required, min length 2, max length 50

**Behavior:**
- On submit: optimistic update + toast notification
- API call placeholder for future backend integration

### PasswordTab Component

**Form Fields:**
- New Password: password input, required
- Confirm Password: password input, required, must match

**Validation:**
- New password: min length 6
- Confirm password: must match new password

**Behavior:**
- No current password field (per requirements)
- On submit: optimistic logout + redirect to login (security best practice)
- Toast notification on success

### ThemeTab Component

**Options:**
- Light theme (default)
- Dark theme

**UI:**
- Radio buttons or toggle buttons
- Visual preview icons optional

**Behavior:**
- Immediate application of theme
- Persist to localStorage
- No submit button - changes apply instantly

## Theme Implementation

**CSS Approach:**
Use Tailwind CSS dark mode with `class` strategy:

```typescript
// tailwind.config.js
export default {
  darkMode: 'class',
  // ...
}
```

**Theme Application:**
```typescript
// In useThemeStore
setTheme: (theme: Theme) => {
  const root = window.document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem('theme', theme);
  set({ theme });
}
```

**Initialization:**
On app load, check localStorage and system preference:

```typescript
// In App.tsx or main.tsx
useEffect(() => {
  const savedTheme = localStorage.getItem('theme') as Theme | null;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');
  useThemeStore.getState().setTheme(theme);
}, []);
```

## API Design (Placeholder)

Design for future backend integration:

```typescript
// PATCH /api/users/me
interface UpdateUserDto {
  username?: string;
}

// POST /api/users/me/change-password
interface ChangePasswordDto {
  newPassword: string;
}
```

For now, these will be mocked in the store with optimistic updates only.

## Error Handling

- Form validation errors displayed inline
- API errors shown via toast notifications
- Network errors: generic error message + retry option where applicable

## Accessibility

- Modal traps focus
- Escape key closes modal
- Click outside closes modal
- Semantic HTML for tabs and form fields
- ARIA labels where necessary

## Testing Strategy

- Unit tests for each tab component
- Unit tests for useThemeStore
- Integration test for SettingsModal
- E2E test for complete settings flow

## Open Questions

None - all requirements clarified.

## Future Enhancements

- Add more theme options (system preference auto-detect)
- Add language preference
- Add email verification flow
- Add current password verification for password change
- Add avatar upload
