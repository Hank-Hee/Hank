import { expect, test, type Page } from '@playwright/test';

async function enterDemo(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.getByRole('heading', { name: /惠生清能\s*市场知识平台/ })).toBeVisible();
}

test('opens the local read-only platform without an email entry', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /惠生清能\s*市场知识平台/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '邮箱登录' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '退出' })).toHaveCount(0);
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

test('opens the full company directory and renders the protected Shell portfolio', async ({ page }) => {
  await enterDemo(page, '/companies');
  await expect(page.locator('.company-table tbody tr')).toHaveCount(126);
  await page.locator('a[href="/companies/shell"]').click();

  await expect(page.getByRole('heading', { name: 'Shell', exact: true })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(4);
  await expect(page.frameLocator('iframe[title="Shell 全球业务／项目分布"]').locator('#total-projects')).toHaveText('552');
  await expect(page.getByRole('heading', { name: '经营与财务表现' })).toBeVisible();
  await expect(page.getByText('附件未提供').first()).toBeVisible();
  await expect(page.getByText('暂无可追溯新闻数据')).toBeVisible();
});

test('filters report metadata and opens an honest metadata-only detail', async ({ page }) => {
  await enterDemo(page, '/reports');
  await expect(page.locator('.report-list > article')).toHaveCount(50);
  await expect(page.getByText('第 1 / 23 页')).toBeVisible();
  await page.getByLabel('报告检索').fill('IEA 2026年全球能源投资报告');
  await page.getByRole('link', { name: 'IEA 2026年全球能源投资报告' }).click();
  await expect(page.getByText('附件未上传')).toBeVisible();
  await expect(page.getByText(/未提供研究结论与目录/)).toBeVisible();
  await expect(page.getByText('发布机构')).toBeVisible();
});

test('keeps profile-only companies usable without inventing missing modules', async ({ page }) => {
  await enterDemo(page, '/companies/black-and-veatch');
  await expect(page.getByRole('heading', { name: 'Black & Veatch', exact: true })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByText('仓库尚未提供该公司的项目分布与项目类型数据。')).toBeVisible();
  await expect(page.getByText('仓库尚未提供该公司的产量数据。')).toBeVisible();
  await expect(page.getByText('仓库尚未提供该公司的财务数据。')).toBeVisible();
});
