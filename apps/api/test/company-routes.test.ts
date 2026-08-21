import {
  CompanyDetailSchema,
  CompanyInformationListResponseSchema,
  CompanyListResponseSchema,
  DemoSessionResponseSchema,
  FidProjectListResponseSchema,
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
  updatedOn: '2026-08-07',
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
const news = {
  id: 'news-6a4de0f8c3776c4645229bee', kind: 'news' as const,
  title: 'Shell 发布项目进展', subtitle: 'Shell publishes project update',
  summary: '项目已进入下一阶段。', summaryEn: 'The project entered its next phase.',
  publisher: 'Shell', publishedOn: '2026-07-30', sourceFormat: '网页',
  attachmentAvailable: false, category: '项目进展', region: '全球',
  sourceUrl: 'https://www.shell.com/news/project-update',
};
const fidProject = {
  id: '6a705e88865ef4c4610556b2', project: 'Kulboy, UZ', approvalYear: '2030',
  asset: 'Kulboy, UZ', fieldType: 'Gas-Condensate field', facilityCategory: 'Onshore',
  interests: 'SOCAR* (30%); BP (40%); Uzbekneftegaz (30%)', country: 'Uzbekistan',
  economicsUsdMillion: 12.1725,
};

function appWith(repository: CompanyRepository) {
  const verifier: TokenVerifier = { verify: vi.fn(async () => identity) };
  const loader: PermissionLoader = { load: vi.fn(async () => user) };
  return createApp(() => ({ verifier, loader }), () => repository);
}

const repositoryAdditions: Pick<
  CompanyRepository,
  'listCompanyInformation' | 'listFidProjects' | 'findReportAsset' | 'findCompanyLogo'
> = {
  listCompanyInformation: vi.fn(async () => ({ information: [], total: 0 })),
  listFidProjects: vi.fn(async () => ({ projects: [], syncedOn: '2026-08-07', total: 0 })),
  findReportAsset: vi.fn(async () => null),
  findCompanyLogo: vi.fn(async () => null),
};

describe('company library API', () => {
  it('keeps company data behind authentication', async () => {
    const repository: CompanyRepository = {
      ...repositoryAdditions,
      list: vi.fn(), findBySlug: vi.fn(), listReports: vi.fn(), findReportById: vi.fn(),
    };
    expect((await appWith(repository).request('/api/v1/companies')).status).toBe(401);
  });

  it('publishes only read-only catalog and dashboard routes when public mode is explicit', async () => {
    const repository: CompanyRepository = {
      ...repositoryAdditions,
      list: vi.fn(async () => [summary]),
      findBySlug: vi.fn(async () => detail),
      listReports: vi.fn(async () => ({ reports: [report], syncedOn: '2026-08-04' })),
      findReportById: vi.fn(async () => report),
    };
    const assets = { fetch: vi.fn(async () => fetch('data:text/html,<html>dashboard</html>')) };
    const app = appWith(repository);
    const env = { ASSETS: assets, PUBLIC_READ_ONLY: 'true' };

    const companies = await app.request('/api/v1/companies', {}, env);
    const reports = await app.request('/api/v1/reports?page=1&pageSize=1&q=ESG', {}, env);
    const dashboard = await app.request('/company-assets/financial/shell.html', {}, env);
    const me = await app.request('/api/v1/me', {}, env);
    const writeAttempt = await app.request('/api/v1/companies', { method: 'POST' }, env);

    expect(companies.status).toBe(200);
    expect(companies.headers.get('cache-control')).toContain('public');
    expect(companies.headers.get('x-robots-tag')).toContain('noindex');
    expect(reports.status).toBe(200);
    expect(ReportListResponseSchema.parse(await reports.json())).toMatchObject({
      total: 1, page: 1, pageSize: 1,
    });
    expect(dashboard.status).toBe(200);
    expect(dashboard.headers.get('cache-control')).toContain('public');
    expect(me.status).toBe(401);
    expect(writeAttempt.status).toBe(401);
  });

  it('returns a strict company list and detail', async () => {
    const repository: CompanyRepository = {
      ...repositoryAdditions,
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

  it('returns paginated company news, reports, and deduplicated FID projects', async () => {
    const repository: CompanyRepository = {
      ...repositoryAdditions,
      list: vi.fn(), findBySlug: vi.fn(), listReports: vi.fn(), findReportById: vi.fn(),
      listCompanyInformation: vi.fn(async (_slug, kind) => ({
        information: kind === 'news' ? [news] : [], total: kind === 'news' ? 1 : 0,
      })),
      listFidProjects: vi.fn(async () => ({ projects: [fidProject], syncedOn: '2026-08-07', total: 1 })),
    };
    const app = appWith(repository);
    const headers = { authorization: 'Bearer token' };
    const newsResponse = await app.request('/api/v1/companies/shell/information?kind=news&page=1&pageSize=6', { headers });
    const fidResponse = await app.request('/api/v1/companies/shell/fid-projects?page=1&pageSize=10', { headers });

    expect(CompanyInformationListResponseSchema.parse(await newsResponse.json())).toMatchObject({ total: 1, kind: 'news' });
    const parsedFid = FidProjectListResponseSchema.parse(await fidResponse.json());
    expect(parsedFid.projects).toEqual([fidProject]);
    expect(JSON.stringify(parsedFid)).not.toContain('historicalCompany');
  });

  it('returns the report archive and metadata-only detail behind authentication', async () => {
    const repository: CompanyRepository = {
      ...repositoryAdditions,
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

  it('streams approved report attachments, covers, and company logos through controlled R2 routes', async () => {
    const bytes = new TextEncoder().encode('asset');
    const reference = {
      id: '0123456789abcdef01234567', objectKey: 'report-assets/published/attachments/file.pdf',
      fileName: '中东 LNG 报告.pdf', mimeType: 'application/pdf', byteSize: bytes.byteLength,
      sha256: 'a'.repeat(64),
    };
    const repository: CompanyRepository = {
      ...repositoryAdditions,
      list: vi.fn(), findBySlug: vi.fn(), listReports: vi.fn(), findReportById: vi.fn(),
      findReportAsset: vi.fn(async (_reportId, kind) => ({
        ...reference,
        objectKey: kind === 'cover' ? 'report-assets/published/covers/cover.webp' : reference.objectKey,
        fileName: kind === 'cover' ? 'cover.webp' : reference.fileName,
        mimeType: kind === 'cover' ? 'image/webp' : reference.mimeType,
      })),
      findCompanyLogo: vi.fn(async () => ({
        ...reference, objectKey: 'company-assets/published/logos/shell/logo.png',
        fileName: 'shell.png', mimeType: 'image/png',
      })),
    };
    const files = { get: vi.fn(async () => ({ body: bytes, etag: 'asset-etag' })) };
    const env = { ASSETS: { fetch: vi.fn() }, FILES: files, PUBLIC_READ_ONLY: 'true' };
    const app = appWith(repository);

    const attachment = await app.request(
      '/api/v1/reports/esg-disclosure-oil-gas/attachments/0123456789abcdef01234567', {}, env,
    );
    const cover = await app.request('/api/v1/reports/esg-disclosure-oil-gas/cover', {}, env);
    const logo = await app.request('/api/v1/companies/shell/logo', {}, env);

    expect(attachment.status).toBe(200);
    expect(attachment.headers.get('content-disposition')).toContain("filename*=UTF-8''");
    expect(attachment.headers.get('content-type')).toContain('application/pdf');
    expect(await attachment.text()).toBe('asset');
    expect(cover.headers.get('content-type')).toContain('image/webp');
    expect(logo.headers.get('content-type')).toContain('image/png');
    expect(files.get).toHaveBeenCalledTimes(3);
  });

  it('deduplicates concurrent read-only catalog queries inside one Worker isolate', async () => {
    const repository: CompanyRepository = {
      ...repositoryAdditions,
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
      ...repositoryAdditions,
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
      ...repositoryAdditions,
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
