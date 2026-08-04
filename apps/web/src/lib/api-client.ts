import {
  CompanyDetailSchema,
  CompanyListResponseSchema,
  DemoSessionResponseSchema,
  HealthResponseSchema,
  ReportDetailSchema,
  ReportListResponseSchema,
  type CompanyDetail,
  type CompanyListResponse,
  type DemoSessionResponse,
  type HealthResponse,
  type ReportDetail,
  type ReportListResponse,
} from '@wison/contracts';
import { getDemoToken } from './demo-session';

export async function getApiHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/v1/health', {
    headers: { accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`);
  }

  return HealthResponseSchema.parse(await response.json());
}

async function getAuthenticatedJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const token = getDemoToken();
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json();
}

export async function createDemoSession(email: string): Promise<DemoSessionResponse> {
  const response = await fetch('/api/v1/demo/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(`Demo session request failed with status ${response.status}`);
  }

  return DemoSessionResponseSchema.parse(await response.json());
}

export async function getCompanies(signal?: AbortSignal): Promise<CompanyListResponse> {
  return CompanyListResponseSchema.parse(await getAuthenticatedJson('/api/v1/companies', signal));
}

export async function getCompany(slug: string, signal?: AbortSignal): Promise<CompanyDetail> {
  return CompanyDetailSchema.parse(await getAuthenticatedJson(`/api/v1/companies/${slug}`, signal));
}

export async function getReports(signal?: AbortSignal): Promise<ReportListResponse> {
  return ReportListResponseSchema.parse(await getAuthenticatedJson('/api/v1/reports', signal));
}

export async function getReport(id: string, signal?: AbortSignal): Promise<ReportDetail> {
  return ReportDetailSchema.parse(await getAuthenticatedJson(`/api/v1/reports/${id}`, signal));
}
