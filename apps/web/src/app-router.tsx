import { useQuery } from '@tanstack/react-query';
import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from '@tanstack/react-router';
import { type FormEvent, useMemo, useState } from 'react';
import { HealthBadge } from './components/health-badge';
import { createDemoSession, getCompanies, getCompany } from './lib/api-client';
import { clearDemoToken, getDemoToken, setDemoToken } from './lib/demo-session';

const navigation = [
  ['/', '首页'],
  ['/companies', '公司信息库'],
  ['/reports', '行业报告库'],
] as const;

function LoginPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const session = await createDemoSession(email);
      setDemoToken(session.accessToken);
      onAuthenticated();
    } catch {
      setError('登录失败，请检查邮箱格式或稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">Wison Internal Demo</p>
        <h1>邮箱登录</h1>
        <p>首期面向内部测试用户开放只读访问。请输入工作邮箱进入公司知识库。</p>
        <form onSubmit={submit}>
          <label htmlFor="demo-email">工作邮箱</label>
          <input
            id="demo-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            required
          />
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '正在进入…' : '进入内部 Demo'}
          </button>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}

function AppShell() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(getDemoToken()));
  if (!authenticated) return <LoginPage onAuthenticated={() => setAuthenticated(true)} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Wison Internal</p>
          <h1>市场知识平台</h1>
        </div>
        <div className="topbar-actions">
          <HealthBadge />
          <button
            className="text-button"
            type="button"
            onClick={() => {
              clearDemoToken();
              setAuthenticated(false);
            }}
          >
            退出
          </button>
        </div>
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
    <section className="intro-panel">
      <p className="eyebrow">Knowledge Hub</p>
      <h2>内部油气行业知识入口</h2>
      <p>首期 Demo 已接入 8 家重点公司的基础画像、项目分布、产量与财务看板。</p>
      <Link className="primary-action" to="/companies">进入公司信息库</Link>
    </section>
  );
}

