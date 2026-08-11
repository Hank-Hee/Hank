import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('reference UI keeps page eyebrows deep blue and dashboard frames scroll-free', async () => {
  const [styles, router, productionStyles] = await Promise.all([
    readFile(new URL('../apps/web/src/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../apps/web/src/app-router.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../production/production-dashboard.css', import.meta.url), 'utf8'),
  ]);

  assert.match(styles, /\.page-heading \.eyebrow\s*\{[^}]*color:\s*var\(--brand-700\)/s);
  assert.match(styles, /\.app-shell\s*\{[^}]*grid-template-columns:\s*244px/s);
  assert.match(styles, /\.primary-nav a\s*\{[^}]*min-height:\s*52px[^}]*font-size:\s*16px/s);
  assert.match(styles, /\.primary-nav i\s*\{[^}]*width:\s*24px[^}]*height:\s*24px/s);
  assert.match(styles, /\.home-hero\s*\{[^}]*min-height:\s*280px[^}]*padding:\s*44px 48px/s);
  assert.match(styles, /\.home-hero h2\s*\{[^}]*font-size:\s*36px/s);
  assert.match(styles, /\.company-banner h2\s*\{[^}]*font-size:\s*clamp\(36px,\s*4vw,\s*50px\)/s);
  assert.match(styles, /\.company-banner p\s*\{[^}]*font-size:\s*16px/s);
  assert.match(styles, /\.company-anchor-nav a\s*\{[^}]*font-size:\s*15px/s);
  assert.match(styles, /\.section-heading h3\s*\{[^}]*font-size:\s*24px/s);
  assert.match(styles, /\.company-table td\s*\{[^}]*vertical-align:\s*middle/s);
  assert.match(styles, /\.company-table td:first-child a\s*\{[^}]*font-size:\s*15px/s);
  assert.match(styles, /\.report-list > article\s*\{[^}]*align-items:\s*center/s);
  assert.match(styles, /\.report-list-visual time\s*\{[^}]*font-size:\s*13px/s);
  assert.match(styles, /\.report-list h3\s*\{[^}]*font-size:\s*18px/s);
  assert.match(styles, /\.library-icon\s*\{[^}]*width:\s*42px[^}]*height:\s*42px[^}]*border-radius:\s*4px/s);
  assert.match(styles, /\.dashboard-frame\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(router, /scrolling="no"/);
  assert.doesNotMatch(router, /className="eyebrow"|banner-kicker/);
  assert.doesNotMatch(router, /邮箱登录|工作邮箱|进入内部 Demo/);
  assert.doesNotMatch(router, /快速定位公司档案、Portfolio 与行业研究资料|内部只读 Demo/);
  assert.match(productionStyles, /html, body\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s);
  assert.match(productionStyles, /\.chart-stage\s*\{[^}]*flex:\s*1[^}]*min-height:\s*0/s);
});
