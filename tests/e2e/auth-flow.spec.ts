import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.describe('Registration', () => {
    test('registers a new user and redirects to dashboard', async ({ page }) => {
      await page.goto('/register');

      const uniqueEmail = `e2e_${Date.now()}@test.com`;

      await page.getByLabel('用户名').fill('e2etest');
      await page.getByLabel('邮箱地址').fill(uniqueEmail);
      await page.getByLabel('密码', { exact: true }).fill('E2ePass123!');
      await page.getByLabel('确认密码').fill('E2ePass123!');
      await page.getByRole('button', { name: '注册' }).click();

      // Should redirect to dashboard after successful registration
      await expect(page).toHaveURL(/\/dashboard/);

      // Token should be stored in localStorage
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeTruthy();
    });
  });

  test.describe('Login', () => {
    test('logs in with valid credentials and redirects to dashboard', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel('邮箱地址').fill('admin@test.com');
      await page.getByLabel('密码').fill('Admin123!');
      await page.getByRole('button', { name: '登录' }).click();

      await expect(page).toHaveURL(/\/dashboard/);

      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeTruthy();
    });

    test('shows error with invalid credentials', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel('邮箱地址').fill('wrong@test.com');
      await page.getByLabel('密码').fill('wrongpassword');
      await page.getByRole('button', { name: '登录' }).click();

      await expect(page.getByText('登录失败')).toBeVisible();
    });
  });

  test.describe('Protected Routes', () => {
    test('redirects unauthenticated user to login when accessing dashboard', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/);
    });

    test('redirects authenticated user from /login to dashboard', async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel('邮箱地址').fill('admin@test.com');
      await page.getByLabel('密码').fill('Admin123!');
      await page.getByRole('button', { name: '登录' }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      // Now try to go to login - should redirect to dashboard
      await page.goto('/login');
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('redirects authenticated user from / to dashboard', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('邮箱地址').fill('admin@test.com');
      await page.getByLabel('密码').fill('Admin123!');
      await page.getByRole('button', { name: '登录' }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      await page.goto('/');
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test.describe('Logout', () => {
    test('logs out and redirects to login', async ({ page }) => {
      // Login first
      await page.goto('/login');
      await page.getByLabel('邮箱地址').fill('admin@test.com');
      await page.getByLabel('密码').fill('Admin123!');
      await page.getByRole('button', { name: '登录' }).click();
      await expect(page).toHaveURL(/\/dashboard/);

      // Click logout
      await page.getByRole('button', { name: /退出/ }).click();

      await expect(page).toHaveURL(/\/login/);
      const token = await page.evaluate(() => localStorage.getItem('token'));
      expect(token).toBeFalsy();
    });
  });
});
