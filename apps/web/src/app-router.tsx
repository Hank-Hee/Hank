import { useQuery } from '@tanstack/react-query';
import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from '@tanstack/react-router';
import type { CompanySummary } from '@wison/contracts';
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { HealthBadge } from './components/health-badge';
import { businessSegments, localizeCompany } from './content-english';
import { I18nProvider, useI18n } from './i18n';
import {
  getCompanies,
  getCompany,
  getCompanyFidProjects,
  getCompanyInformation,
  getReport,
  getReports,
} from './lib/api-client';
import { useReportWorkspace } from './lib/report-workspace';

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

function useCompanies() {
  const companies = useQuery({
    queryKey: ['companies'],
    queryFn: ({ signal }) => getCompanies(signal),
    staleTime: 5 * 60_000,
  });
  return companies;
}

function useDebouncedValue(value: string, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);
  return debounced;
}

function formatArchiveDate(value: string | undefined) {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${year}/${Number(month)}/${Number(day)}` : value;
}

function formatFileSize(byteSize: number) {
  if (byteSize >= 1024 * 1024) return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(byteSize / 1024))} KB`;
}

function attachmentLabel(fileName: string, reportTitle: string, index: number, total: number, locale: 'zh' | 'en') {
  if (locale === 'zh') return fileName;
  const extension = fileName.match(/\.([A-Za-z0-9]{2,8})$/u)?.[1]?.toLocaleLowerCase('en-US');
  return `${reportTitle}${total > 1 ? ` (${index + 1})` : ''}${extension ? `.${extension}` : ''}`;
}

type SearchResult =
  | { kind: 'company'; key: string; label: string; secondary: string; slug: string }
  | { kind: 'report'; key: string; label: string; secondary: string; reportId: string };

function GlobalSearch({
  companies,
  variant = 'top',
}: {
  companies: CompanySummary[];
  variant?: 'top' | 'hero';
}) {
  const { locale, t, value } = useI18n();
  const [term, setTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const normalized = term.trim().toLocaleLowerCase();
  const debouncedTerm = useDebouncedValue(term.trim());
  const reportSearch = useQuery({
    queryKey: ['report-search', debouncedTerm],
    queryFn: ({ signal }) => getReports({ q: debouncedTerm, pageSize: 6 }, signal),
    enabled: debouncedTerm.length > 0,
    staleTime: 5 * 60_000,
  });
  const reports = reportSearch.data?.reports ?? [];
  const results = useMemo<SearchResult[]>(() => {
    if (!normalized) return [];
    const companyResults: SearchResult[] = companies.map((company) => localizeCompany(company, locale))
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
        secondary: `${value(company.companyType)} · ${value(company.country)}`,
        slug: company.slug,
      }));
    const reportResults: SearchResult[] = reports
      .filter((report) => [
        report.title,
        report.subtitle ?? '',
        report.summary ?? '',
        report.industry,
        report.region,
        report.publisher,
        ...report.keywords,
      ].some((value) => value.toLocaleLowerCase().includes(normalized)))
      .slice(0, 6)
      .map((report) => ({
        kind: 'report',
        key: `report-${report.id}`,
        label: locale === 'en' && report.subtitle ? report.subtitle : report.title,
        secondary: `${value(report.industry)} · ${value(report.publisher)}`,
        reportId: report.id,
      }));
    return [...companyResults, ...reportResults];
  }, [companies, locale, normalized, reports, value]);

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
        aria-label={t(variant === 'top' ? '全站搜索' : '首页检索')}
        type="search"
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyboard}
        placeholder={t('搜索公司、公司别名、行业、报告标题、新闻或关键词……')}
      />
      {term ? <button type="button" aria-label={t('清除搜索')} onClick={() => setTerm('')}>×</button> : null}
      {normalized ? (
        <div className="search-results" role="listbox" aria-label={t('搜索结果')}>
          {results.length ? results.map((result, index) => (
            <div className="search-result-block" key={result.key}>
              {index === 0 || results[index - 1]?.kind !== result.kind ? (
                <div className="search-group-heading">{t(result.kind === 'company' ? '公司' : '报告')}</div>
              ) : null}
              {result.kind === 'company' ? (
              <Link
                ref={(element) => { linkRefs.current[index] = element; }}
                className={index === activeIndex ? 'is-active' : ''}
                to="/companies/$slug"
                params={{ slug: result.slug }}
                onClick={() => setTerm('')}
              >
                <span><small>{t('公司')}</small>{result.label}</span><em>{result.secondary}</em>
              </Link>
            ) : (
              <Link
                ref={(element) => { linkRefs.current[index] = element; }}
                className={index === activeIndex ? 'is-active' : ''}
                to="/reports/$reportId"
                params={{ reportId: result.reportId }}
                onClick={() => setTerm('')}
              >
                <span><small>{t('报告')}</small>{result.label}</span><em>{result.secondary}</em>
              </Link>
              )}
            </div>
          )) : reportSearch.isPending ? <p>{t('报告数据加载中…')}</p> : <p>{t('未找到匹配的公司或报告')}</p>}
          <footer>{t('↑ ↓ 选择 · Enter 打开 · Esc 关闭')}</footer>
        </div>
      ) : null}
    </div>
  );
}

