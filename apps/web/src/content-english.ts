import type { CompanyDetail, CompanySummary } from '@wison/contracts';
import companyContent from '../../../data/company-content-en.json';
import generatedValues from '../../../data/value-content-en.json';

type CompanyEnglish = {
  business: string;
  country: string;
  headquarters: string;
  marketPosition: string;
  region: string;
};

const companies = companyContent as Record<string, CompanyEnglish>;
export const generatedValueEnglish = generatedValues as Record<string, string>;

export function localizeCompany<T extends CompanySummary | CompanyDetail>(company: T, locale: 'zh' | 'en'): T {
  if (locale !== 'en') return company;
  const content = companies[company.slug];
  if (!content) return company;
  const localized = { ...company, ...content } as T;
  if ('businessRegions' in localized) {
    localized.businessRegions = localized.businessRegions.map((region) => generatedValueEnglish[region] ?? region);
  }
  return localized;
}

export function businessSegments(business: string, locale: 'zh' | 'en') {
  return locale === 'en' ? business.split(/,\s*/u) : business.split('、');
}
