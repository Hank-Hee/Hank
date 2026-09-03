import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from '@tanstack/react-router';
import { HealthBadge } from './components/health-badge';

const navigation = [
  ['/', '首页'],
  ['/companies', '公司信息库'],
  ['/reports', '行业报告库'],
] as const;

function AppShell() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Wison Internal</p>
          <h1>市场知识平台</h1>
        </div>
        <HealthBadge />
      </header>
      <div className="app-body">
        <nav aria-label="主导航" className="primary-nav">
          {navigation.map(([to, label]) => (
            <Link key={to} to={to} activeProps={{ 'aria-current': 'page' }}>
              {label}
            </Link>
          ))}
        </nav>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function HomePage() {
  return (
    <section>
      <h2>内部油气行业知识入口</h2>
      <p>公司信息库和行业报告库将在后续独立计划中接入正式数据。</p>
    </section>
  );
}

function SectionPage({ title }: { title: string }) {
  return (
    <section>
      <h2>{title}</h2>
      <p>基础路由已建立，领域功能不在本阶段实现。</p>
    </section>
  );
}

function AdminDeniedPage() {
  return (
    <section>
      <h2>无权访问</h2>
      <p>管理中心入口只会在后续身份 Task 确认显式管理权限后显示。</p>
    </section>
  );
}

const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage });
const companiesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/companies', component: () => <SectionPage title="公司信息库" /> });
const reportsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reports', component: () => <SectionPage title="行业报告库" /> });
const adminRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: AdminDeniedPage });

const routeTree = rootRoute.addChildren([
  indexRoute,
  companiesRoute,
  reportsRoute,
  adminRoute,
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
