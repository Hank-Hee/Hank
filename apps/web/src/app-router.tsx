import { useQuery } from '@tanstack/react-query';
import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from '@tanstack/react-router';
import type { CompanySummary, ReportSummary } from '@wison/contracts';
import { type FormEvent, type KeyboardEvent, useMemo, useRef, useState } from 'react';
import { HealthBadge } from './components/health-badge';
import {
  createDemoSession,
  getCompanies,
  getCompany,
  getReport,
  getReports,
} from './lib/api-client';
import { clearDemoToken, getDemoToken, setDemoToken } from './lib/demo-session';

const navigation = [
  ['/', '首页', '⌂'],
  ['/companies', '公司信息库', '▦'],
  ['/reports', '行业报告库', '▤'],
] as const;

const coverageLabels = {
  complete: '完整 Portfolio',
  projects: '项目数据',
  profile: '公司档案',
} as const;

function useCatalog() {
  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: ({ signal }) => getCompanies(signal),
  });
  const reports = useQuery({
    queryKey: ['reports'],
    queryFn: ({ signal }) => getReports(signal),
  });
  return { companies, reports };
}

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
      <section className="login-brand">
        <p className="eyebrow">MARKET KNOWLEDGE PLATFORM</p>
        <h1>惠生清能市场知识平台</h1>
        <p>连接公司档案、项目组合与行业研究资料的内部市场知识入口。</p>
      </section>
      <section className="login-card">
        <p className="eyebrow">INTERNAL ACCESS</p>
        <h2>邮箱登录</h2>
        <p>首期面向内部测试用户开放只读访问。</p>
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

type SearchResult =
  | { kind: 'company'; key: string; label: string; secondary: string; slug: string }
  | { kind: 'report'; key: string; label: string; secondary: string; reportId: string };

