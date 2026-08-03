import {
  CompanyDetailSchema,
  CompanyListResponseSchema,
  DemoSessionRequestSchema,
  DemoSessionResponseSchema,
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
};

describe('company library contracts', () => {
  it('accepts the strict eight-company list shape', () => {
    const parsed = CompanyListResponseSchema.parse({ companies: [company] });
    expect(parsed.companies[0]?.slug).toBe('shell');
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
        banner: '/company-assets/banners/shell.html',
        map: '/company-assets/maps/index.html?operator=Shell',
        projectType: '/company-assets/charts/project-type/index.html?operator=Shell',
        production: '/company-assets/production/shell.html',
        financial: '/company-assets/financial/shell.html',
      },
      relatedInformation: [{
        id: 'esg-disclosure-oil-gas',
        kind: 'report',
        title: '油气企业 ESG 披露与转型指标比较',
        summary: '摘要',
        sourceName: 'Energy Institute',
        publishedOn: '2026-06-30',
        sourceFormat: 'PDF',
        attachmentAvailable: false,
      }],
      newsStatus: 'not-provided',
    });
    expect(Object.values(detail.dashboards).every((url) => url.startsWith('/company-assets/'))).toBe(true);
    expect(detail.relatedInformation[0]?.attachmentAvailable).toBe(false);
  });

  it('validates the local demo email session envelope', () => {
    expect(DemoSessionRequestSchema.parse({ email: 'reader@example.com' }).email).toBe('reader@example.com');
    expect(() => DemoSessionRequestSchema.parse({ email: 'invalid' })).toThrow();
    expect(DemoSessionResponseSchema.parse({ accessToken: 'demo.local', email: 'reader@example.com' }))
      .toEqual({ accessToken: 'demo.local', email: 'reader@example.com' });
  });
});
