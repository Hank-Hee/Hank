import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(repositoryRoot, 'data/company-demo-inventory.json');
const profilePath = 'company-text-dashboard/data/company-data.json';

const companies = [
  { slug: 'adnoc', displayName: 'ADNOC', productionKey: 'adnoc', financialKey: 'adnoc' },
  { slug: 'bp', displayName: 'BP', productionKey: 'bp', financialKey: 'bp' },
  { slug: 'chevron', displayName: 'Chevron', productionKey: 'chevron', financialKey: 'chevron' },
  { slug: 'eni', displayName: 'ENI', productionKey: 'eni', financialKey: 'eni' },
  { slug: 'exxonmobil', displayName: 'ExxonMobil', productionKey: 'exxon', financialKey: 'exxonmobil' },
  { slug: 'petronas', displayName: 'Petronas', productionKey: 'petronas', financialKey: 'petronas' },
  { slug: 'shell', displayName: 'Shell', productionKey: 'shell', financialKey: 'shell' },
  { slug: 'totalenergies', displayName: 'TotalEnergies', productionKey: 'totalenergies', financialKey: 'totalenergies' },
];

async function readJson(path) {
  return JSON.parse(await readFile(resolve(repositoryRoot, path), 'utf8'));
}

async function describeAsset(kind, path) {
  const bytes = await readFile(resolve(repositoryRoot, path));
  return {
    kind,
    path,
    status: 'present',
    size: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

const profiles = await readJson(profilePath);
const operators = (await readJson('maps/operators.json')).operators;
const inventoryCompanies = [];

for (const company of companies) {
  const profile = profiles.find(
    (row) => String(row['公司名称']).toLocaleLowerCase('en-US') === company.displayName.toLocaleLowerCase('en-US'),
  );
  if (!profile) throw new Error(`Missing company profile: ${company.displayName}`);

  const operator = operators.find((entry) => entry.slug === company.slug);
  if (!operator) throw new Error(`Missing map operator: ${company.slug}`);

  const assetPaths = [
    ['profile', profilePath],
    ['banner', `${company.slug}-banner.html`],
    ['map-and-project-type', `maps/data/${company.slug}.json`],
    ['production-dashboard', `${company.productionKey}-net-production-dashboard.html`],
    ['production-data', `data/${company.productionKey}-net-production-by-region.json`],
    ['financial-dashboard', `charts/financial/${company.financialKey}-financial-dashboard.html`],
    ['financial-data', `data/${company.financialKey}-financials.json`],
  ];

  inventoryCompanies.push({
    slug: company.slug,
    displayName: company.displayName,
    sourceId: profile.data_id,
    companyType: profile['公司类型'],
    country: profile['国家'],
    region: profile['地区'],
    business: profile['主营业务'],
    marketPosition: profile['市场定位'],
    website: profile['官方网站'],
    foundedYear: profile['成立年份'],
    headquarters: profile['总部'],
    projectCount: operator.projectCount,
    countryCount: operator.countryCount,
    businessRegions: operator.businessRegions,
    assets: await Promise.all(assetPaths.map(([kind, path]) => describeAsset(kind, path))),
  });
}

const inventory = {
  schemaVersion: 1,
  generatedBy: 'scripts/build-company-demo-inventory.mjs',
  companies: inventoryCompanies,
  relatedInformation: {
    status: 'metadata-only',
    source: 'industry-research-data.js',
    attachmentPolicy: 'Do not infer an attachment from its format field.',
  },
  news: {
    status: 'not-provided',
    source: null,
    displayPolicy: 'Render an explicit empty state; never synthesize news.',
  },
};

const serialized = `${JSON.stringify(inventory, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const existing = await readFile(outputPath, 'utf8').catch(() => '');
  if (existing !== serialized) {
    throw new Error('Company demo inventory is missing or stale. Run the inventory builder.');
  }
} else {
  await writeFile(outputPath, serialized, 'utf8');
  console.log(`Wrote ${inventoryCompanies.length} companies to ${outputPath}`);
}