function GlobalSearch({
  companies,
  reports,
  variant = 'top',
}: {
  companies: CompanySummary[];
  reports: ReportSummary[];
  variant?: 'top' | 'hero';
}) {
  const [term, setTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const normalized = term.trim().toLocaleLowerCase();
  const results = useMemo<SearchResult[]>(() => {
    if (!normalized) return [];
    const companyResults: SearchResult[] = companies
      .filter((company) => [
        company.displayName,
        company.companyType,
        company.country,
        company.region,
        company.business,
        company.marketPosition,
      ].some((value) => value.toLocaleLowerCase().includes(normalized)))
      .slice(0, 6)
      .map((company) => ({
        kind: 'company',
        key: `company-${company.slug}`,
        label: company.displayName,
        secondary: `${company.companyType} · ${company.country}`,
        slug: company.slug,
      }));
    const reportResults: SearchResult[] = reports
      .filter((report) => [
        report.title,
        report.subtitle ?? '',
        report.summary,
        report.industry,
        report.region,
        report.sourceName,
        ...report.keywords,
      ].some((value) => value.toLocaleLowerCase().includes(normalized)))
      .slice(0, 6)
      .map((report) => ({
        kind: 'report',
        key: `report-${report.id}`,
        label: report.title,
        secondary: `${report.industry} · ${report.sourceName}`,
        reportId: report.id,
      }));
    return [...companyResults, ...reportResults];
  }, [companies, normalized, reports]);

  function handleKeyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((value) => (value + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((value) => (value - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      linkRefs.current[activeIndex]?.click();
    } else if (event.key === 'Escape') {
      setTerm('');
    }
  }

  return (
    <div className={`global-search global-search--${variant}`}>
      <span className="search-icon" aria-hidden="true">⌕</span>
      <input
        aria-label={variant === 'top' ? '全站搜索' : '首页检索'}
        type="search"
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyboard}
        placeholder="搜索公司、公司别名、行业、报告标题、新闻或关键词……"
      />
      {term ? <button type="button" aria-label="清除搜索" onClick={() => setTerm('')}>×</button> : null}
      {normalized ? (
        <div className="search-results" role="listbox" aria-label="搜索结果">
          {results.length ? results.map((result, index) => (
            <div className="search-result-block" key={result.key}>
              {index === 0 || results[index - 1]?.kind !== result.kind ? (
                <div className="search-group-heading">{result.kind === 'company' ? '公司' : '报告'}</div>
              ) : null}
              {result.kind === 'company' ? (
              <Link
                ref={(element) => { linkRefs.current[index] = element; }}
                className={index === activeIndex ? 'is-active' : ''}
                to="/companies/$slug"
                params={{ slug: result.slug }}
                onClick={() => setTerm('')}
              >
                <span><small>公司</small>{result.label}</span><em>{result.secondary}</em>
              </Link>
            ) : (
              <Link
                ref={(element) => { linkRefs.current[index] = element; }}
                className={index === activeIndex ? 'is-active' : ''}
                to="/reports/$reportId"
                params={{ reportId: result.reportId }}
                onClick={() => setTerm('')}
              >
                <span><small>报告</small>{result.label}</span><em>{result.secondary}</em>
              </Link>
              )}
            </div>
          )) : <p>未找到匹配的公司或报告</p>}
          <footer>↑ ↓ 选择 · Enter 打开 · Esc 关闭</footer>
        </div>
      ) : null}
    </div>
  );
}

function AppShell() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(getDemoToken()));
  const [menuOpen, setMenuOpen] = useState(false);
  const catalog = useCatalog();
  if (!authenticated) return <LoginPage onAuthenticated={() => setAuthenticated(true)} />;

  const companies = catalog.companies.data?.companies ?? [];
  const reports = catalog.reports.data?.reports ?? [];
  return (
    <div className="app-shell">
      <aside className={menuOpen ? 'sidebar is-open' : 'sidebar'}>
        <div className="brand-block">
          <p>惠生清能</p>
          <h1>惠生清能市场知识平台</h1>
          <span>MARKET KNOWLEDGE PLATFORM</span>
        </div>
        <nav aria-label="主导航" className="primary-nav">
          {navigation.map(([to, label, icon]) => (
            <Link key={to} to={to} activeProps={{ 'aria-current': 'page' }} onClick={() => setMenuOpen(false)}>
              <i aria-hidden="true">{icon}</i><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>内部只读 Demo</span>
          <small>数据来自仓库可追溯资料</small>
        </div>
      </aside>
      {menuOpen ? <button className="sidebar-scrim" aria-label="关闭导航" onClick={() => setMenuOpen(false)} /> : null}
      <div className="workspace">
        <header className="topbar">
          <button className="menu-button" type="button" aria-label="打开导航" onClick={() => setMenuOpen(true)}>☰</button>
          <GlobalSearch companies={companies} reports={reports} />
          <div className="topbar-actions">
            <HealthBadge />
            <button
              className="text-button"
              type="button"
              onClick={() => {
                clearDemoToken();
                setAuthenticated(false);
              }}
            >退出</button>
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}

function HomePage() {
  const { companies, reports } = useCatalog();
  const companyRows = companies.data?.companies ?? [];
  const reportRows = reports.data?.reports ?? [];
  const complete = companyRows.filter(({ dataCoverage }) => dataCoverage === 'complete');
  return (
    <div className="home-page">
      <section className="home-hero">
        <p className="eyebrow">MARKET INTELLIGENCE REFERENCE</p>
        <h2>快速定位公司档案、Portfolio 与行业研究资料</h2>
        <p>面向内部市场研究人员的统一检索入口，连接公司基础信息、项目组合、相关新闻与行业报告。</p>
        <GlobalSearch companies={companyRows} reports={reportRows} variant="hero" />
      </section>
      <section className="library-cards" aria-label="知识库入口">
        <Link to="/companies">
          <span className="library-icon">▦</span>
          <div><small>COMPANY DIRECTORY</small><h3>公司信息库</h3><p>检索公司档案、区域项目、产量和财务信息。</p></div>
          <b>进入 →</b>
        </Link>
        <Link to="/reports">
          <span className="library-icon">▤</span>
          <div><small>RESEARCH ARCHIVE</small><h3>行业报告库</h3><p>按行业、区域、来源和关联公司定位研究资料。</p></div>
          <b>进入 →</b>
        </Link>
      </section>
      <section className="stats-strip" aria-label="资料统计">
        <div><strong>{companyRows.length}</strong><span>公司档案</span></div>
        <div><strong>{reportRows.length}</strong><span>报告元数据</span></div>
        <div><strong>{complete.length}</strong><span>完整 Portfolio</span></div>
      </section>
      <div className="home-columns">
        <section className="content-panel compact-panel">
          <header><div><p className="eyebrow">FOCUS COMPANIES</p><h3>重点公司</h3></div><Link to="/companies">查看全部</Link></header>
          {companies.isPending ? <p className="state-message">公司数据加载中…</p> : null}
          {complete.slice(0, 6).map((company) => (
            <Link className="compact-row" key={company.slug} to="/companies/$slug" params={{ slug: company.slug }}>
              <span className="initial-badge">{company.displayName.slice(0, 2).toUpperCase()}</span>
              <span><b>{company.displayName}</b><small>{company.companyType} · {company.country}</small></span>
              <em>{company.projectCount} 个项目</em>
            </Link>
          ))}
        </section>
        <section className="content-panel compact-panel">
          <header><div><p className="eyebrow">LATEST RESEARCH</p><h3>最新报告</h3></div><Link to="/reports">查看全部</Link></header>
          {reports.isPending ? <p className="state-message">报告数据加载中…</p> : null}
          {reportRows.slice(0, 5).map((report) => (
            <Link className="compact-row" key={report.id} to="/reports/$reportId" params={{ reportId: report.id }}>
              <span className="date-badge">{report.publishedOn.slice(5)}</span>
              <span><b>{report.title}</b><small>{report.industry} · {report.sourceName}</small></span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}

function CompanyListPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [region, setRegion] = useState('');
  const [business, setBusiness] = useState('');
  const [listed, setListed] = useState('');
  const query = useQuery({ queryKey: ['companies'], queryFn: ({ signal }) => getCompanies(signal) });
  const companies = query.data?.companies ?? [];
  const types = [...new Set(companies.map((company) => company.companyType))].sort();
  const regions = [...new Set(companies.map((company) => company.region))].sort();
  const businesses = [...new Set(companies.map((company) => company.business.split('、')[0] ?? company.business))].sort();
  const filteredCompanies = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return companies.filter((company) => (
      (!term || [company.displayName, company.country, company.business, company.region]
        .some((value) => value.toLocaleLowerCase().includes(term)))
      && (!type || company.companyType === type)
      && (!region || company.region === region)
      && (!business || company.business.includes(business))
      && (!listed || listed === 'not-provided')
    ));
  }, [business, companies, listed, region, search, type]);
  const clearFilters = () => { setSearch(''); setType(''); setRegion(''); setBusiness(''); setListed(''); };

  return (
    <section>
      <div className="page-heading">
        <div><p className="eyebrow">COMPANY DIRECTORY</p><h2>公司信息库</h2><p>按公司名称、类型、地区和业务领域检索标准化公司档案。</p></div>
        <span className="record-count">{filteredCompanies.length} / {companies.length} 家公司</span>
      </div>
      <div className="filter-panel company-filters">
        <label><span>公司名称、英文名、简称</span><input aria-label="公司检索" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="输入公司名称" /></label>
        <label><span>公司类型</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="">全部类型</option>{types.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>国家／地区</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option value="">全部地区</option>{regions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>业务领域</span><select value={business} onChange={(event) => setBusiness(event.target.value)}><option value="">全部业务</option>{businesses.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>上市状态</span><select value={listed} onChange={(event) => setListed(event.target.value)}><option value="">全部状态</option><option value="not-provided">未标注</option></select></label>
        <button type="button" onClick={clearFilters}>清除筛选</button>
      </div>
      {query.isPending ? <p className="state-message">公司数据加载中…</p> : null}
      {query.isError ? <p className="state-message state-message--error">公司数据暂时无法加载。</p> : null}
      {query.isSuccess ? (
        <div className="data-table-wrap">
          <table className="data-table company-table">
            <thead><tr><th>公司名称</th><th>类型</th><th>总部地区</th><th>业务领域</th><th>上市状态</th><th>资料更新时间</th></tr></thead>
            <tbody>{filteredCompanies.map((company) => (
              <tr key={company.slug}>
                <td><Link to="/companies/$slug" params={{ slug: company.slug }}>{company.displayName}</Link><small>{company.marketPosition}</small><span className={`coverage coverage--${company.dataCoverage}`}>{coverageLabels[company.dataCoverage]}</span></td>
                <td><span className="type-chip">{company.companyType}</span></td>
                <td>{company.headquarters}<small>{company.region}</small></td>
                <td>{company.business}</td>
                <td><span className="muted-tag">未标注</span></td>
                <td>源文件未标注</td>
              </tr>
            ))}</tbody>
          </table>
          {!filteredCompanies.length ? <p className="empty-state">没有符合条件的公司</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function DashboardFrame({ src, title, className = '' }: { src: string; title: string; className?: string }) {
  return <iframe className={`dashboard-frame ${className}`} src={src} title={title} loading="lazy" />;
}

function MissingModule({ children }: { children: string }) {
  return <div className="module-missing"><span>资料待补充</span><p>{children}</p></div>;
}

function CompanyDetailPage() {
  const { slug } = companyDetailRoute.useParams();
  const query = useQuery({ queryKey: ['company', slug], queryFn: ({ signal }) => getCompany(slug, signal) });
  if (query.isPending) return <p className="state-message">公司档案加载中…</p>;
  if (query.isError) return <p className="state-message state-message--error">公司档案暂时无法加载。</p>;
  const company = query.data;
  const reports = company.relatedInformation.filter((item) => item.kind === 'report');
  const news = company.relatedInformation.filter((item) => item.kind === 'news');
  return (
    <article className="company-detail">
      <nav className="breadcrumb" aria-label="面包屑"><Link to="/companies">公司信息库</Link><span>/</span><span>{company.displayName}</span></nav>
      <header className="company-banner">
        <span className="company-mark">{company.displayName.slice(0, 2).toUpperCase()}</span>
        <div><span className="banner-kicker">COMPANY PORTFOLIO</span><h2>{company.displayName}</h2><p>{company.marketPosition}</p><div className="banner-tags"><span>{company.companyType}</span><span>{company.country}</span><span>{coverageLabels[company.dataCoverage]}</span></div></div>
        <dl><div><dt>项目数量</dt><dd>{company.projectCount || '未提供'}</dd></div><div><dt>覆盖国家</dt><dd>{company.countryCount || '未提供'}</dd></div><div><dt>资料来源</dt><dd>仓库归档</dd></div></dl>
      </header>
      <nav className="company-anchor-nav" aria-label="公司页面目录">
        <a href="#overview">公司概览</a><a href="#projects">区域与项目</a><a href="#production">产量</a><a href="#financials">财务</a><a href="#news">相关新闻</a><a href="#related-reports">相关报告</a>
      </nav>
      <section id="overview" className="content-panel company-profile">
        <div><p className="eyebrow">COMPANY OVERVIEW</p><h3>公司概览</h3><p className="lead">{company.marketPosition}</p><p>{company.business}</p></div>
        <dl className="profile-facts">
          <div><dt>总部</dt><dd>{company.headquarters}</dd></div><div><dt>成立年份</dt><dd>{company.foundedYear}</dd></div><div><dt>业务区域</dt><dd>{company.businessRegions.join('、')}</dd></div><div><dt>官网</dt><dd><a href={company.website} target="_blank" rel="noreferrer">访问官网 ↗</a></dd></div>
        </dl>
      </section>
      <section id="projects" className="portfolio-section">
        <div className="section-heading"><p className="eyebrow">REGIONS & PROJECTS</p><h3>区域与项目</h3></div>
        {company.dashboards.map && company.dashboards.projectType ? (
          <div className="analysis-grid">
            <div className="dashboard-card dashboard-card--map"><h4>全球业务／项目分布</h4><DashboardFrame className="dashboard-frame--map" src={company.dashboards.map} title={`${company.displayName} 全球业务／项目分布`} /></div>
            <div className="dashboard-card"><h4>项目类型结构</h4><DashboardFrame src={company.dashboards.projectType} title={`${company.displayName} 项目类型结构`} /></div>
          </div>
        ) : <MissingModule>仓库尚未提供该公司的项目分布与项目类型数据。</MissingModule>}
      </section>
      <section id="production" className="portfolio-section">
        <div className="section-heading"><p className="eyebrow">PRODUCTION</p><h3>区域产量趋势</h3></div>
        {company.dashboards.production ? <div className="dashboard-card"><DashboardFrame src={company.dashboards.production} title={`${company.displayName} 区域产量趋势`} /></div> : <MissingModule>仓库尚未提供该公司的产量数据。</MissingModule>}
      </section>
      <section id="financials" className="portfolio-section">
        <div className="section-heading"><p className="eyebrow">FINANCIALS</p><h3>经营与财务表现</h3></div>
        {company.dashboards.financial ? <div className="dashboard-card"><DashboardFrame className="dashboard-frame--financial" src={company.dashboards.financial} title={`${company.displayName} 经营与财务表现`} /></div> : <MissingModule>仓库尚未提供该公司的财务数据。</MissingModule>}
      </section>
      <section id="news" className="content-panel information-panel">
        <p className="eyebrow">COMPANY NEWS</p><h3>相关新闻</h3>
        {news.length ? news.map((item) => <p key={item.id}>{item.title}</p>) : <p className="empty-state">暂无可追溯新闻数据</p>}
      </section>
      <section id="related-reports" className="content-panel information-panel">
        <p className="eyebrow">RELATED RESEARCH</p><h3>相关报告</h3>
        {reports.length ? <div className="information-list">{reports.map((item) => (
          <article key={item.id}><div><span className="source-tag">{item.sourceFormat}</span><time>{item.publishedOn}</time></div><h4><Link to="/reports/$reportId" params={{ reportId: item.id }}>{item.title}</Link></h4><p>{item.summary}</p><small>{item.sourceName}</small>{!item.attachmentAvailable ? <span className="unavailable-tag">附件未提供</span> : null}</article>
        ))}</div> : <p className="empty-state">暂无可追溯行业报告数据</p>}
      </section>
    </article>
  );
}

function ReportsPage() {
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [type, setType] = useState('');
  const [source, setSource] = useState('');
  const query = useQuery({ queryKey: ['reports'], queryFn: ({ signal }) => getReports(signal) });
  const reports = query.data?.reports ?? [];
  const values = (key: 'industry' | 'region' | 'informationType' | 'sourceName') => [...new Set(reports.map((report) => report[key]))].sort();
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return reports.filter((report) => (
      (!term || [report.title, report.subtitle ?? '', report.summary, ...report.keywords, ...report.relatedCompanies.map(({ displayName }) => displayName)].some((value) => value.toLocaleLowerCase().includes(term)))
      && (!industry || report.industry === industry) && (!region || report.region === region)
      && (!type || report.informationType === type) && (!source || report.sourceName === source)
    ));
  }, [industry, region, reports, search, source, type]);
  const clearFilters = () => { setSearch(''); setIndustry(''); setRegion(''); setType(''); setSource(''); };
  return (
    <section>
      <div className="page-heading"><div><p className="eyebrow">RESEARCH ARCHIVE</p><h2>行业报告库</h2><p>按标题、摘要、行业、区域、来源及关联公司检索已归档研究资料。</p></div><span className="record-count">{filtered.length} / {reports.length} 条报告</span></div>
      <div className="filter-panel report-filters">
        <label><span>标题、摘要、关键词、公司</span><input aria-label="报告检索" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="输入检索词" /></label>
        <label><span>行业</span><select value={industry} onChange={(event) => setIndustry(event.target.value)}><option value="">全部行业</option>{values('industry').map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>区域</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option value="">全部区域</option>{values('region').map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>报告类型</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="">全部类型</option>{values('informationType').map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>来源</span><select value={source} onChange={(event) => setSource(event.target.value)}><option value="">全部来源</option>{values('sourceName').map((value) => <option key={value}>{value}</option>)}</select></label>
        <button type="button" onClick={clearFilters}>清除筛选</button>
      </div>
      {query.isPending ? <p className="state-message">报告数据加载中…</p> : null}
      {query.isError ? <p className="state-message state-message--error">报告数据暂时无法加载。</p> : null}
      {query.isSuccess ? <div className="report-list">{filtered.map((report) => (
        <article key={report.id}><time>{report.publishedOn}</time><div><div className="report-tags"><span>{report.industry}</span><span>{report.region}</span><span>{report.informationType}</span></div><h3><Link to="/reports/$reportId" params={{ reportId: report.id }}>{report.title}</Link></h3>{report.subtitle ? <p className="report-subtitle">{report.subtitle}</p> : null}<p>{report.summary}</p><footer><span>{report.sourceName}</span><span>{report.sourceFormat}</span><span>{report.relatedCompanies.map(({ displayName }) => displayName).join('、') || '未关联公司'}</span>{!report.attachmentAvailable ? <span className="unavailable-tag">附件未上传</span> : <span className="available-tag">附件已归档</span>}</footer></div></article>
      ))}{!filtered.length ? <p className="empty-state">没有符合条件的报告</p> : null}</div> : null}
    </section>
  );
}

function ReportDetailPage() {
  const { reportId } = reportDetailRoute.useParams();
  const query = useQuery({ queryKey: ['report', reportId], queryFn: ({ signal }) => getReport(reportId, signal) });
  if (query.isPending) return <p className="state-message">报告资料加载中…</p>;
  if (query.isError) return <p className="state-message state-message--error">报告资料暂时无法加载。</p>;
  const report = query.data;
  return (
    <article className="report-detail">
      <nav className="breadcrumb" aria-label="面包屑"><Link to="/reports">行业报告库</Link><span>/</span><span>{report.title}</span></nav>
      <header className="report-cover"><div><p className="eyebrow">RESEARCH ARCHIVE</p><h2>{report.title}</h2>{report.subtitle ? <p>{report.subtitle}</p> : null}</div><span>{report.sourceFormat}</span></header>
      <div className="report-detail-grid">
        <div>
          <section className="content-panel"><p className="eyebrow">EXECUTIVE SUMMARY</p><h3>报告摘要</h3><p className="lead">{report.summary}</p></section>
          <section className="content-panel unavailable-detail"><p className="eyebrow">ARCHIVE COVERAGE</p><h3>资料完整性</h3><p>当前仓库仅提供可追溯的报告摘要与归档元数据，未提供研究结论与目录，也未上传原始附件。</p>{!report.attachmentAvailable ? <span className="unavailable-tag">附件未上传</span> : <span className="available-tag">附件已归档</span>}</section>
        </div>
        <aside className="content-panel report-meta"><h3>归档信息</h3><dl><div><dt>行业</dt><dd>{report.industry}</dd></div><div><dt>区域</dt><dd>{report.region}</dd></div><div><dt>类型</dt><dd>{report.informationType}</dd></div><div><dt>来源</dt><dd>{report.sourceName}</dd></div><div><dt>发布日期</dt><dd>{report.publishedOn}</dd></div><div><dt>语言</dt><dd>{report.language}</dd></div><div><dt>格式</dt><dd>{report.sourceFormat}</dd></div></dl><h4>关联公司</h4><div className="related-companies">{report.relatedCompanies.length ? report.relatedCompanies.map((company) => <Link key={company.slug} to="/companies/$slug" params={{ slug: company.slug }}>{company.displayName}</Link>) : <span>未关联公司</span>}</div><h4>关键词</h4><div className="keyword-list">{report.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div></aside>
      </div>
    </article>
  );
}

function AdminDeniedPage() { return <section><h2>无权访问</h2><p>当前 Demo 仅开放只读浏览权限。</p></section>; }

const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage });
const companiesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/companies', component: CompanyListPage });
const companyDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/companies/$slug', component: CompanyDetailPage });
const reportsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reports', component: ReportsPage });
const reportDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reports/$reportId', component: ReportDetailPage });
const adminRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: AdminDeniedPage });
const routeTree = rootRoute.addChildren([indexRoute, companiesRoute, companyDetailRoute, reportsRoute, reportDetailRoute, adminRoute]);

export function createAppRouter(history?: RouterHistory) { return createRouter({ routeTree, history }); }
export const router = createAppRouter();
declare module '@tanstack/react-router' { interface Register { router: typeof router; } }
