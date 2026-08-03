import { expect, test, type Page } from '@playwright/test';

async function enterDemo(page: Page, path = '/') {
  await page.goto(path);
  await page.getByLabel('工作邮箱').fill('reader@example.com');
  await page.getByRole('button', { name: '进入内部 Demo' }).click();
  await expect(page.getByRole('heading', { name: '市场知识平台' })).toBeVisible();
}

test('requires email entry, then loads the platform shell and API health', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '邮箱登录' })).toBeVisible();
  await page.getByLabel('工作邮箱').fill('reader@example.com');
  await page.getByRole('button', { name: '进入内部 Demo' }).click();

  await expect(page.getByRole('heading', { name: '市场知识平台' })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await expect(navigation.getByRole('link')).toHaveCount(3);
  await expect(navigation.getByRole('link', { name: '首页' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: '公司信息库' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: '行业报告库' })).toBeVisible();
  await expect(page.getByRole('link', { name: '管理中心' })).toHaveCount(0);
  await expect(page.getByText('API 正常')).toBeVisible();
});

test('serves SPA deep links and keeps unknown API routes as JSON 404', async ({ page }) => {
  await enterDemo(page, '/reports');
  await expect(page.getByRole('heading', { name: '行业报告库' })).toBeVisible();

  const health = await page.request.get('/api/v1/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: 'ok', service: 'api' });

  const missingApi = await page.request.get('/api/v1/not-a-route');
  expect(missingApi.status()).toBe(404);
  expect(missingApi.headers()['content-type']).toContain('application/json');
  expect(await missingApi.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: '无权访问' })).toBeVisible();
});

test('opens all eight companies and renders the protected Shell dashboards', async ({ page }) => {
  await enterDemo(page, '/companies');
  await expect(page.locator('.company-card')).toHaveCount(8);
  await page.locator('a[href="/companies/shell"]').click();

  await expect(page.getByRole('heading', { name: 'Shell 公司画像' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(5);
  await expect(page.frameLocator('iframe[title="Shell Banner"]').getByRole('heading', { name: 'Shell' })).toBeVisible();
  await expect(page.frameLocator('iframe[title="Shell 项目分布地图"]').locator('#total-projects')).toHaveText('552');
  await expect(page.getByText('附件未提供').first()).toBeVisible();
  await expect(page.getByText('暂无可追溯新闻数据')).toBeVisible();
});