function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  return <div className="language-selector">
    <button type="button" aria-label={t('选择语言')} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span aria-hidden="true">◎</span>{locale === 'zh' ? '中文' : 'English'}
    </button>
    {open ? <div role="menu">
      <button type="button" role="menuitem" onClick={() => { setLocale('zh'); setOpen(false); }}>中文</button>
      <button type="button" role="menuitem" onClick={() => { setLocale('en'); setOpen(false); }}>English</button>
    </div> : null}
  </div>;
}

function AppShellContent() {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const catalog = useCompanies();
  const companies = catalog.data?.companies ?? [];
  return (
    <div className="app-shell">
      <aside className={menuOpen ? 'sidebar is-open' : 'sidebar'}>
        <div className="brand-block">
          <h1>{t('惠生清能市场知识平台')}</h1>
        </div>
        <nav aria-label={t('主导航')} className="primary-nav">
          {navigation.map(([to, label, icon]) => (
            <Link key={to} to={to} activeProps={{ 'aria-current': 'page' }} onClick={() => setMenuOpen(false)}>
              <i aria-hidden="true">{icon}</i><span>{t(label)}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>{t('内部知识平台')}</span>
          <small>{t('仅限授权员工访问')}</small>
        </div>
      </aside>
      {menuOpen ? <button className="sidebar-scrim" aria-label={t('关闭导航')} onClick={() => setMenuOpen(false)} /> : null}
      <div className="workspace">
        <header className="topbar">
          <button className="menu-button" type="button" aria-label={t('打开导航')} onClick={() => setMenuOpen(true)}>☰</button>
          <GlobalSearch companies={companies} />
          <div className="topbar-actions">
            <LanguageSelector />
            <HealthBadge />
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  );
}

function AppShell() {
  return <I18nProvider><AppShellContent /></I18nProvider>;
}

function HomePage() {
  const { t, value, locale } = useI18n();
  const workspace = useReportWorkspace();
  const companies = useCompanies();
  const reports = useQuery({
    queryKey: ['reports', 'latest'],
    queryFn: ({ signal }) => getReports({ page: 1, pageSize: 5 }, signal),
    staleTime: 5 * 60_000,
  });
  const companyRows = (companies.data?.companies ?? []).map((company) => localizeCompany(company, locale));
  const reportRows = reports.data?.reports ?? [];
  const complete = companyRows.filter(({ dataCoverage }) => dataCoverage === 'complete');
  return (
    <div className="home-page">
      <section className="home-hero">
        <h2>{t('快速定位公司档案与行业研究资料')}</h2>
        <p>{t('面向内部市场研究人员的统一检索入口，连接公司基础信息、项目组合、相关新闻与行业报告。')}</p>
        <GlobalSearch companies={companyRows} variant="hero" />
      </section>
      <section className="library-cards" aria-label={t('知识库入口')}>
        <Link to="/companies">
          <span className="library-icon">▦</span>
          <div><h3>{t('公司信息库')}</h3><p>{t('检索公司档案、区域项目、产量和财务信息。')}</p></div>
          <b>{t('进入 →')}</b>
        </Link>
        <Link to="/reports">
          <span className="library-icon">▤</span>
          <div><h3>{t('行业报告库')}</h3><p>{t('按行业、区域、来源和关联公司定位研究资料。')}</p></div>
          <b>{t('进入 →')}</b>
        </Link>
      </section>
      <section className="stats-strip" aria-label={t('资料统计')}>
        <div><strong>{companyRows.length}</strong><span>{t('已归档公司')}</span></div>
        <div><strong>{reports.data?.total ?? 0}</strong><span>{t('行业报告与资料')}</span></div>
        <div><strong className="sync-date">{formatArchiveDate(reports.data?.syncedOn)}</strong><span>{t('最近一次更新')}</span></div>
      </section>
      <div className="home-columns">
        <section className="content-panel compact-panel">
          <header><div><h3>{t('重点公司')}</h3></div><Link to="/companies">{t('查看全部')}</Link></header>
          {companies.isPending ? <p className="state-message">{t('公司数据加载中…')}</p> : null}
          {complete.slice(0, 6).map((company) => (
            <Link className="compact-row" key={company.slug} to="/companies/$slug" params={{ slug: company.slug }}>
              {company.logoUrl
                ? <img className="initial-badge initial-badge--logo" src={company.logoUrl} alt="" />
                : <span className="initial-badge">{company.displayName.slice(0, 2).toUpperCase()}</span>}
              <span><b>{company.displayName}</b><small>{value(company.companyType)} · {value(company.country)}</small></span>
              <em>{company.projectCount}{t('个项目')}</em>
            </Link>
          ))}
        </section>
        <section className="content-panel compact-panel">
          <header><div><h3>{t('最新报告')}</h3></div><Link to="/reports">{t('查看全部')}</Link></header>
          {reports.isPending ? <p className="state-message">{t('报告数据加载中…')}</p> : null}
          {reportRows.slice(0, 5).map((report) => (
            <Link className="compact-row" key={report.id} to="/reports/$reportId" params={{ reportId: report.id }}>
              <span className="date-badge">{report.publishedOn?.slice(5) ?? t('待补')}</span>
              <span><b>{locale === 'en' && report.subtitle ? report.subtitle : report.title}</b><small>{value(report.industry)} · {value(report.publisher)}</small></span>
            </Link>
          ))}
        </section>
      </div>
      <div className="home-columns report-workspace-columns">
        {([
          [t('最近浏览'), workspace.recent],
          [t('收藏报告'), workspace.favorites],
        ] as const).map(([heading, rows]) => <section className="content-panel compact-panel" key={heading}>
          <header><div><h3>{heading}</h3></div><Link to="/reports">{t('查看全部')}</Link></header>
          {rows.length ? rows.slice(0, 5).map((report) => {
            const title = locale === 'en' && report.subtitle ? report.subtitle : report.title;
            return <Link aria-label={title} className="compact-row" key={report.id} to="/reports/$reportId" params={{ reportId: report.id }}>
              {report.coverUrl ? <img className="workspace-cover" src={report.coverUrl} alt="" /> : <span className="date-badge">{report.publishedOn?.slice(5) ?? t('待补')}</span>}
              <span><b>{title}</b><small>{value(report.publisher)} · {value(report.region)}</small></span>
            </Link>;
          }) : <p className="empty-state">{t(heading === t('最近浏览') ? '尚无最近浏览记录' : '尚未收藏报告')}</p>}
        </section>)}
      </div>
    </div>
  );
}

function CompanyListPage() {
  const { locale, t, value } = useI18n();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [region, setRegion] = useState('');
  const [business, setBusiness] = useState('');
  const query = useQuery({ queryKey: ['companies'], queryFn: ({ signal }) => getCompanies(signal) });
  const companies = (query.data?.companies ?? []).map((company) => localizeCompany(company, locale));
  const types = [...new Set(companies.map((company) => company.companyType))].sort();
  const regions = [...new Set(companies.map((company) => company.region))].sort();
  const businesses = [...new Set(companies.map((company) => businessSegments(company.business, locale)[0] ?? company.business))].sort();
  const filteredCompanies = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return companies.filter((company) => (
      (!term || [company.displayName, company.country, company.business, company.region]
        .some((value) => value.toLocaleLowerCase().includes(term)))
      && (!type || company.companyType === type)
      && (!region || company.region === region)
      && (!business || company.business.includes(business))
    ));
  }, [business, companies, region, search, type]);
  const clearFilters = () => { setSearch(''); setType(''); setRegion(''); setBusiness(''); };

  return (
    <section>
      <div className="page-heading">
        <div><h2>{t('公司信息库')}</h2><p>{t('按公司名称、类型、地区和业务领域检索标准化公司档案。')}</p></div>
        <span className="record-count">{filteredCompanies.length} / {companies.length}{t('家公司')}</span>
      </div>
      <div className="filter-panel company-filters">
        <label><span>{t('公司名称、英文名、简称')}</span><input aria-label={t('公司名称、英文名、简称')} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('输入公司名称')} /></label>
        <label><span>{t('公司类型')}</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="">{t('全部类型')}</option>{types.map((item) => <option key={item} value={item}>{value(item)}</option>)}</select></label>
        <label><span>{t('国家／地区')}</span><select value={region} onChange={(event) => setRegion(event.target.value)}><option value="">{t('全部地区')}</option>{regions.map((item) => <option key={item} value={item}>{value(item)}</option>)}</select></label>
        <label><span>{t('业务领域')}</span><select value={business} onChange={(event) => setBusiness(event.target.value)}><option value="">{t('全部业务')}</option>{businesses.map((item) => <option key={item} value={item}>{value(item)}</option>)}</select></label>
        <button type="button" onClick={clearFilters}>{t('清除筛选')}</button>
      </div>
      {query.isPending ? <p className="state-message">{t('公司数据加载中…')}</p> : null}
      {query.isError ? <p className="state-message state-message--error">{t('公司数据暂时无法加载。')}</p> : null}
      {query.isSuccess ? (
        <div className="data-table-wrap">
          <table className="data-table company-table">
            <thead><tr><th>{t('公司名称')}</th><th>{t('类型')}</th><th>{t('总部地区')}</th><th>{t('业务领域')}</th><th>{t('资料更新时间')}</th></tr></thead>
            <tbody>{filteredCompanies.map((company) => (
              <tr key={company.slug}>
                <td><Link to="/companies/$slug" params={{ slug: company.slug }}>{company.displayName}</Link><small>{company.marketPosition}</small><span className={`coverage coverage--${company.dataCoverage}`}>{t(coverageLabels[company.dataCoverage])}</span></td>
                <td><span className="type-chip">{value(company.companyType)}</span></td>
                <td>{value(company.headquarters)}<small>{value(company.region)}</small></td>
                <td>{businessSegments(company.business, locale).map(value).join(' · ')}</td>
                <td>{formatArchiveDate(company.updatedOn)}</td>
              </tr>
            ))}</tbody>
          </table>
          {!filteredCompanies.length ? <p className="empty-state">{t('没有符合条件的公司')}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function DashboardFrame({ src, title, className = '' }: { src: string; title: string; className?: string }) {
  const { locale } = useI18n();
  const container = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (visible || typeof IntersectionObserver === 'undefined' || !container.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '500px 0px' });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [visible]);
  const localizedSrc = useMemo(() => {
    const url = new URL(src, window.location.origin);
    url.searchParams.set('lang', locale);
    return `${url.pathname}${url.search}`;
  }, [locale, src]);
  return <div ref={container} className={`dashboard-loader ${className}`}>
    {visible
      ? <iframe className="dashboard-frame" src={localizedSrc} title={title} loading="lazy" scrolling="no" />
      : <div className="dashboard-placeholder" aria-label={title} />}
  </div>;
}

function MissingModule({ children }: { children: string }) {
  const { t } = useI18n();
  return <div className="module-missing"><span>{t('资料待补充')}</span><p>{children}</p></div>;
}

function PaginationControls({
  page,
  pageSize,
  total,
  onChange,
  label,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  label: string;
}) {
  const { t } = useI18n();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  return <nav className="pagination" aria-label={label}>
    <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>{t('上一页')}</button>
    <span>{t('第')} {page} / {pageCount} {t('页')}</span>
    <button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>{t('下一页')}</button>
  </nav>;
}

const fidChineseValues: Record<string, string> = {
  'Oil field': '油田',
  'Gas field': '气田',
  'Gas-Condensate field': '凝析气田',
  Fixed: '固定式设施',
  Floater: '浮式设施',
  Onshore: '陆上设施',
  'Subsea tie back': '水下回接',
};
const englishRegions = new Intl.DisplayNames(['en'], { type: 'region' });
const chineseRegions = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
const fidCountryChinese = new Map<string, string>();
for (let first = 65; first <= 90; first += 1) {
  for (let second = 65; second <= 90; second += 1) {
    const code = String.fromCharCode(first, second);
    const englishName = englishRegions.of(code);
    const chineseName = chineseRegions.of(code);
    if (englishName && englishName !== code && chineseName && chineseName !== code) {
      fidCountryChinese.set(englishName, chineseName);
    }
  }
}

function localizeFidValue(value: string, locale: 'zh' | 'en') {
  return locale === 'en' ? value : fidChineseValues[value] ?? fidCountryChinese.get(value) ?? value;
}

function CompanyDetailPage() {
  const { locale, t, value } = useI18n();
  const { slug } = companyDetailRoute.useParams();
  const [newsPage, setNewsPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const [fidPage, setFidPage] = useState(1);
  const query = useQuery({ queryKey: ['company', slug], queryFn: ({ signal }) => getCompany(slug, signal) });
  const newsQuery = useQuery({
    queryKey: ['company-information', slug, 'news', newsPage],
    queryFn: ({ signal }) => getCompanyInformation(slug, 'news', newsPage, 6, signal),
    enabled: query.isSuccess,
    placeholderData: (previous) => previous,
  });
  const reportQuery = useQuery({
    queryKey: ['company-information', slug, 'report', reportPage],
    queryFn: ({ signal }) => getCompanyInformation(slug, 'report', reportPage, 6, signal),
    enabled: query.isSuccess,
    placeholderData: (previous) => previous,
  });
  const fidQuery = useQuery({
    queryKey: ['company-fid', slug, fidPage],
    queryFn: ({ signal }) => getCompanyFidProjects(slug, fidPage, 10, signal),
    enabled: query.isSuccess,
    placeholderData: (previous) => previous,
  });
  if (query.isPending) return <p className="state-message">{t('公司档案加载中…')}</p>;
  if (query.isError) return <p className="state-message state-message--error">{t('公司档案暂时无法加载。')}</p>;
  const company = localizeCompany(query.data, locale);
  const news = newsQuery.data?.information ?? [];
  const reports = reportQuery.data?.information ?? [];
  const fidProjects = fidQuery.data?.projects ?? [];
  const economics = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'zh-CN', { maximumFractionDigits: 2 });
  return (
    <article className="company-detail">
      <nav className="breadcrumb" aria-label={t('面包屑')}><Link to="/companies">{t('公司信息库')}</Link><span>/</span><span>{company.displayName}</span></nav>
      <header className="company-banner">
        {company.logoUrl
          ? <span className="company-mark"><img src={company.logoUrl} alt={`${company.displayName} logo`} /></span>
          : <span className="company-mark">{company.displayName.slice(0, 2).toUpperCase()}</span>}
        <div><h2>{company.displayName}</h2><p>{company.marketPosition}</p><div className="banner-tags"><span>{value(company.companyType)}</span><span>{value(company.country)}</span><span>{t(coverageLabels[company.dataCoverage])}</span></div></div>
        <dl><div><dt>{t('项目数量')}</dt><dd>{company.projectCount || t('未提供')}</dd></div><div><dt>{t('覆盖国家')}</dt><dd>{company.countryCount || t('未提供')}</dd></div><div><dt>{t('资料来源')}</dt><dd>{t('仓库归档')}</dd></div></dl>
      </header>
      <nav className="company-anchor-nav" aria-label={t('公司页面目录')}>
        <a href="#overview">{t('公司概览')}</a><a href="#projects">{t('区域与项目')}</a><a href="#fid-tracker">FID Tracker</a><a href="#production">{t('产量')}</a><a href="#financials">{t('财务')}</a><a href="#news">{t('相关新闻')}</a><a href="#related-reports">{t('相关报告')}</a>
      </nav>
      <section id="overview" className="company-overview-section">
        <div className="section-heading"><h3>{t('公司概览')}</h3></div>
        <div className="content-panel company-profile">
          <div><p className="lead">{company.marketPosition}</p><p>{businessSegments(company.business, locale).map(value).join(' · ')}</p><div className="profile-tag-groups"><div><b>{t('核心业务')}</b><span>{businessSegments(company.business, locale).map((item) => <em className="profile-tag" key={item}>{value(item)}</em>)}</span></div><div><b>{t('重点区域')}</b><span>{company.businessRegions.map((item) => <em className="profile-tag profile-tag--region" key={item}>{value(item)}</em>)}</span></div></div></div>
          <dl className="profile-facts">
            <div><dt>{t('成立年份')}</dt><dd>{company.foundedYear}</dd></div>
            <div><dt>{t('总部')}</dt><dd>{value(company.headquarters)}</dd></div>
            <div><dt>{t('公司类型')}</dt><dd>{value(company.companyType)}</dd></div>
            <div><dt>{t('官方网站')}</dt><dd><a href={company.website} target="_blank" rel="noreferrer">{t('访问官网 ↗')}</a></dd></div>
            <div><dt>{t('资料状态')}</dt><dd>{t(coverageLabels[company.dataCoverage])}</dd></div>
          </dl>
        </div>
      </section>
      <section id="projects" className="portfolio-section">
        <div className="section-heading"><h3>{t('区域与项目')}</h3></div>
        {company.dashboards.map && company.dashboards.projectType ? (
          <div className="analysis-grid">
            <div className="dashboard-card dashboard-card--map"><h4>{t('全球业务／项目分布')}</h4><DashboardFrame className="dashboard-frame--map" src={company.dashboards.map} title={`${company.displayName} ${t('全球业务／项目分布')}`} /></div>
            <div className="dashboard-card"><h4>{t('项目类型结构')}</h4><DashboardFrame src={company.dashboards.projectType} title={`${company.displayName} ${t('项目类型结构')}`} /></div>
          </div>
        ) : <MissingModule>{t('仓库尚未提供该公司的项目分布与项目类型数据。')}</MissingModule>}
      </section>
      <section id="fid-tracker" className="portfolio-section">
        <div className="section-heading section-heading--split"><div><h3>FID Tracker</h3><p>{t('最终投资决策项目跟踪')}</p></div><span>{fidQuery.data?.total ?? 0}{t('条项目记录')}</span></div>
        {fidQuery.isPending ? <p className="state-message">{t('FID 数据加载中…')}</p> : null}
        {fidQuery.isError ? <p className="state-message state-message--error">{t('FID 数据暂时无法加载。')}</p> : null}
        {fidQuery.isSuccess ? <>
          {fidProjects.length ? <div className="data-table-wrap fid-table-wrap"><table className="data-table fid-table">
            <thead><tr><th>{t('项目')}</th><th>{t('批准年份')}</th><th>{t('资产')}</th><th>{t('油气田类型')}</th><th>{t('设施类别')}</th><th>{t('权益')}</th><th>{t('国家')}</th><th>{t('经济性（百万美元）')}</th></tr></thead>
            <tbody>{fidProjects.map((project) => <tr key={project.id}>
              <td><b>{project.project}</b></td><td>{project.approvalYear ?? '—'}</td><td>{project.asset}</td><td>{localizeFidValue(project.fieldType, locale)}</td><td>{localizeFidValue(project.facilityCategory, locale)}</td><td>{project.interests}</td><td>{localizeFidValue(project.country, locale)}</td><td className="numeric-cell">{project.economicsUsdMillion === null ? '—' : economics.format(project.economicsUsdMillion)}</td>
            </tr>)}</tbody>
          </table></div> : <p className="empty-state content-panel">{t('暂无已归档项目')}</p>}
          <PaginationControls page={fidPage} pageSize={10} total={fidQuery.data.total} onChange={setFidPage} label="FID Tracker" />
        </> : null}
      </section>
      <section id="production" className="portfolio-section">
        <div className="section-heading"><h3>{t('区域产量趋势')}</h3></div>
        {company.dashboards.production ? <div className="dashboard-card"><DashboardFrame src={company.dashboards.production} title={`${company.displayName} ${t('区域产量趋势')}`} /></div> : <MissingModule>{t('仓库尚未提供该公司的产量数据。')}</MissingModule>}
      </section>
      <section id="financials" className="portfolio-section">
        <div className="section-heading"><h3>{t('经营与财务表现')}</h3></div>
        {company.dashboards.financial ? <div className="dashboard-card"><DashboardFrame className="dashboard-frame--financial" src={company.dashboards.financial} title={`${company.displayName} ${t('经营与财务表现')}`} /></div> : <MissingModule>{t('仓库尚未提供该公司的财务数据。')}</MissingModule>}
      </section>
      <section id="news" className="portfolio-section">
        <div className="section-heading section-heading--split"><h3>{t('相关新闻')}</h3><span>{newsQuery.data?.total ?? 0}{t('条新闻')}</span></div>
        {newsQuery.isPending ? <p className="state-message">{t('新闻数据加载中…')}</p> : null}
        {newsQuery.isError ? <p className="state-message state-message--error">{t('新闻数据暂时无法加载。')}</p> : null}
        {newsQuery.isSuccess ? <div className="content-panel information-panel compact-information-list">
          {news.length ? news.map((item) => {
            const title = locale === 'en' ? item.subtitle ?? item.title : item.title;
            const summary = locale === 'en' ? item.summaryEn : item.summary;
            return <article key={item.id}><div className="information-meta"><span className="type-chip">{value(item.category ?? '公司动态')}</span><time>{item.publishedOn ?? t('日期未提供')}</time></div><h4>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">{title} ↗</a> : title}</h4>{summary ? <p>{summary}</p> : null}<footer><span>{value(item.publisher)}</span><span>{value(item.region)}</span></footer></article>;
          }) : <p className="empty-state">{t('暂无可追溯新闻数据')}</p>}
        </div> : null}
        <PaginationControls page={newsPage} pageSize={6} total={newsQuery.data?.total ?? 0} onChange={setNewsPage} label={t('相关新闻')} />
      </section>
      <section id="related-reports" className="portfolio-section">
        <div className="section-heading section-heading--split"><h3>{t('相关报告')}</h3><span>{reportQuery.data?.total ?? 0}{t('条报告')}</span></div>
        {reportQuery.isPending ? <p className="state-message">{t('报告数据加载中…')}</p> : null}
        {reportQuery.isError ? <p className="state-message state-message--error">{t('报告数据暂时无法加载。')}</p> : null}
        {reportQuery.isSuccess ? <div className="content-panel information-panel compact-information-list compact-information-list--reports">
          {reports.length ? reports.map((item) => <article key={item.id}><div className="information-meta"><span className="source-tag">{value(item.sourceFormat)}</span><time>{item.publishedOn ?? t('日期未提供')}</time></div><h4><Link to="/reports/$reportId" params={{ reportId: item.id }}>{locale === 'en' && item.subtitle ? item.subtitle : item.title}</Link></h4><footer><span>{value(item.publisher)}</span>{!item.attachmentAvailable ? <span className="unavailable-tag">{t('附件未提供')}</span> : null}</footer></article>) : <p className="empty-state">{t('暂无可追溯行业报告数据')}</p>}
        </div> : null}
        <PaginationControls page={reportPage} pageSize={6} total={reportQuery.data?.total ?? 0} onChange={setReportPage} label={t('相关报告')} />
      </section>
    </article>
  );
}

function ReportsPage() {
  const { locale, t, value } = useI18n();
  const workspace = useReportWorkspace();
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [region, setRegion] = useState('');
  const [type, setType] = useState('');
  const [family, setFamily] = useState('');
  const [publisher, setPublisher] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);
  const parameters = { page, pageSize: 50, q: debouncedSearch, industry, region, informationType: type, sourceFamily: family, publisher };
  const query = useQuery({
    queryKey: ['reports', parameters],
    queryFn: ({ signal }) => getReports(parameters, signal),
    placeholderData: (previous) => previous,
    staleTime: 5 * 60_000,
  });
  const reports = query.data?.reports ?? [];
  const facets = query.data?.facets;
  const total = query.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 50));
  const currentPage = Math.min(page, pageCount);
  const displayedReports = favoritesOnly ? workspace.favorites : reports;
  const displayedTotal = favoritesOnly ? workspace.favorites.length : total;
  const clearFilters = () => { setSearch(''); setIndustry(''); setRegion(''); setType(''); setFamily(''); setPublisher(''); setFavoritesOnly(false); setPage(1); };
  return (
    <section>
      <div className="page-heading"><div><h2>{t('行业报告库')}</h2><p>{t('按标题、行业、区域、发布机构及关联公司检索已归档研究资料。')}</p></div><span className="record-count">{displayedTotal}{t('条报告')}</span></div>
      <div className="filter-panel report-filters">
        <label><span>{t('标题、摘要、关键词、公司')}</span><input aria-label={t('报告检索')} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t('输入检索词')} /></label>
        <label><span>{t('行业')}</span><select value={industry} onChange={(event) => { setIndustry(event.target.value); setPage(1); }}><option value="">{t('全部行业')}</option>{(facets?.industries ?? []).map((item) => <option key={item} value={item}>{value(item)}</option>)}</select></label>
        <label><span>{t('区域')}</span><select value={region} onChange={(event) => { setRegion(event.target.value); setPage(1); }}><option value="">{t('全部地区')}</option>{(facets?.regions ?? []).map((item) => <option key={item} value={item}>{value(item)}</option>)}</select></label>
        <label><span>{t('报告类型')}</span><select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="">{t('全部类型')}</option>{(facets?.informationTypes ?? []).map((item) => <option key={item} value={item}>{value(item)}</option>)}</select></label>
        <label><span>{t('来源类别')}</span><select value={family} onChange={(event) => { setFamily(event.target.value); setPage(1); }}><option value="">{t('全部类别')}</option>{(facets?.sourceFamilies ?? []).map((item) => <option key={item} value={item}>{value(item)}</option>)}</select></label>
        <label><span>{t('发布机构')}</span><select value={publisher} onChange={(event) => { setPublisher(event.target.value); setPage(1); }}><option value="">{t('全部机构')}</option>{(facets?.publishers ?? []).map((item) => <option key={item} value={item}>{value(item)}</option>)}</select></label>
        <label className="favorite-filter"><input aria-label={t('仅看收藏')} type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} /><span>★ {t('仅看收藏')}</span></label>
        <button type="button" onClick={clearFilters}>{t('清除筛选')}</button>
      </div>
      {query.isPending && !favoritesOnly ? <p className="state-message">{t('报告数据加载中…')}</p> : null}
      {query.isError && !favoritesOnly ? <p className="state-message state-message--error">{t('报告数据暂时无法加载。')}</p> : null}
      {query.isSuccess || favoritesOnly ? <><div className="report-list">{displayedReports.map((report) => {
        const title = locale === 'en' && report.subtitle ? report.subtitle : report.title;
        const coverLabel = `${title} ${t('封面')}`;
        return <article key={report.id}><div className="report-list-visual">{report.coverUrl ? <img src={report.coverUrl} alt={coverLabel} loading="lazy" decoding="async" /> : <span className="report-cover-placeholder" role="img" aria-label={coverLabel}>{t('报告')}</span>}<time>{report.publishedOn ?? t('日期未提供')}</time></div><div><div className="report-tags"><span>{value(report.sourceFamily)}</span><span>{value(report.industry)}</span><span>{value(report.region)}</span><span>{value(report.informationType)}</span>{workspace.isFavorite(report.id) ? <span className="favorite-tag">★ {t('已收藏')}</span> : null}</div><h3><Link to="/reports/$reportId" params={{ reportId: report.id }}>{title}</Link></h3>{locale === 'zh' && report.subtitle ? <p className="report-subtitle">{report.subtitle}</p> : null}{locale === 'zh' && report.summary ? <p>{report.summary}</p> : null}<footer><span>{t('发布机构')}：{value(report.publisher)}</span><span>{value(report.sourceFormat)}</span><span>{report.relatedCompanies.map(({ displayName }) => displayName).join(locale === 'en' ? ', ' : '、') || t('未关联公司')}</span>{!report.attachmentAvailable ? <span className="unavailable-tag">{t('附件未上传')}</span> : <span className="available-tag">{t('附件已归档')}</span>}</footer></div></article>;
      })}{!displayedTotal ? <p className="empty-state">{t(favoritesOnly ? '尚未收藏报告' : '没有符合条件的报告')}</p> : null}</div>{!favoritesOnly && pageCount > 1 ? <nav className="pagination" aria-label={t('报告类型')}><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>{t('上一页')}</button><span>{t('第')} {currentPage} / {pageCount} {t('页')}</span><button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>{t('下一页')}</button></nav> : null}</> : null}
    </section>
  );
}

