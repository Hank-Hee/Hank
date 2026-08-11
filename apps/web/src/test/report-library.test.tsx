import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from '../app-router';

const report = {
  id: 'lng-middle-east-2026',
  title: '中东 LNG 供需与项目扩张展望 2026',
  subtitle: 'Middle East LNG Supply, Demand and Project Outlook 2026',
  summary: '梳理卡塔尔、阿联酋和阿曼 LNG 扩建项目。',
  industry: 'LNG',
  region: '中东',
  informationType: '行业研究报告',
  sourceFamily: '行业研究',
  publisher: 'Rystad Energy',
  publishedOn: '2026-07-22',
  language: '中英',
  sourceFormat: 'PDF',
  attachmentAvailable: false,
  keywords: ['LNG', '扩建'],
  relatedCompanies: [{ slug: 'adnoc', displayName: 'ADNOC' }],
  detailStatus: 'metadata-only',
};

const secondReport = {
  ...report,
  id: 'global-gas-2026',
  title: '全球天然气市场展望 2026',
  subtitle: 'Global Gas Market Outlook 2026',
  region: '全球',
};

const archivedReport = {
  ...report,
  id: 'middle-east-lng-archive-2026',
  attachmentAvailable: true,
  attachmentCount: 2,
  coverUrl: '/api/v1/reports/middle-east-lng-archive-2026/cover',
  detailStatus: 'attachment-available',
  attachments: [
    {
      id: '0123456789abcdef01234567',
      fileName: 'Middle East LNG Outlook 2026.pdf',
      mimeType: 'application/pdf',
      byteSize: 2_621_440,
      downloadUrl: '/api/v1/reports/middle-east-lng-archive-2026/attachments/0123456789abcdef01234567',
    },
    {
      id: '89abcdef0123456701234567',
      fileName: '中东LNG数据.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      byteSize: 524_288,
      downloadUrl: '/api/v1/reports/middle-east-lng-archive-2026/attachments/89abcdef0123456701234567',
    },
  ],
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
  sessionStorage.setItem('company-demo-token', 'demo.local');
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/v1/reports?')) {
      const query = new URL(url, 'https://local.test').searchParams;
      const rows = query.get('q') === '不存在' ? [] : [report, secondReport];
      return new Response(JSON.stringify({
        reports: rows,
        syncedOn: '2026-08-07',
        total: rows.length,
        page: Number(query.get('page') ?? 1),
        pageSize: Number(query.get('pageSize') ?? 50),
        facets: {
          industries: ['LNG'], regions: ['中东'], informationTypes: ['行业研究报告'],
          sourceFamilies: ['行业研究'], publishers: ['Rystad Energy'],
        },
      }));
    }
    if (url === `/api/v1/reports/${report.id}`) return new Response(JSON.stringify(report));
    if (url === `/api/v1/reports/${archivedReport.id}`) return new Response(JSON.stringify(archivedReport));
    if (url === '/api/v1/companies') return new Response(JSON.stringify({ companies: [] }));
    return new Response(JSON.stringify({ status: 'ok', service: 'api', version: '0.1.0', timestamp: '2026-08-04T00:00:00.000Z' }));
  }));
});

afterEach(cleanup);

