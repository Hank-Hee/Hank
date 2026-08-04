import {
  CompanyDetailSchema,
  CompanyListResponseSchema,
  DemoSessionResponseSchema,
  ReportDetailSchema,
  ReportListResponseSchema,
  type CompanySummary,
  UserContextSchema,
  type CompanyDetail,
} from '@wison/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import type { PermissionLoader, TokenVerifier } from '../src/auth/types';
import type { CompanyRepository } from '../src/company/company-repository';

const identity = { userId: '00000000-0000-4000-8000-000000000030' };
const user = UserContextSchema.parse({
  userId: identity.userId,
  email: 'company-demo@local.wison',
  roles: ['sales_bd'],
  permissions: ['platform.access'],
});
const summary: CompanySummary = {
  slug: 'shell',
  displayName: 'Shell',
  companyType: 'IOC',
  country: '英国',
  region: '北海/北欧',
  business: '综合油气、上游勘探开发、LNG',
  marketPosition: '全球综合能源公司',
  headquarters: '伦敦，英国',
  projectCount: 552,
  countryCount: 32,
  dataCoverage: 'complete',
};
const detail: CompanyDetail = CompanyDetailSchema.parse({
  ...summary,
  sourceId: '6a1e90aa11f1cb641ce4fe1a',
  website: 'https://www.shell.com/',
  foundedYear: 1890,
  businessRegions: ['北海/北欧'],
  dashboards: {
    map: '/company-assets/maps/index.html?operator=Shell',
    projectType: '/company-assets/charts/project-type/index.html?operator=Shell',
    production: '/company-assets/production/shell.html',
    financial: '/company-assets/financial/shell.html',
  },
  relatedInformation: [],
  newsStatus: 'not-provided',
});
const report = ReportDetailSchema.parse({
  id: 'esg-disclosure-oil-gas',
  title: '油气企业 ESG 披露与转型指标比较',
  subtitle: 'ESG Disclosure and Transition Metrics for Oil and Gas Companies',
  summary: '比较国际油气公司的披露指标。',
  industry: 'ESG与可持续发展',
  region: '全球',
  informationType: 'ESG与可持续发展报告',
  sourceFamily: '公司披露',
  publisher: 'Energy Institute',
  publishedOn: '2026-06-30',
  language: '中文',
  sourceFormat: 'PDF',
  attachmentAvailable: false,
  keywords: ['ESG'],
  relatedCompanies: [{ slug: 'shell', displayName: 'Shell' }],
  detailStatus: 'metadata-only',
});

function appWith(repository: CompanyRepository) {
  const verifier: TokenVerifier = { verify: vi.fn(async () => identity) };
  const loader: PermissionLoader = { load: vi.fn(async () => user) };
  return createApp(() => ({ verifier, loader }), () => repository);
}

