import {
  CompanyDetailSchema,
  CompanyInformationListResponseSchema,
  CompanyListResponseSchema,
  DemoSessionRequestSchema,
  DemoSessionResponseSchema,
  ReportDetailSchema,
  ReportListResponseSchema,
  FidProjectListResponseSchema,
} from '@wison/contracts';
import { describe, expect, it } from 'vitest';

const company = {
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

describe('company library contracts', () => {
  it('accepts the full catalog company types and explicit data coverage', () => {
    const catalogCompany = {
      ...company,
      slug: 'black-and-veatch',
      displayName: 'Black & Veatch',
      companyType: 'EPC',
      projectCount: 0,
      countryCount: 0,
      dataCoverage: 'profile',
    };
    const parsed = CompanyListResponseSchema.parse({
      companies: [{ ...company, logoUrl: '/api/v1/companies/shell/logo' }, catalogCompany],
    });
    expect(parsed.companies[0]?.slug).toBe('shell');
    expect(parsed.companies[0]?.logoUrl).toBe('/api/v1/companies/shell/logo');
    expect(parsed.companies[1]?.companyType).toBe('EPC');
    expect(() => CompanyListResponseSchema.parse({ companies: [{ ...company, extra: true }] })).toThrow();
  });

  it('keeps dashboard URLs local and reports attachments explicit', () => {
    const detail = CompanyDetailSchema.parse({
      ...company,
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
      relatedInformation: [{
        id: 'esg-disclosure-oil-gas',
        kind: 'report',
        title: '油气企业 ESG 披露与转型指标比较',
        summary: null,
        summaryEn: null,
        publisher: 'Energy Institute',
        publishedOn: null,
        sourceFormat: '未提供',
        attachmentAvailable: false,
        category: null,
        region: '全球',
        sourceUrl: null,
      }],
      newsStatus: 'not-provided',
    });
    expect(Object.values(detail.dashboards).every((url) => url?.startsWith('/company-assets/'))).toBe(true);
    expect(detail.relatedInformation[0]?.attachmentAvailable).toBe(false);
  });

  it('validates paginated company news and FID rows', () => {
    const news = CompanyInformationListResponseSchema.parse({
      information: [{
        id: 'news-1234567890abcdef12345678', kind: 'news', title: '项目启动', subtitle: 'Project starts',
        summary: '项目摘要', summaryEn: 'Project summary', publisher: 'Upstream Online',
        publishedOn: '2026-08-07', sourceFormat: '网页', attachmentAvailable: false,
        category: '项目进展', region: '中东及南亚', sourceUrl: 'https://example.com/news',
      }],
      kind: 'news', total: 1, page: 1, pageSize: 6,
    });
    const fid = FidProjectListResponseSchema.parse({
      projects: [{
        id: '6a705e88865ef4c4610556b2', project: 'Kulboy, UZ', approvalYear: '2030',
        asset: 'Kulboy, UZ', fieldType: 'Gas-Condensate field', facilityCategory: 'Onshore',
        interests: 'SOCAR* (30%); BP (40%); Uzbekneftegaz (30%)', country: 'Uzbekistan',
        economicsUsdMillion: 12.1725,
      }],
      syncedOn: '2026-08-07', total: 1, page: 1, pageSize: 10,
    });
    expect(news.information[0]?.sourceUrl).toBe('https://example.com/news');
    expect(fid.projects[0]).not.toHaveProperty('historicalCompany');
  });

  it('keeps report metadata strict and exposes approved downloadable assets explicitly', () => {
    const report = {
      id: 'lng-middle-east-2026',
      title: '中东 LNG 供需与项目扩张展望 2026',
      subtitle: 'Middle East LNG Supply, Demand and Project Outlook 2026',
      summary: null,
      industry: 'LNG',
      region: '中东',
      informationType: '行业研究报告',
      sourceFamily: '行业研究',
      publisher: 'Rystad Energy',
      publishedOn: '2026-07-22',
      language: '中英',
      sourceFormat: 'PDF',
      attachmentAvailable: false,
      attachmentCount: 0,
      coverUrl: null,
      keywords: ['LNG', '扩建'],
      relatedCompanies: [{ slug: 'adnoc', displayName: 'ADNOC' }],
      detailStatus: 'metadata-only',
    };
    const catalog = ReportListResponseSchema.parse({
      reports: [report],
      syncedOn: '2026-08-04',
      total: 1,
      page: 1,
      pageSize: 50,
      facets: {
        industries: ['LNG'],
        regions: ['全球'],
        informationTypes: ['行业研究报告'],
        sourceFamilies: ['行业研究'],
        publishers: ['Rystad Energy'],
      },
    });
    expect(catalog.reports).toHaveLength(1);
    expect(catalog.total).toBe(1);
    expect(ReportDetailSchema.parse({ ...report, attachments: [] }).attachmentAvailable).toBe(false);
    const attached = ReportDetailSchema.parse({
      ...report,
      attachmentAvailable: true,
      attachmentCount: 2,
      coverUrl: '/api/v1/reports/lng-middle-east-2026/cover',
      detailStatus: 'attachment-available',
      attachments: [{
        id: '0123456789abcdef01234567',
        fileName: 'Middle East LNG Outlook.pdf',
        mimeType: 'application/pdf',
        byteSize: 2048,
        downloadUrl: '/api/v1/reports/lng-middle-east-2026/attachments/0123456789abcdef01234567',
      }],
    });
    expect(attached.attachments).toHaveLength(1);
    expect(() => ReportDetailSchema.parse({ ...report, findings: ['未提供'] })).toThrow();
  });

  it('validates the local demo email session envelope', () => {
    expect(DemoSessionRequestSchema.parse({ email: 'reader@example.com' }).email).toBe('reader@example.com');
    expect(() => DemoSessionRequestSchema.parse({ email: 'invalid' })).toThrow();
    expect(DemoSessionResponseSchema.parse({ accessToken: 'demo.local', email: 'reader@example.com' }))
      .toEqual({ accessToken: 'demo.local', email: 'reader@example.com' });
  });
});
