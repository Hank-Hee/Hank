import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from '../app-router';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          service: 'api',
          version: '0.1.0',
          timestamp: '2026-07-30T12:00:00.000Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ),
  );
});

describe('application shell', () => {
  it('renders the internal platform navigation and API health', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }));

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: '惠生清能市场知识平台' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '邮箱登录' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '退出' })).not.toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: '主导航' });
    expect(within(navigation).getAllByRole('link')).toHaveLength(3);
    expect(within(navigation).getByRole('link', { name: '首页' })).toHaveAttribute('href', '/');
    expect(within(navigation).getByRole('link', { name: '公司信息库' })).toHaveAttribute('href', '/companies');
    expect(within(navigation).getByRole('link', { name: '行业报告库' })).toHaveAttribute('href', '/reports');
    expect(screen.queryByRole('link', { name: '管理中心' })).not.toBeInTheDocument();
    expect(await screen.findByText('API 正常')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '全站搜索' })).toHaveAttribute(
      'placeholder',
      '搜索公司、公司别名、行业、报告标题、新闻或关键词……',
    );
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/health',
      expect.objectContaining({ headers: { accept: 'application/json' } }),
    );
  });

  it('switches the full application chrome to English and remembers the preference', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }));
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: '选择语言' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'English' }));

    expect(screen.getByRole('heading', { name: 'Wison New Energies Market Knowledge Platform' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Company Library' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Industry Reports' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Site search' })).toHaveAttribute(
      'placeholder', 'Search companies, industries, reports, news, or keywords…',
    );
    expect(screen.queryByText('MARKET INTELLIGENCE REFERENCE')).not.toBeInTheDocument();
    expect(localStorage.getItem('wison-locale')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
