import { z } from 'zod';

export const companySlugValues = [
  'adnoc',
  'bp',
  'chevron',
  'eni',
  'exxonmobil',
  'petronas',
  'shell',
  'totalenergies',
] as const;

export const CompanySlugSchema = z.enum(companySlugValues);
export type CompanySlug = z.infer<typeof CompanySlugSchema>;

export const CompanySummarySchema = z.strictObject({
  slug: CompanySlugSchema,
  displayName: z.string().min(1).max(100),
  companyType: z.enum(['IOC', 'NOC']),
  country: z.string().min(1).max(100),
  region: z.string().min(1).max(100),
  business: z.string().min(1).max(500),
  marketPosition: z.string().min(1).max(1_000),
  headquarters: z.string().min(1).max(200),
  projectCount: z.number().int().positive(),
  countryCount: z.number().int().positive(),
});
export type CompanySummary = z.infer<typeof CompanySummarySchema>;

export const CompanyListResponseSchema = z.strictObject({
  companies: z.array(CompanySummarySchema).max(100),
});
export type CompanyListResponse = z.infer<typeof CompanyListResponseSchema>;

const LocalDashboardUrlSchema = z.string().regex(/^\/company-assets\/[A-Za-z0-9/?=&._-]+$/);
export const CompanyDashboardsSchema = z.strictObject({
  banner: LocalDashboardUrlSchema,
  map: LocalDashboardUrlSchema,
  projectType: LocalDashboardUrlSchema,
  production: LocalDashboardUrlSchema,
  financial: LocalDashboardUrlSchema,
});

export const RelatedInformationSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  kind: z.enum(['report', 'news']),
  title: z.string().min(1).max(500),
  summary: z.string().min(1).max(2_000),
  sourceName: z.string().min(1).max(200),
  publishedOn: z.iso.date(),
  sourceFormat: z.string().min(1).max(20),
  attachmentAvailable: z.boolean(),
});
export type RelatedInformation = z.infer<typeof RelatedInformationSchema>;

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
export const DemoSessionResponseSchema = z.strictObject({
  accessToken: z.literal('demo.local'),
  email: z.email().max(254),
});
