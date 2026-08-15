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
  await expect(page.getByRole('heading', { name: '快速定位公司档案与行业研究资料' })).toBeVisible();
  await expect(page.getByText('内部知识平台')).toBeVisible();
  await expect(page.getByText('仅限授权员工访问')).toBeVisible();
  await expect(page.getByText(/Portfolio/)).toHaveCount(0);
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
  await page.getByRole('heading', { name: '经营与财务表现' }).scrollIntoViewIfNeeded();
  await expect(page.locator('iframe')).toHaveCount(4);
  await expect(page.frameLocator('iframe[title="Shell 全球业务／项目分布"]').locator('#total-projects')).toHaveText('552');
  await expect(page.getByRole('heading', { name: '经营与财务表现' })).toBeVisible();
  await expect(page.getByText('附件未提供').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'FID Tracker' })).toBeVisible();
  await expect(page.locator('.fid-table tbody tr')).toHaveCount(10);
  await expect(page.getByRole('columnheader', { name: '记录 ID' })).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: '历史所属公司' })).toHaveCount(0);
  await expect(page.getByText('126条新闻')).toBeVisible();
});

test('switches native application pages to English without duplicate eyebrow titles', async ({ page }) => {
  await enterDemo(page);
  await page.getByRole('button', { name: '选择语言' }).click();
  await page.getByRole('menuitem', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Wison New Energies Market Knowledge Platform' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Company Library', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Company Library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Company Library' })).toBeVisible();
  await expect(page.getByText('Internal Knowledge Platform')).toBeVisible();
  await expect(page.getByText('Authorized employees only')).toBeVisible();
  await expect(page.getByText('COMPANY DIRECTORY')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Company Library' })).toBeVisible();
});

test('keeps the larger content hierarchy aligned on desktop and usable on mobile', async ({ page }) => {
  await enterDemo(page, '/companies');
  const companyRowStyles = await page.locator('.company-table tbody tr').first().evaluate((row) => {
    const cells = row.querySelectorAll('td');
    const link = row.querySelector('td:first-child a');
    return {
      bodySize: getComputedStyle(cells[1]!).fontSize,
      linkSize: getComputedStyle(link!).fontSize,
      verticalAlign: getComputedStyle(cells[1]!).verticalAlign,
    };
  });
  expect(companyRowStyles).toEqual({ bodySize: '14px', linkSize: '15px', verticalAlign: 'middle' });

  await page.goto('/reports');
  const reportStyles = await page.locator('.report-list > article').first().evaluate((article) => ({
    alignItems: getComputedStyle(article).alignItems,
    coverFit: getComputedStyle(article.querySelector('img')!).objectFit,
    titleSize: getComputedStyle(article.querySelector('h3')!).fontSize,
    dateSize: getComputedStyle(article.querySelector('time')!).fontSize,
  }));
  expect(reportStyles).toEqual({ alignItems: 'center', coverFit: 'contain', titleSize: '18px', dateSize: '13px' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/companies/shell');
  await expect(page.getByRole('heading', { name: 'Shell', exact: true })).toBeVisible();
  await expect(page.locator('.company-anchor-nav')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const mobileHierarchy = await page.evaluate(() => ({
    bannerTitle: getComputedStyle(document.querySelector('.company-banner h2')!).fontSize,
    anchor: getComputedStyle(document.querySelector('.company-anchor-nav a')!).fontSize,
    section: getComputedStyle(document.querySelector('.section-heading h3')!).fontSize,
  }));
  expect(mobileHierarchy).toEqual({ bannerTitle: '34px', anchor: '14px', section: '24px' });
});

test('renders native pages and all four embedded dashboards without visible Chinese in English mode', async ({ page }) => {
  await enterDemo(page);
  await page.getByRole('button', { name: '选择语言' }).click();
  await page.getByRole('menuitem', { name: 'English' }).click();
  await page.goto('/companies/shell');
  await expect(page.getByRole('heading', { name: 'Shell', exact: true })).toBeVisible();
  await page.getByRole('heading', { name: 'Operating and financial performance' }).scrollIntoViewIfNeeded();
  await expect(page.locator('iframe')).toHaveCount(4);
  await expect(page.frameLocator('iframe[title="Shell Global business / project distribution"]').locator('#total-projects')).toHaveText('552');
  expect(await page.locator('body').innerText()).not.toMatch(/[\u3400-\u9fff]/u);
  for (const iframe of await page.locator('iframe').elementHandles()) {
    const frame = await iframe.contentFrame();
    if (!frame) throw new Error('Dashboard frame did not load.');
    await frame.locator('body').waitFor({ state: 'visible' });
    expect(await frame.locator('body').innerText()).not.toMatch(/[\u3400-\u9fff]/u);
  }

  await page.goto('/reports');
  await expect(page.locator('.report-list > article')).toHaveCount(50);
  expect(await page.locator('body').innerText()).not.toMatch(/[\u3400-\u9fff]/u);
  await page.locator('.report-list h3 a').first().click();
  await expect(page.getByRole('heading', { name: 'Archive information' })).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(/[\u3400-\u9fff]/u);
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
