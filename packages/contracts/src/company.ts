import { z } from 'zod';

export const CompanySlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
export type CompanySlug = z.infer<typeof CompanySlugSchema>;

export const CompanyTypeSchema = z.enum([
  'EPC',
  'IOC',
  'NOC',
  '联合体/合资公司',
  '船东',
  '资源型',
]);
export const CompanyDataCoverageSchema = z.enum(['complete', 'projects', 'profile']);

export const CompanySummarySchema = z.strictObject({
  slug: CompanySlugSchema,
  displayName: z.string().min(1).max(100),
  companyType: CompanyTypeSchema,
  country: z.string().min(1).max(100),
  region: z.string().min(1).max(100),
  business: z.string().min(1).max(500),
  marketPosition: z.string().min(1).max(1_000),
  headquarters: z.string().min(1).max(200),
  projectCount: z.number().int().nonnegative(),
  countryCount: z.number().int().nonnegative(),
  dataCoverage: CompanyDataCoverageSchema,
});
export type CompanySummary = z.infer<typeof CompanySummarySchema>;

export const CompanyListResponseSchema = z.strictObject({
  companies: z.array(CompanySummarySchema).max(500),
});
export type CompanyListResponse = z.infer<typeof CompanyListResponseSchema>;

const LocalDashboardUrlSchema = z.string().regex(/^\/company-assets\/[A-Za-z0-9/?=&._-]+$/);
export const CompanyDashboardsSchema = z.strictObject({
  map: LocalDashboardUrlSchema.nullable(),
  projectType: LocalDashboardUrlSchema.nullable(),
  production: LocalDashboardUrlSchema.nullable(),
  financial: LocalDashboardUrlSchema.nullable(),
});

export const RelatedInformationSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  kind: z.enum(['report', 'news']),
  title: z.string().min(1).max(500),
  summary: z.string().min(1).max(2_000).nullable(),
  publisher: z.string().min(1).max(200),
  publishedOn: z.iso.date().nullable(),
  sourceFormat: z.string().min(1).max(20),
  attachmentAvailable: z.boolean(),
});
export type RelatedInformation = z.infer<typeof RelatedInformationSchema>;

export const RelatedCompanySchema = z.strictObject({
  slug: CompanySlugSchema,
  displayName: z.string().min(1).max(200),
});

export const ReportInformationTypeSchema = z.enum([
  '年度综合报告',
  '财务报告',
  'ESG与可持续发展报告',
  '行业研究报告',
]);
export const ReportSourceFamilySchema = z.enum(['公司披露', '行业研究']);

export const ReportSummarySchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  title: z.string().min(1).max(500),
  subtitle: z.string().min(1).max(500).nullable(),
  summary: z.string().min(1).max(2_000).nullable(),
  industry: z.string().min(1).max(100),
  region: z.string().min(1).max(100),
  informationType: ReportInformationTypeSchema,
  sourceFamily: ReportSourceFamilySchema,
  publisher: z.string().min(1).max(200),
  publishedOn: z.iso.date().nullable(),
  language: z.string().min(1).max(30),
  sourceFormat: z.string().min(1).max(20),
  attachmentAvailable: z.boolean(),
  keywords: z.array(z.string().min(1).max(100)).max(30),
  relatedCompanies: z.array(RelatedCompanySchema).max(100),
  detailStatus: z.literal('metadata-only'),
});
export type ReportSummary = z.infer<typeof ReportSummarySchema>;

export const ReportListResponseSchema = z.strictObject({
  reports: z.array(ReportSummarySchema).max(2_000),
  syncedOn: z.iso.date(),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  facets: z.strictObject({
    industries: z.array(z.string().min(1).max(100)).max(200),
    regions: z.array(z.string().min(1).max(100)).max(200),
    informationTypes: z.array(ReportInformationTypeSchema),
    sourceFamilies: z.array(ReportSourceFamilySchema),
    publishers: z.array(z.string().min(1).max(200)).max(1_000),
  }),
});
export type ReportListResponse = z.infer<typeof ReportListResponseSchema>;

export const ReportDetailSchema = ReportSummarySchema;
export type ReportDetail = z.infer<typeof ReportDetailSchema>;

export const CompanyDetailSchema = CompanySummarySchema.extend({
  sourceId: z.string().regex(/^[a-f0-9]{24}$/),
  website: z.url().refine((value) => value.startsWith('https://')),
  foundedYear: z.number().int().min(1800).max(2100),
  businessRegions: z.array(z.string().min(1).max(100)).min(1),
  dashboards: CompanyDashboardsSchema,
  relatedInformation: z.array(RelatedInformationSchema),
  newsStatus: z.literal('not-provided'),
});
export type CompanyDetail = z.infer<typeof CompanyDetailSchema>;

export const DemoSessionRequestSchema = z.strictObject({
  email: z.email().max(254),
});
export type DemoSessionRequest = z.infer<typeof DemoSessionRequestSchema>;
export const DemoSessionResponseSchema = z.strictObject({
  accessToken: z.literal('demo.local'),
  email: z.email().max(254),
});
export type DemoSessionResponse = z.infer<typeof DemoSessionResponseSchema>;
