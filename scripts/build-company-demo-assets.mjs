import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutput = resolve(repositoryRoot, 'apps/web/public/company-assets');
const outputArgument = process.argv.find((argument) => argument.startsWith('--output='));
const outputRoot = outputArgument ? resolve(outputArgument.slice('--output='.length)) : defaultOutput;
if (outputRoot !== defaultOutput && !basename(outputRoot).startsWith('company-assets-')) {
  throw new Error('Refusing to replace an output directory outside the company-assets build boundary.');
}

const inventory = JSON.parse(
  await readFile(resolve(repositoryRoot, 'data/company-demo-inventory.json'), 'utf8'),
);
const productionKey = (slug) => slug === 'exxonmobil' ? 'exxon' : slug;
const logoFiles = {
  adnoc: 'adnoc-logo.svg',
  bp: 'bp-logo.svg',
  chevron: 'chevron-logo.svg',
  eni: 'eni-logo.svg',
  exxonmobil: 'exxonmobil-logo.png',
  petronas: 'petronas-logo.svg',
  shell: 'shell-logo.svg',
  totalenergies: 'totalenergies-logo.webp',
};

async function copy(source, destination) {
  const target = resolve(outputRoot, destination);
  await mkdir(dirname(target), { recursive: true });
  await cp(resolve(repositoryRoot, source), target);
}

async function writeTransformed(source, destination, transform) {
  const target = resolve(outputRoot, destination);
  await mkdir(dirname(target), { recursive: true });
  const content = await readFile(resolve(repositoryRoot, source), 'utf8');
  await writeFile(target, transform(content), 'utf8');
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const operatorManifest = JSON.parse(await readFile(resolve(repositoryRoot, 'maps/operators.json'), 'utf8'));
const selectedSlugs = new Set(inventory.companies.map(({ slug }) => slug));
const selectedOperators = operatorManifest.operators.filter(({ slug }) => selectedSlugs.has(slug));
await mkdir(resolve(outputRoot, 'maps'), { recursive: true });
await writeFile(
  resolve(outputRoot, 'maps/operators.json'),
  `${JSON.stringify({ ...operatorManifest, operators: selectedOperators }, null, 2)}\n`,
  'utf8',
);
for (const file of ['index.html', 'styles.css', 'app.js', 'app-core.js']) {
  await copy(`maps/${file}`, `maps/${file}`);
}
await copy('maps/data/country-centers.json', 'maps/data/country-centers.json');

for (const file of ['index.html', 'styles.css', 'app.js', 'chart-core.js']) {
  await copy(`charts/project-type/${file}`, `charts/project-type/${file}`);
}

await copy('production/production-dashboard.css', 'production/dashboard.css');
await copy('production/production-dashboard.js', 'production/dashboard.js');
await copy('assets/echarts-production-lite.min.js', 'production/echarts-production-lite.min.js');
await copy('charts/financial/financial-dashboard.css', 'financial/dashboard.css');
await writeTransformed(
  'charts/financial/financial-dashboard.js',
  'financial/dashboard.js',
  (content) => content.replaceAll('../../data/', './data/'),
);

for (const company of inventory.companies) {
  const { slug } = company;
  const production = productionKey(slug);
  await copy(`${slug}-banner.html`, `banners/${slug}.html`);
  await copy(
    `assets/banner-logos/${logoFiles[slug]}`,
    `banners/assets/banner-logos/${logoFiles[slug]}`,
  );
  await copy(`maps/data/${slug}.json`, `maps/data/${slug}.json`);
  await copy(
    `data/${production}-net-production-by-region.json`,
    `data/${production}-net-production-by-region.json`,
  );
  await writeTransformed(
    `${production}-net-production-dashboard.html`,
    `production/${production}.html`,
    (content) => content
      .replaceAll('production/production-dashboard.css', 'dashboard.css')
      .replaceAll('assets/echarts-production-lite.min.js', 'echarts-production-lite.min.js')
      .replaceAll('production/production-dashboard.js', 'dashboard.js')
      .replaceAll('href="data/', 'href="../data/'),
  );
  await copy(
    `data/${slug}-financials.json`,
    `financial/data/${slug}-financials.json`,
  );
  await writeTransformed(
    `charts/financial/${slug}-financial-dashboard.html`,
    `financial/${slug}.html`,
    (content) => content
      .replaceAll('financial-dashboard.css', 'dashboard.css')
      .replaceAll('financial-dashboard.js', 'dashboard.js'),
  );
}

await writeFile(
  resolve(outputRoot, 'asset-manifest.json'),
  `${JSON.stringify({
    schemaVersion: 1,
    protectedBy: '/company-assets/*',
    companies: inventory.companies.map(({ slug, displayName }) => ({ slug, displayName })),
  }, null, 2)}\n`,
  'utf8',
);

console.log(`Built protected company assets for ${inventory.companies.length} companies at ${outputRoot}`);
