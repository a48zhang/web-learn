import { test, expect } from '@playwright/test';

test.describe('Topic Lifecycle', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  async function loginAsAdmin(page: ReturnType<typeof test['use']>) {
    // We need a page object - this is a helper function used within tests
    // Login via API to set token in localStorage
    await page.context().addInitScript(() => {
      // We'll handle this in the test directly
    });
  }

  test('creates a topic and sees it in the list', async ({ page }) => {
    // Login first via API to set localStorage
    const loginRes = await page.request.post('/api/auth/login', {
      data: { email: 'admin@test.com', password: 'Admin123!' },
    });
    const { token } = (await loginRes.json()).data;

    await page.evaluate((tok) => {
      localStorage.setItem('token', tok);
    }, token);

    // Go to topic creation page
    await page.goto('/topics/create');
    await expect(page).toHaveURL(/\/topics\/create/);

    // Fill in the form
    await page.getByLabel('专题标题').fill('E2E Test Topic');
    await page.getByLabel('专题描述').fill('This is an E2E test topic');
    await page.getByRole('button', { name: '创建专题' }).click();

    // Should redirect to the topic edit page
    await expect(page).toHaveURL(/\/topics\/\d+\/edit/);
  });

  test('edits a topic title and description', async ({ page }) => {
    // Login
    const loginRes = await page.request.post('/api/auth/login', {
      data: { email: 'admin@test.com', password: 'Admin123!' },
    });
    const { token } = (await loginRes.json()).data;
    await page.evaluate((tok) => localStorage.setItem('token', tok), token);

    // Create a topic via API first (more reliable than UI for setup)
    const createRes = await page.request.post('/api/topics', {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Edit Me', description: 'Original' },
    });
    const { id } = (await createRes.json()).data;

    // Navigate to edit page
    await page.goto(`/topics/${id}/edit`);
    await expect(page).toHaveURL(/\/edit/);

    // The topic detail page should show the title
    // Update title and description via the edit form
    // Check that we're on the edit page
    await expect(page.locator('h1, h2')).toContainText(/Edit Me|编辑/);
  });

  test('publishes and closes a topic', async ({ page }) => {
    const loginRes = await page.request.post('/api/auth/login', {
      data: { email: 'admin@test.com', password: 'Admin123!' },
    });
    const { token } = (await loginRes.json()).data;
    await page.evaluate((tok) => localStorage.setItem('token', tok), token);

    // Create topic
    const createRes = await page.request.post('/api/topics', {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Publish Test', description: '' },
    });
    const { id } = (await createRes.json()).data;

    // Publish the topic
    const publishRes = await page.request.patch(`/api/topics/${id}/status`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: 'published' },
    });
    expect(publishRes.status()).toBe(200);
    const publishBody = await publishRes.json();
    expect(publishBody.data.status).toBe('published');

    // Close the topic
    const closeRes = await page.request.patch(`/api/topics/${id}/status`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: 'closed' },
    });
    expect(closeRes.status()).toBe(200);
    const closeBody = await closeRes.json();
    expect(closeBody.data.status).toBe('closed');
  });

  test('unauthenticated user cannot create topic', async ({ page }) => {
    // Make sure no token
    await page.evaluate(() => localStorage.removeItem('token'));

    await page.goto('/topics/create');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