function ReportDetailPage() {
  const { locale, t, value } = useI18n();
  const workspace = useReportWorkspace();
  const { reportId } = reportDetailRoute.useParams();
  const query = useQuery({ queryKey: ['report', reportId], queryFn: ({ signal }) => getReport(reportId, signal) });
  useEffect(() => {
    if (query.data) workspace.recordRecent(query.data);
  }, [query.data?.id]);
  if (query.isPending) return <p className="state-message">{t('报告资料加载中…')}</p>;
  if (query.isError) return <p className="state-message state-message--error">{t('报告资料暂时无法加载。')}</p>;
  const report = query.data;
  const title = locale === 'en' && report.subtitle ? report.subtitle : report.title;
  return (
    <article className="report-detail">
      <nav className="breadcrumb" aria-label={t('面包屑')}><Link to="/reports">{t('行业报告库')}</Link><span>/</span><span>{title}</span></nav>
      <header className="report-cover"><div><h2>{title}</h2>{locale === 'zh' && report.subtitle ? <p>{report.subtitle}</p> : null}<button className="favorite-button" type="button" aria-pressed={workspace.isFavorite(report.id)} aria-label={t(workspace.isFavorite(report.id) ? '取消收藏' : '收藏报告')} onClick={() => workspace.toggleFavorite(report)}>{workspace.isFavorite(report.id) ? '★' : '☆'} {t(workspace.isFavorite(report.id) ? '已收藏' : '收藏报告')}</button></div><div className="report-cover-asset">{report.coverUrl ? <img src={report.coverUrl} alt={`${title} ${t('封面')}`} /> : <span>{value(report.sourceFormat)}</span>}</div></header>
      <div className="report-detail-grid">
        <div>
          <section className="content-panel"><h3>{t('报告摘要')}</h3>{locale === 'zh' && report.summary ? <p className="lead">{report.summary}</p> : <p className="metadata-note">{t('源表未提供报告摘要，当前仅归档标题和可核验元数据。')}</p>}</section>
          <section className="content-panel unavailable-detail"><h3>{t('资料完整性')}</h3><p>{report.attachmentAvailable ? t('报告附件已归档，可通过下方受控下载入口获取。') : t('当前仓库仅提供可追溯的报告摘要与归档元数据，未提供研究结论与目录，也未上传原始附件。')}</p>{!report.attachmentAvailable ? <span className="unavailable-tag">{t('附件未上传')}</span> : <span className="available-tag">{t('附件已归档')}</span>}</section>
          {report.attachments?.length ? <section className="content-panel report-attachments"><h3>{t('报告附件')}</h3><div>{report.attachments.map((attachment, index) => <a key={attachment.id} href={attachment.downloadUrl} download><span><b>{attachmentLabel(attachment.fileName, title, index, report.attachments?.length ?? 1, locale)}</b><small>{attachment.mimeType} · {formatFileSize(attachment.byteSize)}</small></span><em>{t('下载附件')} ↓</em></a>)}</div></section> : null}
        </div>
        <aside className="content-panel report-meta"><h3>{t('归档信息')}</h3><dl><div><dt>{t('来源类别')}</dt><dd>{value(report.sourceFamily)}</dd></div><div><dt>{t('行业')}</dt><dd>{value(report.industry)}</dd></div><div><dt>{t('区域')}</dt><dd>{value(report.region)}</dd></div><div><dt>{t('类型')}</dt><dd>{value(report.informationType)}</dd></div><div><dt>{t('发布机构')}</dt><dd>{value(report.publisher)}</dd></div><div><dt>{t('发布日期')}</dt><dd>{report.publishedOn ?? t('未提供')}</dd></div><div><dt>{t('语言')}</dt><dd>{value(report.language)}</dd></div><div><dt>{t('格式')}</dt><dd>{value(report.sourceFormat)}</dd></div></dl><h4>{t('关联公司')}</h4><div className="related-companies">{report.relatedCompanies.length ? report.relatedCompanies.map((company) => <Link key={company.slug} to="/companies/$slug" params={{ slug: company.slug }}>{company.displayName}</Link>) : <span>{t('未关联公司')}</span>}</div>{report.keywords.length ? <><h4>{t('关键词')}</h4><div className="keyword-list">{report.keywords.map((keyword) => <span key={keyword}>{value(keyword)}</span>)}</div></> : null}</aside>
      </div>
    </article>
  );
}

function AdminDeniedPage() { const { t } = useI18n(); return <section><h2>{t('无权访问')}</h2><p>{t('当前 Demo 仅开放只读浏览权限。')}</p></section>; }

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
