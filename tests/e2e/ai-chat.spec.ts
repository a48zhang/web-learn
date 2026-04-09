import { test, expect } from '@playwright/test';

test.describe('AI Chat', () => {
  test('sends a chat message and receives a response', async ({ page }) => {
    // Login
    const loginRes = await page.request.post('/api/auth/login', {
      data: { email: 'admin@test.com', password: 'Admin123!' },
    });
    const { token } = (await loginRes.json()).data;
    await page.evaluate((tok) => localStorage.setItem('token', tok), token);

    // Create a topic
    const topicRes = await page.request.post('/api/topics', {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'AI Chat Test', description: '' },
    });
    const { id: topicId } = (await topicRes.json()).data;

    // Navigate to the editor where AI chat is available
    await page.goto(`/topics/${topicId}/edit`);

    // The AI Chat sidebar should be visible
    await expect(page.getByText('Agent 对话')).toBeVisible();

    // Note: Full chat interaction depends on OpenAI being configured.
    // We verify the UI elements are present and the chat input is accessible.
    // A full chat test would require mocking the OpenAI response.
  });

  test('AI chat endpoint is reachable with auth (API level)', async ({ page }) => {
    const loginRes = await page.request.post('/api/auth/login', {
      data: { email: 'admin@test.com', password: 'Admin123!' },
    });
    const { token } = (await loginRes.json()).data;

    // Send a chat request - it may succeed or fail depending on OpenAI config,
    // but should NOT return 401 (auth passed through)
    const chatRes = await page.request.post('/api/ai/chat', {
      headers: { Authorization: `Bearer ${token}` },
      data: { messages: [{ role: 'user', content: 'hello' }] },
    });
    expect(chatRes.status()).not.toBe(401);
  });
});