describe('company library API', () => {
  it('keeps company data behind authentication', async () => {
    const repository: CompanyRepository = {
      list: vi.fn(), findBySlug: vi.fn(), listReports: vi.fn(), findReportById: vi.fn(),
    };
    expect((await appWith(repository).request('/api/v1/companies')).status).toBe(401);
  });

  it('returns a strict company list and detail', async () => {
    const repository: CompanyRepository = {
      list: vi.fn(async () => [summary]),
      findBySlug: vi.fn(async () => detail),
      listReports: vi.fn(async () => ({ reports: [report], syncedOn: '2026-08-04' })),
      findReportById: vi.fn(async () => report),
    };
    const app = appWith(repository);
    const headers = { authorization: 'Bearer token' };
    const list = await app.request('/api/v1/companies', { headers });
    const item = await app.request('/api/v1/companies/shell', { headers });

    expect(CompanyListResponseSchema.parse(await list.json()).companies).toHaveLength(1);
    expect(CompanyDetailSchema.parse(await item.json()).slug).toBe('shell');
  });

  it('returns the report archive and metadata-only detail behind authentication', async () => {
    const repository: CompanyRepository = {
      list: vi.fn(),
      findBySlug: vi.fn(),
      listReports: vi.fn(async () => ({ reports: [report], syncedOn: '2026-08-04' })),
      findReportById: vi.fn(async () => report),
    };
    const app = appWith(repository);
    expect((await app.request('/api/v1/reports')).status).toBe(401);
    const headers = { authorization: 'Bearer token' };
    const list = await app.request('/api/v1/reports', { headers });
    const item = await app.request('/api/v1/reports/esg-disclosure-oil-gas', { headers });
    expect(ReportListResponseSchema.parse(await list.json()).reports).toHaveLength(1);
    expect(ReportDetailSchema.parse(await item.json()).detailStatus).toBe('metadata-only');
  });

  it('deduplicates concurrent read-only catalog queries inside one Worker isolate', async () => {
    const repository: CompanyRepository = {
      list: vi.fn(async () => [summary]),
      findBySlug: vi.fn(async () => detail),
      listReports: vi.fn(async () => ({ reports: [report], syncedOn: '2026-08-04' })),
      findReportById: vi.fn(async () => report),
    };
    const app = appWith(repository);
    const request = (path: string) => app.request(path, { headers: { authorization: 'Bearer token' } });
    const responses = await Promise.all([
      request('/api/v1/companies'), request('/api/v1/companies'),
      request('/api/v1/reports'), request('/api/v1/reports'),
    ]);

    expect(responses.every(({ status }) => status === 200)).toBe(true);
    expect(repository.list).toHaveBeenCalledOnce();
    expect(repository.listReports).toHaveBeenCalledOnce();
  });

  it('returns a safe 404 for an unknown company', async () => {
    const repository: CompanyRepository = {
      list: vi.fn(async () => []),
      findBySlug: vi.fn(async () => null),
      listReports: vi.fn(async () => ({ reports: [], syncedOn: '2026-08-04' })),
      findReportById: vi.fn(async () => null),
    };
    const response = await appWith(repository).request('/api/v1/companies/unknown', {
      headers: { authorization: 'Bearer token' },
    });
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain('SQL');
  });

  it('protects dashboard assets and serves them through the authenticated Worker', async () => {
    const repository: CompanyRepository = {
      list: vi.fn(), findBySlug: vi.fn(), listReports: vi.fn(), findReportById: vi.fn(),
    };
    const assets = {
      fetch: vi.fn(async () => fetch('data:text/html,<html>dashboard</html>')),
    };
    const app = appWith(repository);
    const denied = await app.request('/company-assets/banners/shell.html', {}, { ASSETS: assets });
    const allowed = await app.request('/company-assets/banners/shell.html', {
      headers: { cookie: 'demo_session=token' },
    }, { ASSETS: assets });

    expect(denied.status).toBe(401);
    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toContain('dashboard');
    expect(allowed.headers.get('content-security-policy')).toContain("frame-ancestors 'self'");
    expect(allowed.headers.get('content-security-policy')).not.toContain('unpkg.com');
    expect(assets.fetch).toHaveBeenCalledOnce();
  });
});

describe('local demo session', () => {
  it('is disabled unless the exact development flag is enabled', async () => {
    const response = await createApp().request('/api/v1/demo/session', {
      method: 'POST',
      body: JSON.stringify({ email: 'reader@example.com' }),
      headers: { 'content-type': 'application/json' },
    }, { DEMO_AUTH_ENABLED: 'false' });
    expect(response.status).toBe(404);
  });

  it('validates email and returns the fixed local token only in demo mode', async () => {
    const app = createApp();
    const invalid = await app.request('/api/v1/demo/session', {
      method: 'POST', body: JSON.stringify({ email: 'invalid' }),
      headers: { 'content-type': 'application/json' },
    }, { DEMO_AUTH_ENABLED: 'true' });
    const valid = await app.request('/api/v1/demo/session', {
      method: 'POST', body: JSON.stringify({ email: 'reader@example.com' }),
      headers: { 'content-type': 'application/json' },
    }, { DEMO_AUTH_ENABLED: 'true' });
    expect(invalid.status).toBe(400);
    expect(DemoSessionResponseSchema.parse(await valid.json()))
      .toEqual({ accessToken: 'demo.local', email: 'reader@example.com' });
    expect(valid.headers.get('set-cookie')).toContain('demo_session=demo.local');
    expect(valid.headers.get('set-cookie')).toContain('HttpOnly');
  });
});
