import { pathToFileURL } from 'node:url';

const focusCompanySlugs = [
  'shell', 'bp', 'exxonmobil', 'petronas', 'adnoc', 'chevron', 'totalenergies', 'eni',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateTarget(baseUrl) {
  const target = new URL(baseUrl);
  assert(target.protocol === 'https:', 'Public UAT audit target must use HTTPS.');
  assert(!target.username && !target.password && !target.search && !target.hash,
    'Public UAT audit target must be an origin without credentials, query parameters or fragments.');
  return target;
}

async function fetchChecked(target, path, options = {}) {
  const response = await fetch(new URL(path, target), {
    redirect: 'manual',
    ...options,
  });
  return response;
}

async function readJson(target, path) {
  const response = await fetchChecked(target, path, { headers: { accept: 'application/json' } });
  assert(response.status === 200, `${path} returned ${response.status}, expected 200.`);
  return { data: await response.json(), response };
}

export async function auditPublicUat({
  baseUrl,
  expectedCompanies = 126,
  expectedReports = 1111,
}) {
  const target = validateTarget(baseUrl);
  const home = await fetchChecked(target, '/');
  const homeBody = await home.text();
  assert(home.status === 200, `Home returned ${home.status}, expected 200.`);
  assert(/<meta name="robots" content="noindex,nofollow"/i.test(homeBody),
    'Home is missing the noindex robots meta tag.');
  assert(home.headers.get('x-robots-tag')?.includes('noindex'),
    'Home is missing the X-Robots-Tag noindex header.');

  const robots = await fetchChecked(target, '/robots.txt');
  assert(robots.status === 200, `robots.txt returned ${robots.status}, expected 200.`);
  assert((robots.headers.get('content-type') ?? '').includes('text/plain'),
    'robots.txt is not served as text/plain.');
  assert(/User-agent: \*\s+Disallow: \//i.test(await robots.text()),
    'robots.txt does not disallow all crawlers.');

  const companyResult = await readJson(target, '/api/v1/companies');
  const companies = companyResult.data.companies;
  assert(companies.length === expectedCompanies,
    `Company count is ${companies.length}, expected ${expectedCompanies}.`);
  assert(new Set(companies.map(({ slug }) => slug)).size === expectedCompanies,
    'Company slugs are not unique.');
  assert(companyResult.response.headers.get('x-robots-tag')?.includes('noindex'),
    'Public company API is missing X-Robots-Tag noindex.');

  const firstReports = await readJson(target, '/api/v1/reports?page=1&pageSize=100');
  assert(firstReports.data.total === expectedReports,
    `Report total is ${firstReports.data.total}, expected ${expectedReports}.`);
  const pageCount = Math.ceil(expectedReports / 100);
  const remainingPages = await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) =>
    readJson(target, `/api/v1/reports?page=${index + 2}&pageSize=100`)));
  const reports = [firstReports, ...remainingPages].flatMap(({ data }) => data.reports);
  assert(reports.length === expectedReports,
    `Fetched ${reports.length} report rows, expected ${expectedReports}.`);
  assert(new Set(reports.map(({ id }) => id)).size === expectedReports,
    'Report IDs are not unique.');

  const focusCompanies = await Promise.all(focusCompanySlugs.map(async (slug) => {
    const { data } = await readJson(target, `/api/v1/companies/${slug}`);
    const dashboards = Object.values(data.dashboards ?? {}).filter(Boolean);
    assert(dashboards.length === 4, `${slug} exposes ${dashboards.length} dashboards, expected 4.`);
    const statuses = await Promise.all(dashboards.map(async (path) =>
      (await fetchChecked(target, path)).status));
    assert(statuses.every((status) => status === 200),
      `${slug} has an unavailable dashboard: ${statuses.join(', ')}.`);
    return { dashboards: dashboards.length, slug };
  }));

  const me = await fetchChecked(target, '/api/v1/me');
  assert(me.status === 401, `/api/v1/me returned ${me.status}, expected 401.`);
  assert(me.headers.get('cache-control') === 'private, no-store',
    '/api/v1/me is not explicitly private and no-store.');
  const writeAttempt = await fetchChecked(target, '/api/v1/companies', { method: 'POST' });
  assert(writeAttempt.status === 401, `Anonymous write returned ${writeAttempt.status}, expected 401.`);

  const cacheStatuses = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetchChecked(target, '/api/v1/companies');
    cacheStatuses.push(response.headers.get('cf-cache-status'));
    await response.body?.cancel();
    if (cacheStatuses.at(-1) === 'HIT') break;
  }
  assert(cacheStatuses.includes('HIT'),
    `Public API did not reach an edge cache HIT: ${cacheStatuses.join(', ')}.`);

  return {
    anonymousAccountStatus: me.status,
    anonymousWriteStatus: writeAttempt.status,
    cacheStatuses,
    companies: companies.length,
    focusCompanies,
    reports: reports.length,
    robots: 'noindex + disallow',
    target: target.origin,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const baseUrl = process.argv[2];
    assert(baseUrl, 'Usage: node scripts/audit-public-uat.mjs <https://origin>');
    console.log(JSON.stringify(await auditPublicUat({ baseUrl }), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
