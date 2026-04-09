import { test, expect } from '@playwright/test';

test.describe('Page Management', () => {
  async function getAdminToken(page: ReturnType<typeof test['use']>) {
    const loginRes = await page.request.post('/api/auth/login', {
      data: { email: 'admin@test.com', password: 'Admin123!' },
    });
    const { token } = (await loginRes.json()).data;
    return token;
  }

  test('creates pages for a topic and lists them', async ({ page }) => {
    const token = await getAdminToken(page);
    await page.evaluate((tok) => localStorage.setItem('token', tok), token);

    // Create a topic via API
    const createRes = await page.request.post('/api/topics', {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Page Management Test', description: '' },
    });
    const { id } = (await createRes.json()).data;

    // Create pages via API
    const page1Res = await page.request.post(`/api/topics/${id}/pages`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Page One', content: '<h1>Page 1</h1>', orderIndex: 0 },
    });
    expect(page1Res.status()).toBe(201);

    const page2Res = await page.request.post(`/api/topics/${id}/pages`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Page Two', content: '<h1>Page 2</h1>', orderIndex: 1 },
    });
    expect(page2Res.status()).toBe(201);

    // Verify pages exist via API
    const listRes = await page.request.get(`/api/topics/${id}/pages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { data } = (await listRes.json());
    expect(data.length).toBeGreaterThanOrEqual(2);
    expect(data.map((p: any) => p.title)).toContain('Page One');
    expect(data.map((p: any) => p.title)).toContain('Page Two');
  });

  test('updates a page and verifies changes', async ({ page }) => {
    const token = await getAdminToken(page);
    await page.evaluate((tok) => localStorage.setItem('token', tok), token);

    const topicRes = await page.request.post('/api/topics', {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Page Update Test', description: '' },
    });
    const { id: topicId } = (await topicRes.json()).data;

    const createPageRes = await page.request.post(`/api/topics/${topicId}/pages`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Old Title', content: '<p>Old</p>', orderIndex: 0 },
    });
    const { id: pageId } = (await createPageRes.json()).data;

    // Update the page
    const updateRes = await page.request.put(`/api/pages/${pageId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'New Title', content: '<p>New Content</p>' },
    });
    expect(updateRes.status()).toBe(200);
    const updateBody = await updateRes.json();
    expect(updateBody.data.title).toBe('New Title');

    // Verify via GET
    const getRes = await page.request.get(`/api/pages/${pageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getBody = await getRes.json();
    expect(getBody.data.title).toBe('New Title');
  });

  test('deletes a page and confirms removal', async ({ page }) => {
    const token = await getAdminToken(page);
    await page.evaluate((tok) => localStorage.setItem('token', tok), token);

    const topicRes = await page.request.post('/api/topics', {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Page Delete Test', description: '' },
    });
    const { id: topicId } = (await topicRes.json()).data;

    const createPageRes = await page.request.post(`/api/topics/${topicId}/pages`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'To Delete', content: '<p>X</p>', orderIndex: 0 },
    });
    const { id: pageId } = (await createPageRes.json()).data;

    // Delete the page
    const deleteRes = await page.request.delete(`/api/pages/${pageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteRes.status()).toBe(200);

    // Verify it's gone
    const listRes = await page.request.get(`/api/topics/${topicId}/pages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { data } = (await listRes.json());
    expect(data.some((p: any) => p.id === pageId)).toBe(false);
  });

  test('reorders pages via reorder API', async ({ page }) => {
    const token = await getAdminToken(page);
    await page.evaluate((tok) => localStorage.setItem('token', tok), token);

    const topicRes = await page.request.post('/api/topics', {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Page Reorder Test', description: '' },
    });
    const { id: topicId } = (await topicRes.json()).data;

    const p1 = await page.request.post(`/api/topics/${topicId}/pages`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'First', content: '<p>1</p>', orderIndex: 0 },
    });
    const p2 = await page.request.post(`/api/topics/${topicId}/pages`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'Second', content: '<p>2</p>', orderIndex: 1 },
    });

    const listRes = await page.request.get(`/api/topics/${topicId}/pages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pages = (await listRes.json()).data;
    const pageIds = pages.map((p: any) => p.id).reverse();

    // Reorder
    const reorderRes = await page.request.patch(`/api/topics/${topicId}/pages/reorder`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { pageIds },
    });
    expect(reorderRes.status()).toBe(200);
  });
});
