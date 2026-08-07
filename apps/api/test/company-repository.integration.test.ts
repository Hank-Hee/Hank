import { describe, expect, it } from 'vitest';
import { createCompanyRepository } from '../src/company/company-repository';
import { demoUserId } from '../src/auth/environment-token-verifier';

const connectionString = process.env.TEST_DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const repository = createCompanyRepository({ connectionString });

describe('company repository integration', () => {
  it('reads the seeded list and detail through app_runtime RLS', async () => {
    const identity = { userId: demoUserId };
    const companies = await repository.list(identity, 'req_company_list_12345678');
    const shell = await repository.findBySlug('shell', identity, 'req_company_detail_12345678');
    const catalog = await repository.listReports(identity, 'req_report_list_12345678');
    const news = await repository.listCompanyInformation('shell', 'news', 1, 6, identity, 'req_company_news_12345678');
    const relatedReports = await repository.listCompanyInformation('shell', 'report', 1, 6, identity, 'req_company_reports_12345678');
    const fid = await repository.listFidProjects('shell', 1, 10, identity, 'req_company_fid_12345678');
    const report = await repository.findReportById(
      'rystad-6a4de0f8c3776c4645229bee', identity, 'req_report_detail_12345678',
    );

    expect(companies).toHaveLength(126);
    expect(companies.map(({ slug }) => slug)).toContain('exxonmobil');
    expect(companies).toContainEqual(expect.objectContaining({
      slug: 'black-and-veatch', dataCoverage: 'profile', companyType: 'EPC',
    }));
    expect(shell).toMatchObject({
      slug: 'shell',
      projectCount: 552,
      newsStatus: 'available',
    });
    expect(shell?.relatedInformation).toHaveLength(0);
    expect(news?.total).toBe(126);
    expect(news?.information).toHaveLength(6);
    expect(relatedReports?.total).toBe(21);
    expect(fid?.total).toBe(39);
    expect(fid?.projects).toHaveLength(10);
    expect(JSON.stringify(fid)).not.toContain('historicalCompany');
    expect(catalog.reports).toHaveLength(1_111);
    expect(catalog.syncedOn).toBe('2026-08-07');
    expect(report).toMatchObject({
      id: 'rystad-6a4de0f8c3776c4645229bee',
      publisher: 'Rystad Energy',
      sourceFamily: '行业研究',
      attachmentAvailable: false,
      detailStatus: 'metadata-only',
    });
  });
});