function CompanyListPage() {
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['companies'],
    queryFn: ({ signal }) => getCompanies(signal),
  });
  const filteredCompanies = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return query.data?.companies ?? [];
    return (query.data?.companies ?? []).filter((company) =>
      [company.displayName, company.country, company.business, company.region]
        .some((value) => value.toLocaleLowerCase().includes(term)),
    );
  }, [query.data, search]);

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Company Intelligence</p>
          <h2>公司信息库</h2>
          <p>8 家重点油气企业的可追溯资料与交互看板。</p>
        </div>
        <label className="search-field">
          <span>筛选公司</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="公司、国家或业务" />
        </label>
      </div>
      {query.isPending ? <p className="state-message">公司数据加载中…</p> : null}
      {query.isError ? <p className="state-message state-message--error">公司数据暂时无法加载。</p> : null}
      {query.isSuccess ? (
        <div className="company-grid">
          {filteredCompanies.map((company) => (
            <Link
              className="company-card"
              key={company.slug}
              to="/companies/$slug"
              params={{ slug: company.slug }}
            >
              <div className="card-topline">
                <span className="company-type">{company.companyType}</span>
                <span>{company.country}</span>
              </div>
              <h3>{company.displayName}</h3>
              <p>{company.marketPosition}</p>
              <dl>
                <div><dt>项目</dt><dd>{company.projectCount}</dd></div>
                <div><dt>覆盖国家</dt><dd>{company.countryCount}</dd></div>
              </dl>
              <span className="card-link">查看公司画像 →</span>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DashboardFrame({ src, title, className = '' }: { src: string; title: string; className?: string }) {
  return <iframe className={`dashboard-frame ${className}`} src={src} title={title} loading="lazy" />;
}

function CompanyDetailPage() {
  const { slug } = companyDetailRoute.useParams();
  const query = useQuery({
    queryKey: ['company', slug],
    queryFn: ({ signal }) => getCompany(slug, signal),
  });

  if (query.isPending) return <p className="state-message">公司画像加载中…</p>;
  if (query.isError) return <p className="state-message state-message--error">公司画像暂时无法加载。</p>;

  const company = query.data;
  const reports = company.relatedInformation.filter((item) => item.kind === 'report');
  const news = company.relatedInformation.filter((item) => item.kind === 'news');

  return (
    <article className="company-detail">
      <Link className="back-link" to="/companies">← 返回公司信息库</Link>
      <h2>{company.displayName} 公司画像</h2>
      <DashboardFrame className="dashboard-frame--banner" src={company.dashboards.banner} title={`${company.displayName} Banner`} />

      <section className="content-panel company-profile">
        <div>
          <p className="eyebrow">Company Profile</p>
          <h3>公司简介</h3>
          <p className="lead">{company.marketPosition}</p>
          <p>{company.business}</p>
        </div>
        <dl className="profile-facts">
          <div><dt>总部</dt><dd>{company.headquarters}</dd></div>
          <div><dt>成立年份</dt><dd>{company.foundedYear}</dd></div>
          <div><dt>业务区域</dt><dd>{company.businessRegions.join('、')}</dd></div>
          <div><dt>官网</dt><dd><a href={company.website} target="_blank" rel="noreferrer">访问官网 ↗</a></dd></div>
        </dl>
      </section>

      <section className="dashboard-section">
        <div><p className="eyebrow">Projects</p><h3>项目分布地图</h3></div>
        <DashboardFrame className="dashboard-frame--map" src={company.dashboards.map} title={`${company.displayName} 项目分布地图`} />
      </section>
      <section className="dashboard-section">
        <div><p className="eyebrow">Portfolio</p><h3>项目类型结构</h3></div>
        <DashboardFrame src={company.dashboards.projectType} title={`${company.displayName} 项目类型结构`} />
      </section>
      <section className="dashboard-section">
        <div><p className="eyebrow">Production</p><h3>产量看板</h3></div>
        <DashboardFrame src={company.dashboards.production} title={`${company.displayName} 产量看板`} />
      </section>
      <section className="dashboard-section">
        <div><p className="eyebrow">Financials</p><h3>财务看板</h3></div>
        <DashboardFrame className="dashboard-frame--financial" src={company.dashboards.financial} title={`${company.displayName} 财务看板`} />
      </section>

      <section className="content-panel">
        <p className="eyebrow">Related Information</p>
        <h3>相关信息与行业报告</h3>
        {reports.length ? (
          <div className="information-list">
            {reports.map((item) => (
              <article key={item.id}>
                <div><span className="source-tag">{item.sourceFormat}</span><time>{item.publishedOn}</time></div>
                <h4>{item.title}</h4>
                <p>{item.summary}</p>
                <small>{item.sourceName}</small>
                {!item.attachmentAvailable ? <span className="unavailable-tag">附件未提供</span> : null}
              </article>
            ))}
          </div>
        ) : <p className="empty-state">暂无可追溯行业报告数据</p>}
      </section>

      <section className="content-panel">
        <p className="eyebrow">Company News</p>
        <h3>相关新闻</h3>
        {news.length ? news.map((item) => <p key={item.id}>{item.title}</p>) : (
          <p className="empty-state">暂无可追溯新闻数据</p>
        )}
      </section>
    </article>
  );
}

function ReportsPage() {
  return (
    <section className="intro-panel">
      <p className="eyebrow">Research Library</p>
      <h2>行业报告库</h2>
      <p>入口已保留。当前已关联报告元数据，报告附件尚未上传，后续将在完成文件治理后开放检索与预览。</p>
    </section>
  );
}

function AdminDeniedPage() {
  return <section><h2>无权访问</h2><p>当前 Demo 仅开放只读浏览权限。</p></section>;
}

const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage });
const companiesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/companies', component: CompanyListPage });
const companyDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/companies/$slug', component: CompanyDetailPage });
const reportsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reports', component: ReportsPage });
const adminRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: AdminDeniedPage });

const routeTree = rootRoute.addChildren([
  indexRoute,
  companiesRoute,
  companyDetailRoute,
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
