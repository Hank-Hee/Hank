import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from '../app-router';

const health = {
  status: 'ok', service: 'api', version: '0.1.0', timestamp: '2026-08-04T00:00:00.000Z',
};
const summary = {
  slug: 'shell', displayName: 'Shell', companyType: 'IOC', country: '英国',
  region: '北海/北欧', business: '综合油气、上游勘探开发、LNG',
  marketPosition: '全球综合能源公司', headquarters: '伦敦，英国',
  projectCount: 552, countryCount: 32,
  dataCoverage: 'complete',
};
const detail = {
  ...summary,
  sourceId: '6a1e90aa11f1cb641ce4fe1a', website: 'https://www.shell.com/', foundedYear: 1890,
  businessRegions: ['北海/北欧'],
  dashboards: {
    map: '/company-assets/maps/index.html?operator=Shell',
    projectType: '/company-assets/charts/project-type/index.html?operator=Shell',
    production: '/company-assets/production/shell.html',
    financial: '/company-assets/financial/shell.html',
  },
  relatedInformation: [{
    id: 'esg-disclosure-oil-gas', kind: 'report', title: '油气企业 ESG 披露与转型指标比较',
    summary: '比较国际油气公司的披露指标。', sourceName: 'Energy Institute',
    publishedOn: '2026-06-30', sourceFormat: 'PDF', attachmentAvailable: false,
  }],
  newsStatus: 'not-provided',
};

function renderRoute(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

afterEach(cleanup);

describe('company library UI', () => {
  it('requires an email entry and opens the company list in local demo mode', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/v1/demo/session') {
        return new Response(JSON.stringify({ accessToken: 'demo.local', email: 'reader@example.com' }));
      }
      if (url === '/api/v1/health') return new Response(JSON.stringify(health));
      if (url === '/api/v1/companies') return new Response(JSON.stringify({ companies: [summary] }));
      return new Response(null, { status: 404 });
    }));
    renderRoute('/companies');

    expect(await screen.findByRole('heading', { name: '邮箱登录' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('工作邮箱'), { target: { value: 'reader@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '进入内部 Demo' }));

    expect(await screen.findByRole('heading', { name: '公司信息库' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Shell' })).toHaveAttribute('href', '/companies/shell');
    expect(screen.getByRole('columnheader', { name: '公司名称' })).toBeInTheDocument();
    expect(screen.getByText('完整 Portfolio')).toBeInTheDocument();
    expect(sessionStorage.getItem('company-demo-token')).toBe('demo.local');
  });

  it('renders the company detail modules in the approved order', async () => {
    sessionStorage.setItem('company-demo-token', 'demo.local');
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/v1/health') return new Response(JSON.stringify(health));
      if (url === '/api/v1/companies/shell') return new Response(JSON.stringify(detail));
      return new Response(null, { status: 404 });
    }));
    renderRoute('/companies/shell');

    expect(await screen.findByRole('heading', { name: 'Shell' })).toBeInTheDocument();
    const dashboards = screen.getAllByTitle(/Shell/);
    expect(dashboards.map(({ title }) => title)).toEqual([
      'Shell 全球业务／项目分布',
      'Shell 项目类型结构',
      'Shell 区域产量趋势',
      'Shell 经营与财务表现',
    ]);
    expect(screen.getByRole('navigation', { name: '公司页面目录' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '经营与财务表现' })).toBeInTheDocument();
    expect(screen.getByText('油气企业 ESG 披露与转型指标比较')).toBeInTheDocument();
    expect(screen.getByText('暂无可追溯新闻数据')).toBeInTheDocument();
    expect(screen.getByText('附件未提供')).toBeInTheDocument();
  });
});
