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

    expect(companies).toHaveLength(8);
    expect(companies.map(({ slug }) => slug)).toContain('exxonmobil');
    expect(shell).toMatchObject({
      slug: 'shell',
      projectCount: 552,
      newsStatus: 'not-provided',
    });
    expect(shell?.relatedInformation).toHaveLength(2);
    expect(shell?.relatedInformation.every(({ attachmentAvailable }) => !attachmentAvailable)).toBe(true);
  });
});