describe('report archive UI', () => {
  it('shows the approved homepage archive statistics and latest successful sync date', async () => {
    renderRoute('/');
    expect(await screen.findByRole('heading', { name: '快速定位公司档案与行业研究资料' })).toBeInTheDocument();
    expect(screen.queryByText(/Portfolio/)).not.toBeInTheDocument();
    expect(screen.getByText('内部知识平台')).toBeInTheDocument();
    expect(screen.getByText('仅限授权员工访问')).toBeInTheDocument();
    expect(await screen.findByText('已归档公司')).toBeInTheDocument();
    expect(screen.getByText('行业报告与资料')).toBeInTheDocument();
    expect(screen.getByText('最近一次更新')).toBeInTheDocument();
    expect(await screen.findByText('2026/8/7')).toBeInTheDocument();
    expect(screen.queryByText('完整 Portfolio')).not.toBeInTheDocument();
    expect(screen.queryByText('报告元数据')).not.toBeInTheDocument();
  });

  it('localizes the professional internal-use notice in English', async () => {
    localStorage.setItem('wison-locale', 'en');
    renderRoute('/');

    expect(await screen.findByRole('heading', { name: 'Find company profiles and industry research' })).toBeInTheDocument();
    expect(screen.getByText('Internal Knowledge Platform')).toBeInTheDocument();
    expect(screen.getByText('Authorized employees only')).toBeInTheDocument();
  });

  it('finds traceable report metadata from the global search entry', async () => {
    renderRoute('/');
    const search = await screen.findByRole('searchbox', { name: '全站搜索' });
    fireEvent.change(search, { target: { value: '中东 LNG' } });
    expect(await screen.findByRole('link', { name: /报告中东 LNG 供需与项目扩张展望 2026/ }))
      .toHaveAttribute('href', `/reports/${report.id}`);
  });

  it('filters the high-density report archive and links to metadata detail', async () => {
    renderRoute('/reports');
    expect(await screen.findByRole('heading', { name: '行业报告库' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: report.title })).toHaveAttribute(
      'href', `/reports/${report.id}`,
    );
    fireEvent.change(screen.getByLabelText('报告检索'), { target: { value: '不存在' } });
    expect(await screen.findByText('没有符合条件的报告')).toBeInTheDocument();
  });

  it('shows only traceable metadata and an explicit unavailable attachment state', async () => {
    renderRoute(`/reports/${report.id}`);
    expect(await screen.findByRole('heading', { name: report.title })).toBeInTheDocument();
    expect(screen.getByText(report.summary)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ADNOC' })).toHaveAttribute('href', '/companies/adnoc');
    expect(screen.getByText('附件未上传')).toBeInTheDocument();
    expect(screen.getByText(/未提供研究结论与目录/)).toBeInTheDocument();
    expect(screen.getByText('发布机构')).toBeInTheDocument();
    expect(screen.queryByText('来源')).not.toBeInTheDocument();
  });

  it('shows no original Chinese report fields in English mode', async () => {
    localStorage.setItem('wison-locale', 'en');
    renderRoute(`/reports/${report.id}`);

    expect(await screen.findByRole('heading', { name: report.subtitle })).toBeInTheDocument();
    expect(screen.getByText('The source table did not include a summary; only the title and verifiable metadata are archived.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/u);
  });

  it('renders archived covers and every downloadable attachment through controlled API routes', async () => {
    renderRoute(`/reports/${archivedReport.id}`);

    expect(await screen.findByRole('heading', { name: archivedReport.title })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: `${archivedReport.title} 封面` }))
      .toHaveAttribute('src', archivedReport.coverUrl);
    expect(screen.getByRole('link', { name: /Middle East LNG Outlook 2026\.pdf/ }))
      .toHaveAttribute('href', archivedReport.attachments[0]!.downloadUrl);
    expect(screen.getByRole('link', { name: /中东LNG数据\.xlsx/ }))
      .toHaveAttribute('href', archivedReport.attachments[1]!.downloadUrl);
  });

  it('keeps localized attachment labels free of Chinese in English mode', async () => {
    localStorage.setItem('wison-locale', 'en');
    renderRoute(`/reports/${archivedReport.id}`);

    expect(await screen.findByRole('heading', { name: archivedReport.subtitle })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Middle East LNG Supply, Demand and Project Outlook 2026 \(2\)\.xlsx/ })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[\u3400-\u9fff]/u);
  });

  it('persists favorites and recent views locally, then exposes both workflows on the homepage', async () => {
    renderRoute(`/reports/${report.id}`);
    expect(await screen.findByRole('heading', { name: report.title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '收藏报告' }));

    cleanup();
    renderRoute('/');
    expect(await screen.findByRole('heading', { name: '最近浏览' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '收藏报告' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: report.title })).toHaveLength(2);
  });

  it('shows only locally favorited reports when the favorites filter is enabled', async () => {
    localStorage.setItem('wison-report-workspace-v1', JSON.stringify({
      schemaVersion: 1,
      favorites: [report],
      recent: [],
    }));
    renderRoute('/reports');
    expect(await screen.findByRole('link', { name: secondReport.title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '仅看收藏' }));
    expect(screen.getByRole('link', { name: report.title })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: secondReport.title })).not.toBeInTheDocument();
  });
});
